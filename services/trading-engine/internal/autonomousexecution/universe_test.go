package autonomousexecution

import (
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"testing"
	"time"
)

func TestUniverseMaintainsOwnedPositionOutsideCurrentAnalysisMarket(t *testing.T) {
	instance := bot.Instance{ID: "bot-1", UserID: "u", ExchangeAccountID: "a", Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "BTCUSDT", UniverseScan: true, Configuration: map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100)}}
	prefix := botClientPrefix(instance.ID)
	client := &fakeExecution{positions: []domain.Position{
		{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "0.01", EntryPrice: "2500", MarkPrice: "2525", Leverage: "5"},
		{Symbol: "SOLUSDT", Side: domain.PositionLong, Quantity: "1", EntryPrice: "100", MarkPrice: "110", Leverage: "5"},
	}, orders: []domain.Order{{ExchangeOrderID: "take", ClientOrderID: prefix + "t", Symbol: "ETHUSDT", Side: domain.SideSell, PositionSide: "LONG", ReduceOnly: true, Type: domain.OrderTakeProfitMarket, Quantity: "0.01"}}}
	if err := (&Executor{store: &fakeStore{}, execution: client}).MaintainPosition(t.Context(), instance, 99, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if len(client.commands) != 1 || client.commands[0].Symbol != "ETHUSDT" || !client.commands[0].ReduceOnly {
		t.Fatalf("wrong owned market maintained: %#v", client.commands)
	}
}

func TestUniverseAllocationIsSharedAcrossOwnedMarkets(t *testing.T) {
	instance := bot.Instance{ID: "b", Symbol: "BTCUSDT", Configuration: map[string]any{"testnetMarginAllocationMode": true}}
	positions := []domain.Position{{Symbol: "ETHUSDT", Side: domain.PositionLong, Quantity: "1", EntryPrice: "2000", Leverage: "10"}}
	orders := []domain.Order{{Symbol: "ETHUSDT", ClientOrderID: botClientPrefix("b") + "t", Side: domain.SideSell, PositionSide: "LONG", ReduceOnly: true, Type: domain.OrderTakeProfitMarket}}
	remaining, err := remainingUniverseAllocation(instance, 500, positions, orders, domain.PositionLong)
	if err != nil || remaining != 300 {
		t.Fatalf("remaining=%v err=%v", remaining, err)
	}
}
