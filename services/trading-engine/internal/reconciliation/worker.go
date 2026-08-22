package reconciliation

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	binanceexchange "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/binance"
	bybitexchange "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/bybit"
)

type PendingOrder struct {
	ID, UserID, ExchangeAccountID, ClientOrderID, Symbol string
	Status                                               domain.OrderStatus
	ExecutionAttempted                                   bool
}

type Store interface {
	ListReconciliationAccounts(context.Context) ([]account.Resolved, error)
	ListReconciliationOrders(context.Context, string) ([]PendingOrder, error)
	ApplyReconciledOrder(context.Context, PendingOrder, domain.Order, time.Time) (bool, error)
	MarkAccountDegraded(context.Context, account.Resolved, string, time.Time) error
	MarkAccountHealthy(context.Context, account.Resolved, time.Time) error
	AppendOutboxEvent(context.Context, domain.OutboxEvent) error
}

type Reader interface {
	GetOpenOrders(context.Context) ([]domain.Order, error)
	GetPositions(context.Context) ([]domain.Position, error)
	GetOrderByClientID(context.Context, string, string) (domain.Order, error)
}

type ReaderFactory func(account.Resolved) (Reader, error)

type Worker struct {
	store         Store
	factory       ReaderFactory
	logger        *slog.Logger
	now           func() time.Time
	interval      time.Duration
	retryAttempts int
	retryDelay    time.Duration
}

type Options struct {
	Store         Store
	Client        *http.Client
	Endpoints     exchange.Endpoints
	Logger        *slog.Logger
	Interval      time.Duration
	Factory       ReaderFactory
	RetryAttempts int
	RetryDelay    time.Duration
}

func New(options Options) *Worker {
	logger := options.Logger
	if logger == nil {
		logger = slog.Default()
	}
	client := options.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	interval := options.Interval
	if interval <= 0 {
		interval = 30 * time.Second
	}
	factory := options.Factory
	if factory == nil {
		factory = func(resolved account.Resolved) (Reader, error) {
			switch resolved.Reference.Provider {
			case domain.ProviderBinance:
				return binanceexchange.New(binanceexchange.Options{
					Credentials: resolved.Credentials, Client: client,
					FuturesURL: options.Endpoints.BinanceFutures, SpotURL: options.Endpoints.BinanceSpot,
				}), nil
			case domain.ProviderBybit:
				return bybitexchange.New(bybitexchange.Options{Credentials: resolved.Credentials, Client: client, BaseURL: options.Endpoints.Bybit}), nil
			default:
				return nil, fmt.Errorf("reconciliation provider %s is not supported", resolved.Reference.Provider)
			}
		}
	}
	retryAttempts := options.RetryAttempts
	if retryAttempts <= 0 {
		retryAttempts = 3
	}
	retryDelay := options.RetryDelay
	if retryDelay <= 0 {
		retryDelay = 100 * time.Millisecond
	}
	return &Worker{store: options.Store, factory: factory, logger: logger, now: time.Now, interval: interval, retryAttempts: retryAttempts, retryDelay: retryDelay}
}

// Initialize performs the startup safety pass. Discovery failures keep the
// whole engine unready; account-specific exchange failures isolate that account.
func (w *Worker) Initialize(ctx context.Context) error {
	accounts, err := w.store.ListReconciliationAccounts(ctx)
	if err != nil {
		return fmt.Errorf("discover reconciliation accounts: %w", err)
	}
	for _, resolved := range accounts {
		w.reconcileAccount(ctx, resolved, "startup")
	}
	return nil
}

func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			accounts, err := w.store.ListReconciliationAccounts(ctx)
			if err != nil {
				w.logger.Warn("reconciliation discovery failed", "error", err)
				continue
			}
			for _, resolved := range accounts {
				w.reconcileAccount(ctx, resolved, "periodic")
			}
		}
	}
}

func (w *Worker) reconcileAccount(ctx context.Context, resolved account.Resolved, reason string) {
	if err := w.reconcile(ctx, resolved, reason); err != nil {
		w.logger.Warn("account reconciliation failed", "account_id", resolved.Reference.ID, "error", err)
		if resolved.Engine == "GO" {
			if markErr := w.store.MarkAccountDegraded(ctx, resolved, "RECONCILIATION_FAILED", w.now()); markErr != nil {
				w.logger.Error("account degradation could not be persisted", "account_id", resolved.Reference.ID, "error", markErr)
			}
		}
	}
}

func (w *Worker) reconcile(ctx context.Context, resolved account.Resolved, reason string) error {
	reader, err := w.factory(resolved)
	if err != nil {
		return err
	}
	openOrders, err := retryRead(ctx, w, reader.GetOpenOrders)
	if err != nil {
		return fmt.Errorf("open-order snapshot: %w", err)
	}
	positions, err := retryRead(ctx, w, reader.GetPositions)
	if err != nil {
		return fmt.Errorf("position snapshot: %w", err)
	}
	localOrders, err := w.store.ListReconciliationOrders(ctx, resolved.Reference.ID)
	if err != nil {
		return err
	}

	openByClientID := make(map[string]domain.Order, len(openOrders))
	for _, order := range openOrders {
		openByClientID[order.ClientOrderID] = order
	}
	corrected := 0
	for _, local := range localOrders {
		if local.Status == domain.OrderSubmitting && !local.ExecutionAttempted {
			changed, applyErr := w.store.ApplyReconciledOrder(ctx, local, domain.Order{
				ClientOrderID: local.ClientOrderID, Symbol: local.Symbol, Status: domain.OrderFailed,
			}, w.now())
			if applyErr != nil {
				return applyErr
			}
			if changed {
				corrected++
			}
			continue
		}
		exchangeOrder, found := openByClientID[local.ClientOrderID]
		if !found {
			exchangeOrder, err = retryRead(ctx, w, func(callContext context.Context) (domain.Order, error) {
				return reader.GetOrderByClientID(callContext, local.Symbol, local.ClientOrderID)
			})
			if err != nil {
				var normalized *exchange.Error
				if errors.As(err, &normalized) && normalized.Normalized.Code == "EXCHANGE_ORDER_NOT_VISIBLE" {
					// The store only exposes orders after a 30-second settlement
					// window. If neither Binance regular nor Algo history contains
					// the idempotent client ID then, finalize the local attempt as
					// failed instead of degrading the whole account.
					exchangeOrder = domain.Order{ClientOrderID: local.ClientOrderID, Symbol: local.Symbol, Status: domain.OrderFailed}
				} else {
					return fmt.Errorf("query order %s by client id: %w", local.ID, err)
				}
			}
		}
		if exchangeOrder.Status == domain.OrderReconciliationRequired {
			return errors.New("exchange returned an unknown order status")
		}
		changed, err := w.store.ApplyReconciledOrder(ctx, local, exchangeOrder, w.now())
		if err != nil {
			return err
		}
		if changed {
			corrected++
		}
	}

	now := w.now().UTC()
	if err := w.store.AppendOutboxEvent(ctx, domain.OutboxEvent{
		UserID: resolved.Reference.UserID, ExchangeAccountID: resolved.Reference.ID,
		Provider: resolved.Reference.Provider, Topic: "trading.snapshot", EventType: "SNAPSHOT_RECONCILED",
		AggregateType: "ACCOUNT", AggregateID: resolved.Reference.ID,
		DeduplicationKey: fmt.Sprintf("%s:reconciliation:%d", resolved.Reference.ID, now.UnixNano()),
		Payload:          map[string]any{"reason": reason, "orders": openOrders, "positions": positions, "correctedOrders": corrected},
		OccurredAt:       now,
	}); err != nil {
		return err
	}
	return w.store.MarkAccountHealthy(ctx, resolved, now)
}

func retryRead[T any](ctx context.Context, worker *Worker, operation func(context.Context) (T, error)) (T, error) {
	var zero T
	for attempt := 1; attempt <= worker.retryAttempts; attempt++ {
		value, err := operation(ctx)
		if err == nil {
			return value, nil
		}
		var normalized *exchange.Error
		if !errors.As(err, &normalized) || !normalized.Normalized.Retryable || attempt == worker.retryAttempts {
			return zero, err
		}
		timer := time.NewTimer(worker.retryDelay * time.Duration(attempt))
		select {
		case <-ctx.Done():
			timer.Stop()
			return zero, ctx.Err()
		case <-timer.C:
		}
	}
	return zero, errors.New("read retry exhausted")
}
