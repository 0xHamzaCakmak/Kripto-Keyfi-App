package autonomousexecution

import (
	"context"
	"testing"
	"time"

	tradingv1 "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/api/v1"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	mysqlstore "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/storage/mysql"
)

type fakeStore struct {
	orders []mysqlstore.AutonomousOrderInput
}

func (s *fakeStore) CreateAutonomousOrder(_ context.Context, _ bot.Instance, order mysqlstore.AutonomousOrderInput, _ time.Time) error {
	s.orders = append(s.orders, order)
	return nil
}
func (s *fakeStore) MarkAutonomousExecution(context.Context, int64, bool, string) error { return nil }

type fakeExecution struct {
	positions           []domain.Position
	positionsAfterPlace []domain.Position
	orders              []domain.Order
	commands            []tradingv1.PlaceOrderCommand
	previews            []tradingv1.PreviewOrderRequest
	cancels             []tradingv1.CancelOrderCommand
}

func (e *fakeExecution) OpenOrders(context.Context, domain.ExchangeAccountRef) ([]domain.Order, error) {
	return e.orders, nil
}
func (e *fakeExecution) MarketRule(context.Context, domain.ExchangeAccountRef, string) (domain.SymbolRule, domain.Decimal, error) {
	return domain.SymbolRule{StepSize: "0.001", MinQuantity: "0.001", MinNotional: "5"}, "2500", nil
}

func (e *fakeExecution) Positions(context.Context, domain.ExchangeAccountRef) ([]domain.Position, error) {
	if len(e.commands) > 0 && e.positionsAfterPlace != nil {
		return e.positionsAfterPlace, nil
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
	instance.Configuration = map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100), "allocationUsdt": float64(100), "positionNotionalPct": float64(.10), "pyramidingEnabled": true}
	prefix := botClientPrefix(instance.ID)
	exchange := &fakeExecution{
		positions:           []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.02", EntryPrice: "2500", MarkPrice: "2500", Leverage: "7"}},
		positionsAfterPlace: []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.024", EntryPrice: "2500", MarkPrice: "2500", Leverage: "7"}},
		orders: []domain.Order{
			{ExchangeOrderID: "old-stop", ClientOrderID: prefix + "olds", Symbol: "ETHUSDT", Type: domain.OrderStopMarket, Quantity: "0.02"},
			{ExchangeOrderID: "old-take", ClientOrderID: prefix + "oldt", Symbol: "ETHUSDT", Type: domain.OrderTakeProfitMarket, Quantity: "0.02"},
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
	}
	if !exchange.commands[0].PositionConfigurationVerified {
		t.Fatal("pyramid entry must carry in-process position configuration proof")
	}
	if len(exchange.cancels) != 2 || len(store.orders) != 3 {
		t.Fatalf("full-position protection was not resized: cancels=%d stored=%d", len(exchange.cancels), len(store.orders))
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
