package paper

import "testing"

func testEngine(t *testing.T) *Engine {
	t.Helper()
	engine, err := NewEngine(DefaultFillConfig())
	if err != nil {
		t.Fatal(err)
	}
	return engine
}

func TestDeterministicTakerEntryIncludesSpreadSlippageFeeAndMargin(t *testing.T) {
	result, err := testEngine(t).Enter(EntryRequest{
		Side: Long, Quantity: "1", MarkPrice: "100", Liquidity: Taker, Leverage: 10,
		StopLoss: "95", TakeProfit: "120",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.FillPrice != "100.030000000000000000" {
		t.Fatalf("unexpected fill: %s", result.FillPrice)
	}
	if result.Fee != "0.040012000000000000" {
		t.Fatalf("unexpected fee: %s", result.Fee)
	}
	if result.Position.IsolatedMargin != "10.003000000000000000" {
		t.Fatalf("unexpected margin: %s", result.Position.IsolatedMargin)
	}
	if result.Position.LiquidationPrice != "90.520000000000000000" {
		t.Fatalf("unexpected liquidation: %s", result.Position.LiquidationPrice)
	}
}

func TestFundingMarkAndExitProduceNetRealizedPnL(t *testing.T) {
	engine := testEngine(t)
	entry, err := engine.Enter(EntryRequest{Side: Long, Quantity: "1", MarkPrice: "100", Liquidity: Taker, Leverage: 10})
	if err != nil {
		t.Fatal(err)
	}
	position, payment, err := engine.ApplyFunding(entry.Position, "100", "0.001")
	if err != nil {
		t.Fatal(err)
	}
	if payment != "0.100000000000000000" {
		t.Fatalf("unexpected funding: %s", payment)
	}
	mark, err := engine.Mark(position, "110")
	if err != nil {
		t.Fatal(err)
	}
	if mark.UnrealizedPnL != "9.970000000000000000" {
		t.Fatalf("unexpected unrealized pnl: %s", mark.UnrealizedPnL)
	}
	exit, err := engine.Exit(position, ExitRequest{MarkPrice: "110", Liquidity: Taker, Reason: CloseManual})
	if err != nil {
		t.Fatal(err)
	}
	if exit.ExitPrice != "109.960000000000000000" {
		t.Fatalf("unexpected exit: %s", exit.ExitPrice)
	}
	if exit.RealizedPnL != "9.746004000000000000" {
		t.Fatalf("unexpected net pnl: %s", exit.RealizedPnL)
	}
}

func TestStopTakeProfitAndLiquidationTriggers(t *testing.T) {
	engine := testEngine(t)
	entry, err := engine.Enter(EntryRequest{
		Side: Long, Quantity: "1", MarkPrice: "100", Liquidity: Taker, Leverage: 10,
		StopLoss: "95", TakeProfit: "110",
	})
	if err != nil {
		t.Fatal(err)
	}
	stop, _ := engine.Mark(entry.Position, "95")
	if stop.TriggeredClose != CloseStopLoss {
		t.Fatalf("expected stop loss, got %s", stop.TriggeredClose)
	}
	take, _ := engine.Mark(entry.Position, "111")
	if take.TriggeredClose != CloseTakeProfit {
		t.Fatalf("expected take profit, got %s", take.TriggeredClose)
	}
	liquidated, _ := engine.Mark(entry.Position, "90")
	if liquidated.TriggeredClose != CloseLiquidation {
		t.Fatalf("expected liquidation, got %s", liquidated.TriggeredClose)
	}
}

func TestTickLotMinimumsAndPartialFillAreDeterministic(t *testing.T) {
	config := DefaultFillConfig()
	config.PartialFillRatio = "0.5"
	engine, err := NewEngine(config)
	if err != nil {
		t.Fatal(err)
	}
	result, err := engine.Enter(EntryRequest{Side: Short, Quantity: "1.001", MarkPrice: "100", Liquidity: Taker, Leverage: 2})
	if err != nil {
		t.Fatal(err)
	}
	if result.FilledQuantity != "0.500000000000000000" {
		t.Fatalf("unexpected partial fill: %s", result.FilledQuantity)
	}
	if result.FillPrice != "99.970000000000000000" {
		t.Fatalf("unexpected rounded short fill: %s", result.FillPrice)
	}
	_, err = engine.Enter(EntryRequest{Side: Long, Quantity: "0.001", MarkPrice: "1", Liquidity: Taker, Leverage: 1})
	if err == nil {
		t.Fatal("expected minimum notional rejection")
	}
}

func TestMakerFillUsesLimitAndMakerFee(t *testing.T) {
	result, err := testEngine(t).Enter(EntryRequest{
		Side: Long, Quantity: "1", MarkPrice: "100", LimitPrice: "99.991", Liquidity: Maker, Leverage: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.FillPrice != "99.990000000000000000" {
		t.Fatalf("unexpected maker tick rounding: %s", result.FillPrice)
	}
	if result.Fee != "0.019998000000000000" {
		t.Fatalf("unexpected maker fee: %s", result.Fee)
	}
}

func TestInvalidProtectionAndConfigFailClosed(t *testing.T) {
	engine := testEngine(t)
	_, err := engine.Enter(EntryRequest{Side: Long, Quantity: "1", MarkPrice: "100", Liquidity: Taker, Leverage: 2, StopLoss: "101"})
	if err == nil {
		t.Fatal("expected invalid long stop rejection")
	}
	config := DefaultFillConfig()
	config.PartialFillRatio = "1.1"
	if _, err := NewEngine(config); err == nil {
		t.Fatal("expected invalid partial fill config rejection")
	}
}
