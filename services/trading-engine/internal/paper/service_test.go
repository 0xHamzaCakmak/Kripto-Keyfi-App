package paper

import (
	"context"
	"testing"
	"time"
)

type memoryTradeStore struct {
	created []TradeRecord
	closed  []TradeRecord
}

func (store *memoryTradeStore) CreatePaperTrade(_ context.Context, trade TradeRecord) error {
	store.created = append(store.created, trade)
	return nil
}
func (store *memoryTradeStore) ClosePaperTrade(_ context.Context, trade TradeRecord) error {
	store.closed = append(store.closed, trade)
	return nil
}

func TestServicePersistsOpenAndClosedPaperTradeWithoutExchange(t *testing.T) {
	store := &memoryTradeStore{}
	service, err := NewService(testEngine(t), store)
	if err != nil {
		t.Fatal(err)
	}
	fixed := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return fixed }
	record, position, err := service.Open(context.Background(), OpenTradeRequest{
		TradingBotID: "bot-1", StrategyVersionID: "strategy-version-1", Symbol: "BTCUSDT",
		Entry: EntryRequest{Side: Long, Quantity: "1", MarkPrice: "100", Liquidity: Taker, Leverage: 5},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(store.created) != 1 || record.Status != "OPEN" || record.Side != "BUY" {
		t.Fatalf("open was not persisted: %#v", record)
	}
	closed, _, err := service.Close(context.Background(), record, position, ExitRequest{
		MarkPrice: "110", Liquidity: Taker, Reason: CloseTakeProfit,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(store.closed) != 1 || closed.Status != "CLOSED" || closed.ClosedAt == nil {
		t.Fatalf("close was not persisted: %#v", closed)
	}
}

func TestServicePersistsLiquidationStatus(t *testing.T) {
	store := &memoryTradeStore{}
	service, _ := NewService(testEngine(t), store)
	record, position, err := service.Open(context.Background(), OpenTradeRequest{
		TradingBotID: "bot-1", Symbol: "ETHUSDT",
		Entry: EntryRequest{Side: Short, Quantity: "1", MarkPrice: "100", Liquidity: Taker, Leverage: 10},
	})
	if err != nil {
		t.Fatal(err)
	}
	closed, _, err := service.Close(context.Background(), record, position, ExitRequest{
		MarkPrice: "111", Liquidity: Taker, Reason: CloseLiquidation,
	})
	if err != nil {
		t.Fatal(err)
	}
	if closed.Status != "LIQUIDATED" {
		t.Fatalf("expected liquidation status, got %s", closed.Status)
	}
}
