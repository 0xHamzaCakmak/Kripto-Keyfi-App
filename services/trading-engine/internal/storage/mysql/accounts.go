package mysqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	mysqldriver "github.com/go-sql-driver/mysql"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/credential"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

var ErrAccountNotFound = errors.New("exchange account not found")

type AccountStore struct {
	database *sql.DB
	vault    *credential.Vault
}

func Open(ctx context.Context, databaseURL string, vault *credential.Vault) (*AccountStore, error) {
	dsn, err := databaseDSN(databaseURL)
	if err != nil {
		return nil, err
	}
	database, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("open trading database: %w", err)
	}
	database.SetConnMaxLifetime(5 * time.Minute)
	database.SetMaxOpenConns(10)
	database.SetMaxIdleConns(5)
	pingContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := database.PingContext(pingContext); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("connect trading database: %w", err)
	}
	return &AccountStore{database: database, vault: vault}, nil
}

func (s *AccountStore) Close() error { return s.database.Close() }

func (s *AccountStore) Resolve(ctx context.Context, userID, accountID string) (account.Resolved, error) {
	const query = `SELECT id, userId, provider, environment, accountType,
apiKeyEncrypted, apiSecretEncrypted, COALESCE(passphraseEncrypted, ''), isActive, executionEngine
FROM exchange_accounts WHERE id = ? AND userId = ? LIMIT 1`
	var reference domain.ExchangeAccountRef
	var apiKeyEncrypted, apiSecretEncrypted, passphraseEncrypted string
	var active bool
	var engine string
	err := s.database.QueryRowContext(ctx, query, accountID, userID).Scan(
		&reference.ID, &reference.UserID, &reference.Provider, &reference.Environment, &reference.AccountType,
		&apiKeyEncrypted, &apiSecretEncrypted, &passphraseEncrypted, &active, &engine,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return account.Resolved{}, ErrAccountNotFound
	}
	if err != nil {
		return account.Resolved{}, fmt.Errorf("resolve exchange account: %w", err)
	}
	if !active {
		return account.Resolved{}, errors.New("exchange account is disabled")
	}
	if reference.Environment != domain.EnvironmentDemo && reference.Environment != domain.EnvironmentTestnet {
		return account.Resolved{}, errors.New("live exchange accounts are not allowed")
	}
	apiKey, err := s.vault.Decrypt(apiKeyEncrypted)
	if err != nil {
		return account.Resolved{}, errors.New("decrypt exchange credentials: api key authentication failed")
	}
	apiSecret, err := s.vault.Decrypt(apiSecretEncrypted)
	if err != nil {
		return account.Resolved{}, errors.New("decrypt exchange credentials: secret authentication failed")
	}
	credentials := exchange.Credentials{APIKey: apiKey, APISecret: apiSecret}
	if passphraseEncrypted != "" {
		credentials.Passphrase, err = s.vault.Decrypt(passphraseEncrypted)
		if err != nil {
			return account.Resolved{}, errors.New("decrypt exchange credentials: passphrase authentication failed")
		}
	}
	return account.Resolved{Reference: reference, Credentials: credentials, Engine: engine}, nil
}

func (s *AccountStore) ListRealtimeAccounts(ctx context.Context) ([]account.Resolved, error) {
	const query = `SELECT id, userId, provider, environment, accountType,
apiKeyEncrypted, apiSecretEncrypted, COALESCE(passphraseEncrypted, ''), isActive, executionEngine
FROM exchange_accounts
WHERE isActive = TRUE AND connectionStatus = 'CONNECTED' AND provider = 'BINANCE'
ORDER BY id`
	rows, err := s.database.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list realtime exchange accounts: %w", err)
	}
	defer rows.Close()
	result := make([]account.Resolved, 0)
	for rows.Next() {
		var reference domain.ExchangeAccountRef
		var apiKeyEncrypted, apiSecretEncrypted, passphraseEncrypted, engine string
		var active bool
		if err := rows.Scan(
			&reference.ID, &reference.UserID, &reference.Provider, &reference.Environment, &reference.AccountType,
			&apiKeyEncrypted, &apiSecretEncrypted, &passphraseEncrypted, &active, &engine,
		); err != nil {
			return nil, fmt.Errorf("scan realtime exchange account: %w", err)
		}
		apiKey, err := s.vault.Decrypt(apiKeyEncrypted)
		if err != nil {
			return nil, errors.New("decrypt realtime credentials: api key authentication failed")
		}
		apiSecret, err := s.vault.Decrypt(apiSecretEncrypted)
		if err != nil {
			return nil, errors.New("decrypt realtime credentials: secret authentication failed")
		}
		credentials := exchange.Credentials{APIKey: apiKey, APISecret: apiSecret}
		if passphraseEncrypted != "" {
			credentials.Passphrase, err = s.vault.Decrypt(passphraseEncrypted)
			if err != nil {
				return nil, errors.New("decrypt realtime credentials: passphrase authentication failed")
			}
		}
		result = append(result, account.Resolved{Reference: reference, Credentials: credentials, Engine: engine})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate realtime exchange accounts: %w", err)
	}
	return result, nil
}

func (s *AccountStore) AppendOutboxEvent(ctx context.Context, event domain.OutboxEvent) error {
	payload, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("marshal outbox payload: %w", err)
	}
	_, err = s.database.ExecContext(ctx, `INSERT INTO trading_outbox_events
(userId, exchangeAccountId, provider, topic, eventType, aggregateType, aggregateId, deduplicationKey, payload, occurredAt, createdAt)
VALUES (?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE deduplicationKey = VALUES(deduplicationKey)`,
		event.UserID, event.ExchangeAccountID, event.Provider, event.Topic, event.EventType,
		event.AggregateType, event.AggregateID, event.DeduplicationKey, payload, event.OccurredAt.UTC(),
	)
	if err != nil {
		return fmt.Errorf("append trading outbox event: %w", err)
	}
	return nil
}

func databaseDSN(databaseURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(databaseURL))
	if err != nil || parsed.Scheme != "mysql" || parsed.User == nil || parsed.Host == "" || strings.TrimPrefix(parsed.Path, "/") == "" {
		return "", errors.New("DATABASE_URL must be a complete mysql:// URL")
	}
	password, _ := parsed.User.Password()
	config := mysqldriver.NewConfig()
	config.User = parsed.User.Username()
	config.Passwd = password
	config.Net = "tcp"
	config.Addr = parsed.Host
	config.DBName = strings.TrimPrefix(parsed.Path, "/")
	config.ParseTime = true
	config.Collation = "utf8mb4_unicode_ci"
	config.Timeout = 5 * time.Second
	config.ReadTimeout = 10 * time.Second
	config.WriteTimeout = 10 * time.Second
	return config.FormatDSN(), nil
}

var _ account.Store = (*AccountStore)(nil)
