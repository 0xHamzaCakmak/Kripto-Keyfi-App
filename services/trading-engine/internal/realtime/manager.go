package realtime

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

type Store interface {
	ListRealtimeAccounts(context.Context) ([]account.Resolved, error)
	AppendOutboxEvent(context.Context, domain.OutboxEvent) error
}

type Manager struct {
	store     Store
	client    *http.Client
	endpoints exchange.Endpoints
	logger    *slog.Logger
	refresh   time.Duration

	mu       sync.Mutex
	sessions map[string]managedSession
}

type managedSession struct {
	cancel      context.CancelFunc
	fingerprint string
}

type Options struct {
	Store           Store
	Client          *http.Client
	Endpoints       exchange.Endpoints
	Logger          *slog.Logger
	RefreshInterval time.Duration
}

func New(options Options) *Manager {
	client := options.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	logger := options.Logger
	if logger == nil {
		logger = slog.Default()
	}
	refresh := options.RefreshInterval
	if refresh <= 0 {
		refresh = 30 * time.Second
	}
	return &Manager{
		store: options.Store, client: client, endpoints: options.Endpoints,
		logger: logger, refresh: refresh, sessions: make(map[string]managedSession),
	}
}

func (m *Manager) Run(ctx context.Context) {
	m.syncAccounts(ctx)
	ticker := time.NewTicker(m.refresh)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			m.stopAll()
			return
		case <-ticker.C:
			m.syncAccounts(ctx)
		}
	}
}

func (m *Manager) syncAccounts(ctx context.Context) {
	accounts, err := m.store.ListRealtimeAccounts(ctx)
	if err != nil {
		m.logger.Warn("realtime account discovery failed", "error", err)
		return
	}
	wanted := make(map[string]account.Resolved, len(accounts))
	for _, resolved := range accounts {
		wanted[resolved.Reference.ID] = resolved
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	for id, session := range m.sessions {
		resolved, exists := wanted[id]
		if !exists || session.fingerprint != credentialFingerprint(resolved) {
			session.cancel()
			delete(m.sessions, id)
		}
	}
	for id, resolved := range wanted {
		if _, exists := m.sessions[id]; exists {
			continue
		}
		sessionContext, cancel := context.WithCancel(ctx)
		m.sessions[id] = managedSession{cancel: cancel, fingerprint: credentialFingerprint(resolved)}
		go m.runAccount(sessionContext, resolved)
	}
}

func (m *Manager) runAccount(ctx context.Context, resolved account.Resolved) {
	backoff := time.Second
	for ctx.Err() == nil {
		runner := newBinanceStream(resolved, m.store, m.client, m.endpoints, m.logger)
		err := runner.run(ctx)
		if ctx.Err() != nil {
			return
		}
		m.logger.Warn("private stream disconnected", "account_id", resolved.Reference.ID, "error", err)
		_ = m.store.AppendOutboxEvent(ctx, statusEvent(resolved, "STREAM_DISCONNECTED", map[string]any{
			"reason": "connection_lost", "retryInSeconds": int(backoff.Seconds()),
		}))
		timer := time.NewTimer(backoff)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
		backoff *= 2
		if backoff > 30*time.Second {
			backoff = 30 * time.Second
		}
	}
}

func (m *Manager) stopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, session := range m.sessions {
		session.cancel()
		delete(m.sessions, id)
	}
}

func credentialFingerprint(resolved account.Resolved) string {
	digest := sha256.Sum256([]byte(resolved.Credentials.APIKey + "\x00" + resolved.Credentials.APISecret))
	return hex.EncodeToString(digest[:])
}

func statusEvent(resolved account.Resolved, eventType string, payload map[string]any) domain.OutboxEvent {
	now := time.Now().UTC()
	return domain.OutboxEvent{
		UserID: resolved.Reference.UserID, ExchangeAccountID: resolved.Reference.ID,
		Provider: resolved.Reference.Provider, Topic: "trading.account", EventType: eventType,
		AggregateType: "ACCOUNT", AggregateID: resolved.Reference.ID,
		DeduplicationKey: resolved.Reference.ID + ":" + eventType + ":" + now.Format(time.RFC3339Nano),
		Payload:          payload, OccurredAt: now,
	}
}
