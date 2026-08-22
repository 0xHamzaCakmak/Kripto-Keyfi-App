package bot

import "testing"

func TestFixedRiskQuantityUsesCapitalAndStopDistance(t *testing.T) {
	quantity, err := FixedRiskQuantity("100", "0.005", "100", "99.5")
	if err != nil || quantity != "1.000000000000000000" {
		t.Fatalf("unexpected fixed-risk quantity: %q err=%v", quantity, err)
	}
	closerStop, err := FixedRiskQuantity("100", "0.005", "100", "99.75")
	if err != nil || closerStop != "2.000000000000000000" {
		t.Fatalf("stop distance was not reflected: %q err=%v", closerStop, err)
	}
}

func TestFixedRiskQuantityFailsClosed(t *testing.T) {
	for _, values := range [][4]string{{"0", "0.005", "100", "99"}, {"100", "0", "100", "99"}, {"100", "1.1", "100", "99"}, {"100", "0.005", "100", "100"}} {
		if _, err := FixedRiskQuantity(values[0], values[1], values[2], values[3]); err == nil {
			t.Fatalf("invalid sizing accepted: %#v", values)
		}
	}
}
