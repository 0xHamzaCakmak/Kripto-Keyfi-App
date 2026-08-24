package bot

import "testing"

func TestManagedExitTakesPartialThenTrails(t *testing.T) {
	input := ManagedExitInput{Side: "BUY", EntryPrice: "100", Quantity: "2", StopLoss: "99", FirstTarget: "102", MarkPrice: "102", MarketRegime: "TREND", PartialFraction: 0.5, TrailingStopBps: 50}
	partial, err := PlanManagedExit(input)
	if err != nil || partial.Action != "PARTIAL_TAKE_PROFIT" || partial.Quantity != "1.000000000000000000" || partial.NewStop != "102" {
		t.Fatalf("unexpected partial plan: %#v err=%v", partial, err)
	}
	input.PartialTaken, input.Quantity, input.StopLoss, input.MarkPrice = true, "1", "100", "104"
	trail, err := PlanManagedExit(input)
	if err != nil || trail.Action != "MOVE_STOP" || trail.NewStop != "103.480000000000000000" {
		t.Fatalf("unexpected trail plan: %#v err=%v", trail, err)
	}
	input.StopLoss, input.MarkPrice = trail.NewStop, "103"
	closed, err := PlanManagedExit(input)
	if err != nil || closed.Action != "CLOSE" || closed.Reason != "TRAILING_STOP" {
		t.Fatalf("trailing stop did not close: %#v err=%v", closed, err)
	}
}

func TestManagedExitClosesOnRegimeChange(t *testing.T) {
	input := ManagedExitInput{Side: "SELL", EntryPrice: "100", Quantity: "1", StopLoss: "101", FirstTarget: "98", MarkPrice: "99", MarketRegime: "RANGE", PartialFraction: 0.5, TrailingStopBps: 50}
	plan, err := PlanManagedExit(input)
	if err != nil || plan.Action != "NONE" {
		t.Fatalf("sub-target regime change closed the trade: %#v err=%v", plan, err)
	}
	input.PartialTaken, input.StopLoss, input.MarkPrice = true, "98", "97.5"
	plan, err = PlanManagedExit(input)
	if err != nil || plan.Action != "CLOSE" || plan.Reason != "REGIME_CHANGE" {
		t.Fatalf("qualified regime change did not close: %#v err=%v", plan, err)
	}
}
