package autonomousexecution

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	tradingv1 "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/api/v1"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	mysqlstore "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/storage/mysql"
)

type fakeStore struct {
	orders        []mysqlstore.AutonomousOrderInput
	reentryGuards int
	guardCandle   int64
	guardReason   string
}

func (s *fakeStore) CreateAutonomousOrder(_ context.Context, _ bot.Instance, order mysqlstore.AutonomousOrderInput, _ time.Time) error {
	s.orders = append(s.orders, order)
	return nil
}
func (s *fakeStore) MarkAutonomousExecution(context.Context, int64, bool, string) error { return nil }
func (s *fakeStore) MarkAutonomousExecutionFailure(context.Context, int64, string, string, string) error {
	return nil
}

func (s *fakeStore) MarkAutonomousReentryGuard(_ context.Context, _ bot.Instance, candle int64, reason string, _ time.Time) error {
	s.reentryGuards++
	s.guardCandle = candle
	s.guardReason = reason
	return nil
}
func (s *fakeStore) ClearManualPositionControl(context.Context, bot.Instance, domain.PositionSide, time.Time) error {
	return nil
}

type fakeExecution struct {
	positions           []domain.Position
	positionsAfterPlace []domain.Position
	orders              []domain.Order
	commands            []tradingv1.PlaceOrderCommand
	previews            []tradingv1.PreviewOrderRequest
	cancels             []tradingv1.CancelOrderCommand
	marketMark          domain.Decimal
}

func (e *fakeExecution) OpenOrders(context.Context, domain.ExchangeAccountRef) ([]domain.Order, error) {
	return e.orders, nil
}
func (e *fakeExecution) MarketRule(context.Context, domain.ExchangeAccountRef, string) (domain.SymbolRule, domain.Decimal, error) {
	mark := e.marketMark
	if mark == "" {
		mark = "2500"
	}
	return domain.SymbolRule{StepSize: "0.001", MinQuantity: "0.001", MinNotional: "5"}, mark, nil
}

func (e *fakeExecution) Positions(context.Context, domain.ExchangeAccountRef) ([]domain.Position, error) {
	if len(e.commands) > 0 && e.positionsAfterPlace != nil {
		return e.positionsAfterPlace, nil
	}
	for _, command := range e.commands {
		if !command.ReduceOnly && command.Type == domain.OrderMarket {
			return []domain.Position{{Symbol: command.Symbol, Side: positionSideForOrder(command.Side, false), Quantity: command.Quantity, EntryPrice: "2500", MarkPrice: "2500", Leverage: domain.Decimal("5")}}, nil
		}
	}
	return e.positions, nil
}
func (e *fakeExecution) Cancel(_ context.Context, command tradingv1.CancelOrderCommand) (domain.Order, bool, error) {
	e.cancels = append(e.cancels, command)
	return domain.Order{ExchangeOrderID: command.ExchangeOrderID, Symbol: command.Symbol, Status: domain.OrderCanceled}, false, nil
}
func (e *fakeExecution) Preview(_ context.Context, request tradingv1.PreviewOrderRequest) (tradingv1.PreviewOrderResponse, error) {
	e.previews = append(e.previews, request)
	return tradingv1.PreviewOrderResponse{Request: request, Rule: domain.SymbolRule{TickSize: "0.01"}}, nil
}
func (e *fakeExecution) Place(_ context.Context, command tradingv1.PlaceOrderCommand) (domain.Order, bool, error) {
	e.commands = append(e.commands, command)
	return domain.Order{ExchangeOrderID: "test", ClientOrderID: command.Meta.ClientOrderID, Symbol: command.Symbol, Status: domain.OrderFilled}, false, nil
}

func TestExecutorPlacesEntryAndReduceOnlyProtectiveStop(t *testing.T) {
	store, exchange := &fakeStore{}, &fakeExecution{}
	executor := &Executor{store: store, execution: exchange}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": 5}}
	if err := executor.Execute(t.Context(), instance, decision, 42, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.commands) != 3 || exchange.commands[0].Type != domain.OrderMarket || exchange.commands[1].Type != domain.OrderStopMarket || exchange.commands[2].Type != domain.OrderTakeProfitMarket || !exchange.commands[1].ReduceOnly || !exchange.commands[2].ReduceOnly {
		t.Fatalf("unsafe command sequence: %#v", exchange.commands)
	}
	if len(store.orders) != 3 {
		t.Fatalf("expected three persisted orders, got %d", len(store.orders))
	}
	if len(exchange.previews) != 3 || exchange.previews[1].StopPrice != "2400.00" || exchange.previews[2].StopPrice != "2700.00" {
		t.Fatalf("protective stop was not preflighted: %#v", exchange.previews)
	}
}

func TestAlignStopPriceUsesProtectiveDirection(t *testing.T) {
	buy, _ := alignStopPrice("2535.324146", "0.01", domain.SideBuy)
	sell, _ := alignStopPrice("2500.129", "0.01", domain.SideSell)
	if buy != "2535.33" || sell != "2500.12" {
		t.Fatalf("unexpected aligned stops buy=%s sell=%s", buy, sell)
	}
}

func TestExecutorImmediatelyReentersAfterExchangePositionDisappears(t *testing.T) {
	store, exchange := &fakeStore{}, &fakeExecution{}
	executor := &Executor{store: store, execution: exchange}
	executor.setPositionOpen("account-1:BTCUSDT")
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "BTCUSDT"}
	decision := bot.Decision{
		HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "70000", "takeProfit": "80000", "leverage": 5},
		Metrics:           map[string]any{"marketDataOpenTimeMs": int64(1_777_000_000_000)},
	}
	if err := executor.Execute(t.Context(), instance, decision, 44, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if store.reentryGuards != 0 {
		t.Fatalf("external close must not create a candle-long guard, got %#v", store)
	}
	if len(exchange.commands) != 3 || exchange.commands[0].Type != domain.OrderMarket {
		t.Fatalf("valid signal was not immediately sent after external close: %#v", exchange.commands)
	}
}

func TestManualLimitClosePendingOnlyMatchesReduceOnlyManualLimit(t *testing.T) {
	orders := []domain.Order{{Symbol: "ETHUSDT", Type: domain.OrderLimit, ReduceOnly: true, ClientOrderID: "kk_manual_close"}}
	if !manualLimitClosePending(orders, "ETHUSDT") {
		t.Fatal("expected manual reduce-only LIMIT close to suspend additions")
	}
	orders[0].ReduceOnly = false
	if manualLimitClosePending(orders, "ETHUSDT") {
		t.Fatal("non-reduce-only limit must not be treated as a close")
	}
}

func TestConfiguredMinimumMarginRoundsUpAfterExchangeStepAlignment(t *testing.T) {
	quantity, err := enforceConfiguredMinimumMargin("13.1", 8500, 17,
		map[string]any{"testnetMarginAllocationMode": true, "minimumInitialMarginUsdt": float64(100)},
		domain.SymbolRule{StepSize: "0.1", MinQuantity: "0.1", MinNotional: "5"}, "129.1")
	if err != nil || quantity != "13.2" {
		t.Fatalf("minimum margin was not rounded up safely: quantity=%s err=%v", quantity, err)
	}
}

func TestExecutorRepairsUnprotectedPositionBeforePyramiding(t *testing.T) {
	store := &fakeStore{}
	exchange := &fakeExecution{positions: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.01", EntryPrice: "2500", Leverage: "1"}}}
	executor := &Executor{store: store, execution: exchange}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	instance.Configuration = map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100)}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": 5}}
	if err := executor.Execute(t.Context(), instance, decision, 43, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.commands) != 2 || exchange.commands[0].Type != domain.OrderStopMarket || exchange.commands[1].Type != domain.OrderTakeProfitMarket {
		t.Fatalf("existing position protection was not repaired: %#v", exchange.commands)
	}
}

func TestExecutorPyramidsSameDirectionWithinAllocationAndResizesProtection(t *testing.T) {
	store := &fakeStore{}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	instance.Configuration = map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100), "allocationUsdt": float64(100), "positionNotionalPct": float64(.10), "pyramidingEnabled": true, "hedgeModeEnabled": true}
	prefix := botClientPrefix(instance.ID)
	exchange := &fakeExecution{
		positions: []domain.Position{
			{Symbol: "ETHUSDT", Side: domain.PositionShort, Quantity: "0.01", EntryPrice: "2550", MarkPrice: "2500", Leverage: "7"},
			{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.02", EntryPrice: "2500", MarkPrice: "2500", Leverage: "7"},
		},
		positionsAfterPlace: []domain.Position{
			{Symbol: "ETHUSDT", Side: domain.PositionShort, Quantity: "0.01", EntryPrice: "2550", MarkPrice: "2500", Leverage: "7"},
			{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.024", EntryPrice: "2500", MarkPrice: "2500", Leverage: "7"},
		},
		orders: []domain.Order{
			{ExchangeOrderID: "old-stop", ClientOrderID: prefix + "olds", Symbol: "ETHUSDT", PositionSide: domain.PositionLong, Type: domain.OrderStopMarket, Quantity: "0.02"},
			{ExchangeOrderID: "old-take", ClientOrderID: prefix + "oldt", Symbol: "ETHUSDT", PositionSide: domain.PositionLong, Type: domain.OrderTakeProfitMarket, Quantity: "0.02"},
		},
	}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": 19}}
	if err := (&Executor{store: store, execution: exchange}).Execute(t.Context(), instance, decision, 46, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.commands) != 3 || exchange.commands[0].Quantity != "0.010" || exchange.commands[0].ReduceOnly || exchange.commands[1].Quantity != "0.024" || !exchange.commands[1].ReduceOnly || exchange.commands[2].Quantity != "0.024" {
		t.Fatalf("unexpected pyramid command sequence: %#v", exchange.commands)
	}
	for _, command := range exchange.commands {
		if command.Leverage != 7 {
			t.Fatalf("pyramid must preserve open isolated position leverage, got %d", command.Leverage)
		}
		if command.PositionSide != domain.PositionLong {
			t.Fatalf("pyramid entry/protection must stay on the owned LONG hedge leg, got %s", command.PositionSide)
		}
	}
	if !exchange.commands[0].PositionConfigurationVerified {
		t.Fatal("pyramid entry must carry in-process position configuration proof")
	}
	if len(exchange.cancels) != 2 || len(store.orders) != 3 {
		t.Fatalf("full-position protection was not resized: cancels=%d stored=%d", len(exchange.cancels), len(store.orders))
	}
}

func TestExecutorOpeningOppositeHedgeLegPreservesExistingProtection(t *testing.T) {
	store := &fakeStore{}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	instance.Configuration = map[string]any{"hedgeModeEnabled": true}
	prefix := botClientPrefix(instance.ID)
	exchange := &fakeExecution{
		positions: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionShort, Quantity: "0.02", EntryPrice: "2500", MarkPrice: "2520", Leverage: "5"}},
		orders: []domain.Order{
			{ExchangeOrderID: "short-stop", ClientOrderID: prefix + "shorts", Symbol: "ETHUSDT", PositionSide: domain.PositionShort, Type: domain.OrderStopMarket, Quantity: "0.02", ReduceOnly: true},
			{ExchangeOrderID: "short-take", ClientOrderID: prefix + "shortt", Symbol: "ETHUSDT", PositionSide: domain.PositionShort, Type: domain.OrderTakeProfitMarket, Quantity: "0.02", ReduceOnly: true},
		},
	}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": 5}}
	if err := (&Executor{store: store, execution: exchange}).Execute(t.Context(), instance, decision, 461, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.cancels) != 0 {
		t.Fatalf("opening LONG hedge leg canceled SHORT protection: %#v", exchange.cancels)
	}
	if len(exchange.commands) != 3 || exchange.commands[0].PositionSide != domain.PositionLong || exchange.commands[1].PositionSide != domain.PositionLong || exchange.commands[2].PositionSide != domain.PositionLong {
		t.Fatalf("opposite hedge leg was not opened and protected independently: %#v", exchange.commands)
	}
}

func TestExecutorClosesPyramidedPositionWhenTargetCrossesDuringFill(t *testing.T) {
	store := &fakeStore{}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	instance.Configuration = map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100), "allocationUsdt": float64(100), "positionNotionalPct": float64(.10), "pyramidingEnabled": true}
	prefix := botClientPrefix(instance.ID)
	exchange := &fakeExecution{
		positions:           []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.02", EntryPrice: "2500", MarkPrice: "2500", Leverage: "7"}},
		positionsAfterPlace: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.024", EntryPrice: "2500", MarkPrice: "2530", Leverage: "7"}},
		orders: []domain.Order{
			{ExchangeOrderID: "old-stop", ClientOrderID: prefix + "olds", Symbol: "ETHUSDT", Type: domain.OrderStopMarket, Quantity: "0.02"},
			{ExchangeOrderID: "old-take", ClientOrderID: prefix + "oldt", Symbol: "ETHUSDT", Type: domain.OrderTakeProfitMarket, Quantity: "0.02"},
		},
	}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": 19}}
	if err := (&Executor{store: store, execution: exchange}).Execute(t.Context(), instance, decision, 48, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.commands) != 2 || exchange.commands[0].ReduceOnly || !exchange.commands[1].ReduceOnly || exchange.commands[1].Type != domain.OrderMarket || exchange.commands[1].Quantity != "0.024" {
		t.Fatalf("crossed target must close the full updated position: %#v", exchange.commands)
	}
	if len(exchange.cancels) != 2 {
		t.Fatalf("old protections were not cleaned up: %#v", exchange.cancels)
	}
}

func TestExecutorDoesNotPyramidOppositeSignalOrExhaustedAllocation(t *testing.T) {
	for _, test := range []struct {
		name       string
		side       string
		quantity   domain.Decimal
		allocation float64
	}{
		{name: "opposite signal", side: "SELL", quantity: "0.02", allocation: 100},
		{name: "allocation exhausted", side: "BUY", quantity: "0.04", allocation: 100},
	} {
		t.Run(test.name, func(t *testing.T) {
			instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
			instance.Configuration = map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100), "allocationUsdt": test.allocation, "positionNotionalPct": float64(.10), "pyramidingEnabled": true}
			prefix := botClientPrefix(instance.ID)
			exchange := &fakeExecution{
				positions: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: test.quantity, EntryPrice: "2500", MarkPrice: "2500", Leverage: "5"}},
				orders: []domain.Order{
					{ExchangeOrderID: "old-stop", ClientOrderID: prefix + "olds", Symbol: "ETHUSDT", Type: domain.OrderStopMarket, Quantity: test.quantity},
					{ExchangeOrderID: "old-take", ClientOrderID: prefix + "oldt", Symbol: "ETHUSDT", Type: domain.OrderTakeProfitMarket, Quantity: test.quantity},
				},
			}
			decision := bot.Decision{HypotheticalOrder: map[string]any{"side": test.side, "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": 5}}
			if err := (&Executor{store: &fakeStore{}, execution: exchange}).Execute(t.Context(), instance, decision, 47, time.Now().UTC()); err != nil {
				t.Fatal(err)
			}
			if len(exchange.commands) != 0 || len(exchange.cancels) != 0 {
				t.Fatalf("position should not have been pyramided: commands=%#v cancels=%#v", exchange.commands, exchange.cancels)
			}
		})
	}
}

func TestExecutorTrendGridAddsOnlyAfterFavorableLevel(t *testing.T) {
	for _, test := range []struct {
		name         string
		mark         domain.Decimal
		wantCommands int
	}{
		{name: "inside step", mark: "2504", wantCommands: 0},
		{name: "next favorable level", mark: "2507", wantCommands: 3},
	} {
		t.Run(test.name, func(t *testing.T) {
			store := &fakeStore{}
			instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT", Configuration: map[string]any{
				"stopLossBps": float64(75), "takeProfitBps": float64(300), "allocationUsdt": float64(100), "pyramidingEnabled": true,
				"testnetTrendGridEnabled": true, "testnetGridStepBps": float64(25),
			}}
			prefix := botClientPrefix(instance.ID)
			exchange := &fakeExecution{marketMark: test.mark,
				positions:           []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.02", EntryPrice: "2500", MarkPrice: test.mark, Leverage: "7"}},
				positionsAfterPlace: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.024", EntryPrice: "2501", MarkPrice: test.mark, Leverage: "7"}},
				orders:              []domain.Order{{ExchangeOrderID: "stop", ClientOrderID: prefix + "s", Symbol: "ETHUSDT", Type: domain.OrderStopMarket, Quantity: "0.02"}, {ExchangeOrderID: "take", ClientOrderID: prefix + "t", Symbol: "ETHUSDT", Type: domain.OrderTakeProfitMarket, Quantity: "0.02"}},
			}
			decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.004", "stopLoss": "2400", "takeProfit": "2700", "leverage": 7}}
			if err := (&Executor{store: store, execution: exchange}).Execute(t.Context(), instance, decision, 49, time.Now().UTC()); err != nil {
				t.Fatal(err)
			}
			if len(exchange.commands) != test.wantCommands {
				t.Fatalf("unexpected grid command count: %d", len(exchange.commands))
			}
		})
	}
}

func TestExecutorClosesExistingPositionWhenTakeProfitWasAlreadyReached(t *testing.T) {
	store := &fakeStore{}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	instance.Configuration = map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100)}
	prefix := botClientPrefix(instance.ID)
	exchange := &fakeExecution{
		positions: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionShort, Quantity: "0.01", EntryPrice: "2500", MarkPrice: "2400", Leverage: "1"}},
		orders:    []domain.Order{{ExchangeOrderID: "algo-stop", ClientOrderID: prefix + "olds", Symbol: "ETHUSDT", Type: domain.OrderStopMarket}},
	}
	executor := &Executor{store: store, execution: exchange}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": 5}}
	if err := executor.Execute(t.Context(), instance, decision, 45, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.commands) != 1 || exchange.commands[0].Type != domain.OrderMarket || !exchange.commands[0].ReduceOnly || exchange.commands[0].Side != domain.SideBuy {
		t.Fatalf("reached target did not produce one reduce-only close: %#v", exchange.commands)
	}
	if len(exchange.cancels) != 1 || len(store.orders) != 1 {
		t.Fatalf("expected persisted close and stale protection cleanup: orders=%d cancels=%d", len(store.orders), len(exchange.cancels))
	}
}

func TestMaintainerClosesReachedTakeProfitOnHoldDecision(t *testing.T) {
	store := &fakeStore{}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT", Configuration: map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100)}}
	prefix := botClientPrefix(instance.ID)
	exchangeClient := &fakeExecution{
		positions: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.01", EntryPrice: "2500", MarkPrice: "2525", Leverage: "5"}},
		orders:    []domain.Order{{ExchangeOrderID: "take", ClientOrderID: prefix + "t", Symbol: "ETHUSDT", Type: domain.OrderTakeProfitMarket, Quantity: "0.01"}},
	}
	if err := (&Executor{store: store, execution: exchangeClient}).MaintainPosition(t.Context(), instance, 46, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchangeClient.commands) != 1 || exchangeClient.commands[0].Type != domain.OrderMarket || !exchangeClient.commands[0].ReduceOnly {
		t.Fatalf("HOLD-cycle maintenance did not close reached TP: %#v", exchangeClient.commands)
	}
}

func TestExecutionFailureProducesExplicitOutcome(t *testing.T) {
	status, code, _ := executionFailure(exchange.NewError(domain.ErrorRejected, "INSUFFICIENT_BALANCE", "-2019", false, false))
	if status != "INSUFFICIENT_BALANCE" || code != "INSUFFICIENT_BALANCE" {
		t.Fatalf("unexpected balance outcome: %s %s", status, code)
	}
	status, code, _ = executionFailure(fmt.Errorf("position sync: %w", exchange.NewError(domain.ErrorUnavailable, "EXCHANGE_UNAVAILABLE", "", true, false)))
	if status != "RETRYING" || code != "EXCHANGE_UNAVAILABLE" {
		t.Fatalf("unexpected retry outcome: %s %s", status, code)
	}
	status, code, _ = executionFailure(exchange.NewError(domain.ErrorRejected, "RISK_ORDER_RATE_EXCEEDED", "", false, false))
	if status != "RETRYING" || code != "RISK_ORDER_RATE_EXCEEDED" {
		t.Fatalf("unexpected application rate-limit outcome: %s %s", status, code)
	}
	status, _, _ = executionFailure(errors.New("invalid autonomous side"))
	if status != "REJECTED" {
		t.Fatalf("unexpected permanent failure outcome: %s", status)
	}
}

func TestReachedProtectionBoundaries(t *testing.T) {
	for _, test := range []struct {
		position domain.Position
		want     string
	}{
		{domain.Position{Side: domain.PositionLong, MarkPrice: "99"}, "stop-loss"},
		{domain.Position{Side: domain.PositionLong, MarkPrice: "111"}, "take-profit"},
		{domain.Position{Side: domain.PositionShort, MarkPrice: "101"}, "stop-loss"},
		{domain.Position{Side: domain.PositionShort, MarkPrice: "89"}, "take-profit"},
	} {
		got, reached := reachedProtection(test.position, "100", "110")
		if test.position.Side == domain.PositionShort {
			got, reached = reachedProtection(test.position, "100", "90")
		}
		if !reached || got != test.want {
			t.Fatalf("unexpected protection result: got=%q reached=%v want=%q", got, reached, test.want)
		}
	}
}

func TestExecutorClosesReachedTargetEvenWhenBothConditionalOrdersStillAppearOpen(t *testing.T) {
	store := &fakeStore{}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	instance.Configuration = map[string]any{"stopLossBps": float64(200), "takeProfitBps": float64(250)}
	prefix := botClientPrefix(instance.ID)
	exchange := &fakeExecution{
		positions: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.01", EntryPrice: "2500", MarkPrice: "2563", Leverage: "5"}},
		orders: []domain.Order{
			{ExchangeOrderID: "algo-stop", ClientOrderID: prefix + "stop", Symbol: "ETHUSDT", Type: domain.OrderStopMarket, Quantity: "0.01"},
			{ExchangeOrderID: "algo-take", ClientOrderID: prefix + "take", Symbol: "ETHUSDT", Type: domain.OrderTakeProfitMarket, Quantity: "0.01"},
		},
	}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2450", "takeProfit": "2562.5", "leverage": 5}}
	if err := (&Executor{store: store, execution: exchange}).Execute(t.Context(), instance, decision, 49, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.commands) != 1 || exchange.commands[0].Type != domain.OrderMarket || !exchange.commands[0].ReduceOnly {
		t.Fatalf("reached target did not produce one reduce-only fallback close: %#v", exchange.commands)
	}
	if len(exchange.cancels) != 2 {
		t.Fatalf("stale conditional orders were not removed after fallback close: %#v", exchange.cancels)
	}
}

func TestExecutorReplacesExistingProtectionWhenCentralTargetsChange(t *testing.T) {
	store := &fakeStore{}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	instance.Configuration = map[string]any{"stopLossBps": float64(200), "takeProfitBps": float64(200)}
	prefix := botClientPrefix(instance.ID)
	exchange := &fakeExecution{
		positions: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.01", EntryPrice: "2500", MarkPrice: "2520", Leverage: "5"}},
		orders: []domain.Order{
			{ExchangeOrderID: "algo-stop", ClientOrderID: prefix + "stop", Symbol: "ETHUSDT", Type: domain.OrderStopMarket, Quantity: "0.01", StopPrice: "2425"},
			{ExchangeOrderID: "algo-take", ClientOrderID: prefix + "take", Symbol: "ETHUSDT", Type: domain.OrderTakeProfitMarket, Quantity: "0.01", StopPrice: "2575"},
		},
	}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2450", "takeProfit": "2550", "leverage": 5}}
	if err := (&Executor{store: store, execution: exchange}).Execute(t.Context(), instance, decision, 50, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.cancels) != 2 || len(exchange.commands) != 2 {
		t.Fatalf("old protection was not replaced: cancels=%d commands=%#v", len(exchange.cancels), exchange.commands)
	}
	if exchange.commands[0].StopPrice != "2450.00" || exchange.commands[1].StopPrice != "2550.00" {
		t.Fatalf("replacement targets are incorrect: %#v", exchange.commands)
	}
}

func TestExecutorCancelsStaleProtectionBeforeNewEntry(t *testing.T) {
	store := &fakeStore{}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	prefix := botClientPrefix(instance.ID)
	exchange := &fakeExecution{orders: []domain.Order{{ExchangeOrderID: "algo-1", ClientOrderID: prefix + "olds", Symbol: "ETHUSDT", Type: domain.OrderStopMarket}}}
	executor := &Executor{store: store, execution: exchange}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": 5}}
	if err := executor.Execute(t.Context(), instance, decision, 44, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.cancels) != 1 || len(exchange.commands) != 3 {
		t.Fatalf("stale cleanup missing: cancels=%d commands=%d", len(exchange.cancels), len(exchange.commands))
	}
}

func TestAllocatedQuantityRespectsStepMinimumAndAllocation(t *testing.T) {
	rule := domain.SymbolRule{StepSize: "0.001", MinQuantity: "0.001", MinNotional: "5"}
	quantity, err := allocatedQuantity(100, .10, rule, "2500")
	if err != nil || quantity != "0.004" {
		t.Fatalf("unexpected allocation quantity: %s err=%v", quantity, err)
	}
	if _, err := allocatedQuantity(100, .10, rule, "120000"); err == nil {
		t.Fatal("expected allocation cap rejection")
	}
}

func TestExecutorEnforcesAutonomousLeverageBand(t *testing.T) {
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	for _, leverage := range []int{4, 21} {
		decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2700", "leverage": leverage}}
		if err := (&Executor{store: &fakeStore{}, execution: &fakeExecution{}}).Execute(t.Context(), instance, decision, 99, time.Now().UTC()); err == nil {
			t.Fatalf("leverage %d should be rejected", leverage)
		}
	}
}

func TestTestnetNetTargetAddsRoundTripCostBuffer(t *testing.T) {
	configuration := map[string]any{
		"stopLossBps": float64(500), "takeProfitBps": float64(100), "estimatedRoundTripCostBps": float64(20),
	}
	_, longTarget, err := testnetProtectionPrices(configuration, domain.Position{Side: domain.PositionLong, EntryPrice: "100"})
	if err != nil || longTarget != "101.200000000000000000" {
		t.Fatalf("unexpected long net target: %s err=%v", longTarget, err)
	}
	_, shortTarget, err := testnetProtectionPrices(configuration, domain.Position{Side: domain.PositionShort, EntryPrice: "100"})
	if err != nil || shortTarget != "98.800000000000000000" {
		t.Fatalf("unexpected short net target: %s err=%v", shortTarget, err)
	}
	adjusted, err := addCostBufferToTake("101", domain.SideBuy, 20)
	if err != nil || adjusted != "101.202000000000000000" {
		t.Fatalf("unexpected initial-order target buffer: %s err=%v", adjusted, err)
	}
}

func TestExecutorPauseLeavesOpenPositionAndOrdersUntouched(t *testing.T) {
	store, exchange := &fakeStore{}, &fakeExecution{}
	exchange.positions = []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.01", EntryPrice: "2500", Leverage: "5"}}
	exchange.orders = []domain.Order{{ExchangeOrderID: "existing-stop", Symbol: "ETHUSDT", Type: domain.OrderStopMarket, ReduceOnly: true}}
	instance := bot.Instance{ID: "bot-1", UserID: "user-1", ExchangeAccountID: "account-1", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "ETHUSDT"}
	instance.Configuration = map[string]any{"entryPaused": true}
	decision := bot.Decision{HypotheticalOrder: map[string]any{"side": "BUY", "quantity": "0.01", "stopLoss": "2400", "takeProfit": "2525", "leverage": 5}}
	if err := (&Executor{store: store, execution: exchange}).Execute(t.Context(), instance, decision, 101, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(exchange.commands) != 0 || len(exchange.previews) != 0 || len(exchange.cancels) != 0 || len(store.orders) != 0 {
		t.Fatalf("pause touched exchange state: commands=%d previews=%d cancels=%d orders=%d", len(exchange.commands), len(exchange.previews), len(exchange.cancels), len(store.orders))
	}
}
