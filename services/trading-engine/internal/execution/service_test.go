package execution

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	tradingv1 "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/api/v1"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/risk"
)

var fixedTime = time.Date(2026, 8, 1, 20, 0, 0, 0, time.UTC)

func TestPlaceClaimsAndExecutesExactlyOnce(t *testing.T) {
	store := &fakeStore{claim: ClaimAcquired, order: sampleStoredOrder()}
	writer := &fakeWriter{placed: domain.Order{ExchangeOrderID: "exchange-1", ClientOrderID: "kk_123", Symbol: "BTCUSDT", Status: domain.OrderOpen}}
	service := testService(store, writer)
	result, replay, err := service.Place(t.Context(), samplePlaceCommand())
	if err != nil || replay || result.ExchangeOrderID != "exchange-1" {
		t.Fatalf("unexpected place result: %#v replay=%v err=%v", result, replay, err)
	}
	if writer.configureCalls != 1 || writer.placeCalls != 1 || store.completeCalls != 1 {
		t.Fatalf("expected one execution: writer=%#v store=%#v", writer, store)
	}
}

func TestPlaceReplayNeverWritesToExchange(t *testing.T) {
	stored := sampleStoredOrder()
	stored.ExchangeOrderID = "exchange-existing"
	stored.Status = domain.OrderOpen
	store := &fakeStore{claim: ClaimCompletedReplay, order: stored}
	writer := &fakeWriter{}
	result, replay, err := testService(store, writer).Place(t.Context(), samplePlaceCommand())
	if err != nil || !replay || result.ExchangeOrderID != "exchange-existing" || writer.placeCalls != 0 {
		t.Fatalf("replay attempted exchange write: result=%#v replay=%v calls=%d err=%v", result, replay, writer.placeCalls, err)
	}
}

func TestPlaceRejectsStoredCommandMismatch(t *testing.T) {
	store := &fakeStore{claim: ClaimAcquired, order: sampleStoredOrder()}
	writer := &fakeWriter{}
	command := samplePlaceCommand()
	command.Quantity = "9"
	_, _, err := testService(store, writer).Place(t.Context(), command)
	if err == nil || writer.placeCalls != 0 || store.failCalls != 1 {
		t.Fatalf("mismatched command was not safely rejected: calls=%d failures=%d err=%v", writer.placeCalls, store.failCalls, err)
	}
}

func TestPlaceRiskRejectionNeverWritesToExchange(t *testing.T) {
	store := &fakeStore{claim: ClaimAcquired, order: sampleStoredOrder()}
	writer := &fakeWriter{markPrice: "50000"}
	service := testService(store, writer)
	service.risk = &fakeRisk{decision: risk.Decision{Status: "REJECTED", Code: "RISK_MAX_LEVERAGE_EXCEEDED", Message: "risk rejected"}}
	_, _, err := service.Place(t.Context(), samplePlaceCommand())
	if err == nil || writer.configureCalls != 0 || writer.placeCalls != 0 || store.failCalls != 1 {
		t.Fatalf("risk rejection reached exchange: writer=%#v failures=%d err=%v", writer, store.failCalls, err)
	}
}

func TestPlaceRejectsStaleCommandBeforeClaimOrExchange(t *testing.T) {
	store := &fakeStore{claim: ClaimAcquired, order: sampleStoredOrder()}
	writer := &fakeWriter{}
	command := samplePlaceCommand()
	command.Meta.RequestedAt = fixedTime.Add(-maximumCommandAge - time.Millisecond)
	_, _, err := testService(store, writer).Place(t.Context(), command)
	if err == nil || store.claimCalls != 0 || writer.placeCalls != 0 {
		t.Fatalf("stale command was not rejected before execution: store=%#v writer=%#v err=%v", store, writer, err)
	}
}

func TestPlaceRequiresVerifiableStopResponse(t *testing.T) {
	stored := sampleStoredOrder()
	stored.Type, stored.StopPrice = domain.OrderStopMarket, "49000"
	store := &fakeStore{claim: ClaimAcquired, order: stored}
	writer := &fakeWriter{placed: domain.Order{ExchangeOrderID: "exchange-1", ClientOrderID: "kk_123", Symbol: "BTCUSDT", Type: domain.OrderStopMarket, StopPrice: "48000", Status: domain.OrderOpen}}
	command := samplePlaceCommand()
	command.Type, command.StopPrice = domain.OrderStopMarket, "49000"
	_, _, err := testService(store, writer).Place(t.Context(), command)
	if err == nil || store.failCalls != 1 || store.lastFailure.Code != "INVALID_EXCHANGE_RESPONSE" || !store.lastFailure.Reconciliation || store.completeCalls != 0 {
		t.Fatalf("unverified stop response was not isolated: store=%#v err=%v", store, err)
	}
}

func TestPlaceCommitFailureRequiresReconciliation(t *testing.T) {
	store := &fakeStore{claim: ClaimAcquired, order: sampleStoredOrder(), completeErr: errors.New("database unavailable")}
	writer := &fakeWriter{placed: domain.Order{ExchangeOrderID: "exchange-1", ClientOrderID: "kk_123", Symbol: "BTCUSDT", Status: domain.OrderOpen}}
	_, _, err := testService(store, writer).Place(t.Context(), samplePlaceCommand())
	if err == nil || store.failCalls != 1 || !store.lastFailure.Reconciliation {
		t.Fatalf("partial persistence failure was not marked for reconciliation: store=%#v err=%v", store, err)
	}
}

func TestCancelReplayNeverWritesToExchange(t *testing.T) {
	stored := sampleStoredOrder()
	stored.Status = domain.OrderCanceled
	store := &fakeStore{cancelClaim: ClaimCompletedReplay, order: stored}
	writer := &fakeWriter{}
	command := tradingv1.CancelOrderCommand{
		Meta: sampleMeta("cancel-idempotency-123", "kkc_123"), Account: sampleAccount(),
		Symbol: stored.Symbol, ExchangeOrderID: stored.ExchangeOrderID,
	}
	result, replay, err := testService(store, writer).Cancel(t.Context(), command)
	if err != nil || !replay || result.Status != domain.OrderCanceled || writer.cancelCalls != 0 {
		t.Fatalf("cancel replay attempted exchange write: %#v replay=%v err=%v", result, replay, err)
	}
}

func TestPreviewUsesStringDecimalRules(t *testing.T) {
	store := &fakeStore{}
	writer := &fakeWriter{symbols: []domain.SymbolRule{{
		Symbol: "BTCUSDT", TickSize: "0.1", StepSize: "0.001", MinQuantity: "0.001", MaxQuantity: "100", MinNotional: "5", MaxLeverage: 20,
	}}, markPrice: "50000"}
	service := testService(store, writer)
	result, err := service.Preview(t.Context(), tradingv1.PreviewOrderRequest{
		Account: sampleAccount(), Symbol: "BTCUSDT", Side: domain.SideBuy, Type: domain.OrderMarket,
		Quantity: "0.001", Leverage: 10, MarginMode: domain.MarginIsolated,
	})
	if err != nil || result.EstimatedNotional != "50" {
		t.Fatalf("unexpected preview: %#v err=%v", result, err)
	}
}

func testService(store *fakeStore, writer *fakeWriter) *Service {
	return NewWithFactory(store, store, &fakeRisk{decision: risk.Decision{Status: "APPROVED", Code: "RISK_APPROVED"}}, func(account.Resolved) (exchange.Writer, error) { return writer, nil }, func() time.Time { return fixedTime })
}

func sampleAccount() domain.ExchangeAccountRef {
	return domain.ExchangeAccountRef{ID: "account-1", UserID: "user-1", Provider: domain.ProviderBinance, Environment: domain.EnvironmentTestnet, AccountType: domain.AccountTypeUSDTM}
}

func sampleMeta(idempotency, clientID string) tradingv1.CommandMeta {
	return tradingv1.CommandMeta{RequestID: "request-1", ActorUserID: "user-1", IdempotencyKey: idempotency, ClientOrderID: clientID, RequestedAt: fixedTime}
}

func samplePlaceCommand() tradingv1.PlaceOrderCommand {
	return tradingv1.PlaceOrderCommand{
		Meta: sampleMeta("place-idempotency-123", "kk_123"), TradingOrderID: "order-1", Account: sampleAccount(),
		Symbol: "BTCUSDT", Side: domain.SideBuy, Type: domain.OrderMarket, Quantity: "0.01", Leverage: 10, MarginMode: domain.MarginIsolated,
	}
}

func sampleStoredOrder() StoredOrder {
	return StoredOrder{ID: "order-1", UserID: "user-1", ExchangeAccountID: "account-1", IdempotencyKey: "place-idempotency-123",
		ClientOrderID: "kk_123", ExchangeOrderID: "exchange-1", Symbol: "BTCUSDT", Side: domain.SideBuy, Type: domain.OrderMarket,
		Quantity: "0.01", Leverage: 10, MarginMode: domain.MarginIsolated, Status: domain.OrderSubmitting}
}

type fakeStore struct {
	claim, cancelClaim                   ClaimResult
	order                                StoredOrder
	claimCalls, completeCalls, failCalls int
	completeErr                          error
	lastFailure                          domain.ExchangeError
}

func (s *fakeStore) Resolve(context.Context, string, string) (account.Resolved, error) {
	return account.Resolved{Reference: sampleAccount(), Engine: "GO", ConnectionStatus: "CONNECTED"}, nil
}
func (s *fakeStore) Claim(context.Context, string, string, string, string, string, time.Time) (StoredOrder, ClaimResult, error) {
	s.claimCalls++
	return s.order, s.claim, nil
}
func (s *fakeStore) Complete(context.Context, StoredOrder, domain.Order, time.Time) error {
	s.completeCalls++
	return s.completeErr
}
func (s *fakeStore) Fail(_ context.Context, _ StoredOrder, failure domain.ExchangeError, _ time.Time) error {
	s.failCalls++
	s.lastFailure = failure
	return nil
}
func (s *fakeStore) ClaimCancel(context.Context, string, string, string, string, string, time.Time) (StoredOrder, ClaimResult, error) {
	return s.order, s.cancelClaim, nil
}
func (s *fakeStore) CompleteCancel(context.Context, StoredOrder, time.Time) error { return nil }
func (s *fakeStore) FailCancel(context.Context, StoredOrder, domain.ExchangeError, time.Time) error {
	return nil
}

type fakeWriter struct {
	symbols                                 []domain.SymbolRule
	markPrice                               domain.Decimal
	placed                                  domain.Order
	configureCalls, placeCalls, cancelCalls int
}

type fakeRisk struct {
	decision risk.Decision
	err      error
}

func (r *fakeRisk) Evaluate(context.Context, account.Resolved, risk.OrderInput, risk.MarketReader) (risk.Decision, error) {
	return r.decision, r.err
}

func (w *fakeWriter) GetBalances(context.Context) ([]domain.Balance, error)   { return nil, nil }
func (w *fakeWriter) GetSymbols(context.Context) ([]domain.SymbolRule, error) { return w.symbols, nil }
func (w *fakeWriter) GetOpenOrders(context.Context) ([]domain.Order, error)   { return nil, nil }
func (w *fakeWriter) GetPositions(context.Context) ([]domain.Position, error) { return nil, nil }
func (w *fakeWriter) GetMarkPrice(context.Context, string) (domain.Decimal, error) {
	return w.markPrice, nil
}
func (w *fakeWriter) ConfigurePosition(context.Context, string, int, domain.MarginMode) error {
	w.configureCalls++
	return nil
}
func (w *fakeWriter) PlaceOrder(context.Context, exchange.PlaceOrderInput) (domain.Order, error) {
	w.placeCalls++
	return w.placed, nil
}
func (w *fakeWriter) CancelOrder(context.Context, string, string) (domain.Order, error) {
	w.cancelCalls++
	return domain.Order{Status: domain.OrderCanceled}, nil
}
