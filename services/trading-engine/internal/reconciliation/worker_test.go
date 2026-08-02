package reconciliation

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type fakeStore struct {
	accounts          []account.Resolved
	orders            []PendingOrder
	discoveryErr      error
	applied           []domain.Order
	degraded, healthy int
	events            []domain.OutboxEvent
}

func (s *fakeStore) ListReconciliationAccounts(context.Context) ([]account.Resolved, error) {
	return s.accounts, s.discoveryErr
}
func (s *fakeStore) ListReconciliationOrders(context.Context, string) ([]PendingOrder, error) {
	return s.orders, nil
}
func (s *fakeStore) ApplyReconciledOrder(_ context.Context, _ PendingOrder, order domain.Order, _ time.Time) (bool, error) {
	s.applied = append(s.applied, order)
	return true, nil
}
func (s *fakeStore) MarkAccountDegraded(context.Context, account.Resolved, string, time.Time) error {
	s.degraded++
	return nil
}
func (s *fakeStore) MarkAccountHealthy(context.Context, account.Resolved, time.Time) error {
	s.healthy++
	return nil
}
func (s *fakeStore) AppendOutboxEvent(_ context.Context, event domain.OutboxEvent) error {
	s.events = append(s.events, event)
	return nil
}

type fakeReader struct {
	open       []domain.Order
	positions  []domain.Position
	queried    domain.Order
	err        error
	queryCalls int
}

func (r *fakeReader) GetOpenOrders(context.Context) ([]domain.Order, error) { return r.open, r.err }
func (r *fakeReader) GetPositions(context.Context) ([]domain.Position, error) {
	return r.positions, nil
}
func (r *fakeReader) GetOrderByClientID(context.Context, string, string) (domain.Order, error) {
	r.queryCalls++
	return r.queried, r.err
}

func TestInitializeReconcilesOpenSnapshotWithoutOrderLookup(t *testing.T) {
	resolved := testAccount("GO")
	store := &fakeStore{accounts: []account.Resolved{resolved}, orders: []PendingOrder{{
		ID: "local-1", UserID: "user-1", ExchangeAccountID: "account-1", ClientOrderID: "kk_1", Symbol: "BTCUSDT", Status: domain.OrderReconciliationRequired, ExecutionAttempted: true,
	}}}
	reader := &fakeReader{open: []domain.Order{{ClientOrderID: "kk_1", ExchangeOrderID: "42", Symbol: "BTCUSDT", Status: domain.OrderOpen}}}
	worker := New(Options{Store: store, Factory: func(account.Resolved) (Reader, error) { return reader, nil }})
	if err := worker.Initialize(t.Context()); err != nil {
		t.Fatal(err)
	}
	if reader.queryCalls != 0 || len(store.applied) != 1 || store.applied[0].Status != domain.OrderOpen || store.healthy != 1 || store.degraded != 0 {
		t.Fatalf("unexpected reconciliation: reader=%#v store=%#v", reader, store)
	}
	if len(store.events) != 1 || store.events[0].EventType != "SNAPSHOT_RECONCILED" {
		t.Fatalf("snapshot event missing: %#v", store.events)
	}
}

func TestInitializeQueriesTerminalOrderByClientID(t *testing.T) {
	store := &fakeStore{accounts: []account.Resolved{testAccount("GO")}, orders: []PendingOrder{{
		ID: "local-1", ClientOrderID: "kk_1", Symbol: "BTCUSDT", Status: domain.OrderReconciliationRequired, ExecutionAttempted: true,
	}}}
	reader := &fakeReader{queried: domain.Order{ClientOrderID: "kk_1", ExchangeOrderID: "42", Symbol: "BTCUSDT", Status: domain.OrderFilled}}
	worker := New(Options{Store: store, Factory: func(account.Resolved) (Reader, error) { return reader, nil }})
	if err := worker.Initialize(t.Context()); err != nil {
		t.Fatal(err)
	}
	if reader.queryCalls != 1 || len(store.applied) != 1 || store.applied[0].Status != domain.OrderFilled {
		t.Fatalf("terminal order was not reconciled")
	}
}

func TestUnattemptedSubmissionFailsLocallyWithoutExchangeLookup(t *testing.T) {
	store := &fakeStore{accounts: []account.Resolved{testAccount("GO")}, orders: []PendingOrder{{
		ID: "local-1", ClientOrderID: "kk_1", Symbol: "BTCUSDT", Status: domain.OrderSubmitting,
	}}}
	reader := &fakeReader{}
	worker := New(Options{Store: store, Factory: func(account.Resolved) (Reader, error) { return reader, nil }})
	if err := worker.Initialize(t.Context()); err != nil {
		t.Fatal(err)
	}
	if reader.queryCalls != 0 || len(store.applied) != 1 || store.applied[0].Status != domain.OrderFailed {
		t.Fatalf("unattempted order was not safely finalized")
	}
}

func TestAccountFailureDegradesOnlyGoExecutor(t *testing.T) {
	for _, engine := range []string{"GO", "TYPESCRIPT"} {
		store := &fakeStore{accounts: []account.Resolved{testAccount(engine)}}
		reader := &fakeReader{err: errors.New("exchange unavailable")}
		worker := New(Options{Store: store, Factory: func(account.Resolved) (Reader, error) { return reader, nil }})
		if err := worker.Initialize(t.Context()); err != nil {
			t.Fatal(err)
		}
		expected := 0
		if engine == "GO" {
			expected = 1
		}
		if store.degraded != expected {
			t.Fatalf("engine %s degradation=%d want=%d", engine, store.degraded, expected)
		}
	}
}

func TestDiscoveryFailureKeepsStartupUnready(t *testing.T) {
	worker := New(Options{Store: &fakeStore{discoveryErr: errors.New("database unavailable")}})
	if err := worker.Initialize(t.Context()); err == nil {
		t.Fatal("expected startup discovery failure")
	}
}

func testAccount(engine string) account.Resolved {
	return account.Resolved{Reference: domain.ExchangeAccountRef{ID: "account-1", UserID: "user-1", Provider: domain.ProviderBinance}, Engine: engine, ConnectionStatus: "CONNECTED"}
}
