package mysqlstore

import "testing"

func TestSignalAction(t *testing.T) {
	t.Parallel()
	tests := map[string]string{
		"BUY": "BUY", "GRID_BUY": "BUY", "SELL": "SELL", "GRID_SELL": "SELL",
		"HOLD": "HOLD", "WARMING_UP": "HOLD", "OUT_OF_RANGE": "HOLD",
	}
	for kind, expected := range tests {
		if actual := signalAction(kind); actual != expected {
			t.Fatalf("signalAction(%q) = %q, want %q", kind, actual, expected)
		}
	}
}

func TestSignalConfidence(t *testing.T) {
	t.Parallel()
	if actual := signalConfidence("BUY"); actual != "1.0000" {
		t.Fatalf("actionable confidence = %q", actual)
	}
	if actual := signalConfidence("WARMING_UP"); actual != "0.2500" {
		t.Fatalf("warming confidence = %q", actual)
	}
	if actual := signalConfidence("HOLD"); actual != "0.5000" {
		t.Fatalf("hold confidence = %q", actual)
	}
}
