package liquidation

import (
	"testing"
	"time"
)

func TestParseAndClusterLiquidations(t *testing.T) {
	now := time.UnixMilli(1_700_000_000_000).UTC()
	collector := New("ws://example.invalid", nil)
	collector.now = func() time.Time { return now }
	for _, side := range []string{"SELL", "SELL", "SELL"} {
		value, err := parse([]byte(`{"e":"forceOrder","E":1700000000000,"o":{"s":"BTCUSDT","S":"` + side + `","q":"1","p":"20000","ap":"20000","z":"1","T":1700000000000}}`))
		if err != nil {
			t.Fatal(err)
		}
		collector.add(value)
	}
	context, err := collector.LiquidationContext(t.Context(), "BTCUSDT", now)
	if err != nil || !context.Cluster || context.Pressure >= 0 || context.EventCount != 3 {
		t.Fatalf("unexpected liquidation cluster: %#v err=%v", context, err)
	}
}
