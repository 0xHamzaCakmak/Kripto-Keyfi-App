package bot

import "testing"

func TestPaperLedgerOpensAndMarksLongPosition(t *testing.T) {
	execution, err := ApplyPaperExecution(PaperPosition{}, "BUY", "2", "100", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if execution.NetQuantity != "2.000000000000000000" || execution.AvgEntryPrice != "100.000000000000000000" {
		t.Fatalf("unexpected long position: %#v", execution)
	}
	unrealized, err := MarkPaperPosition(PaperPosition{NetQuantity: execution.NetQuantity, AvgEntryPrice: execution.AvgEntryPrice}, "110")
	if err != nil || unrealized != "20.000000000000000000" {
		t.Fatalf("unexpected mark pnl: %s %v", unrealized, err)
	}
}

func TestPaperLedgerPartiallyClosesPosition(t *testing.T) {
	position := PaperPosition{NetQuantity: "2", AvgEntryPrice: "100", RealizedPnL: "0", TotalFees: "0"}
	execution, err := ApplyPaperExecution(position, "SELL", "1", "110", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if execution.NetQuantity != "1.000000000000000000" || execution.RealizedPnL != "10.000000000000000000" || execution.CumulativePnL != "10.000000000000000000" {
		t.Fatalf("unexpected partial close: %#v", execution)
	}
}

func TestPaperLedgerCanReverseLongToShort(t *testing.T) {
	position := PaperPosition{NetQuantity: "1", AvgEntryPrice: "100"}
	execution, err := ApplyPaperExecution(position, "SELL", "2", "90", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if execution.NetQuantity != "-1.000000000000000000" || execution.AvgEntryPrice != "90.000000000000000000" || execution.RealizedPnL != "-10.000000000000000000" {
		t.Fatalf("unexpected reversal: %#v", execution)
	}
}

func TestPaperLedgerAppliesSlippageAndFees(t *testing.T) {
	execution, err := ApplyPaperExecution(PaperPosition{}, "BUY", "1", "100", 10, 10)
	if err != nil {
		t.Fatal(err)
	}
	if execution.FillPrice != "100.100000000000000000" || execution.Fee != "0.100100000000000000" {
		t.Fatalf("paper costs not applied: %#v", execution)
	}
}
