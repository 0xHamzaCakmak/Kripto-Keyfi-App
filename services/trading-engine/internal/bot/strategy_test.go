package bot

import "testing"

func TestScalpingWarmsUpBeforeSignal(t *testing.T) {
	instance := scalpingInstance("SHADOW")
	decision, err := EvaluateStrategy(instance, "50000", "")
	if err != nil || decision.Kind != "WARMING_UP" || decision.HypotheticalOrder != nil {
		t.Fatalf("unexpected warmup: %#v %v", decision, err)
	}
}

func TestScalpingPaperCreatesSafeHypotheticalOrder(t *testing.T) {
	instance := scalpingInstance("PAPER")
	decision, err := EvaluateStrategy(instance, "50150", "50000")
	if err != nil || decision.Kind != "BUY" {
		t.Fatalf("expected buy signal: %#v %v", decision, err)
	}
	if decision.HypotheticalOrder["submittedToExchange"] != false || decision.HypotheticalOrder["quantity"] != "0.001" {
		t.Fatalf("paper order escaped safety boundary: %#v", decision.HypotheticalOrder)
	}
}

func TestScalpingHonorsConfiguredSide(t *testing.T) {
	instance := scalpingInstance("PAPER")
	instance.Configuration["side"] = "BUY"
	decision, err := EvaluateStrategy(instance, "49800", "50000")
	if err != nil || decision.Kind != "HOLD" || decision.HypotheticalOrder != nil {
		t.Fatalf("sell signal ignored configured side: %#v %v", decision, err)
	}
}

func TestGridSignalsOnLevelCrossing(t *testing.T) {
	instance := gridInstance("PAPER")
	buy, err := EvaluateStrategy(instance, "52000", "56000")
	if err != nil || buy.Kind != "GRID_BUY" || buy.HypotheticalOrder["side"] != "BUY" {
		t.Fatalf("expected grid buy: %#v %v", buy, err)
	}
	sell, err := EvaluateStrategy(instance, "58000", "52000")
	if err != nil || sell.Kind != "GRID_SELL" || sell.HypotheticalOrder["side"] != "SELL" {
		t.Fatalf("expected grid sell: %#v %v", sell, err)
	}
}

func TestGridHoldsOutsideConfiguredRange(t *testing.T) {
	decision, err := EvaluateStrategy(gridInstance("SHADOW"), "81000", "79000")
	if err != nil || decision.Kind != "OUT_OF_RANGE" || decision.HypotheticalOrder != nil {
		t.Fatalf("unexpected out-of-range decision: %#v %v", decision, err)
	}
}

func scalpingInstance(mode string) Instance {
	return Instance{ID: "bot-1", Type: "SCALPING", Mode: mode, Symbol: "BTCUSDT", Configuration: map[string]any{
		"side": "BOTH", "quantity": "0.001", "leverage": float64(2), "signalThresholdBps": float64(25),
	}}
}

func gridInstance(mode string) Instance {
	return Instance{ID: "bot-2", Type: "GRID", Mode: mode, Symbol: "BTCUSDT", Configuration: map[string]any{
		"lowerPrice": "50000", "upperPrice": "80000", "gridLevels": float64(7), "quantityPerGrid": "0.001", "leverage": float64(2),
	}}
}
