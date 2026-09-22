package autonomousexecution

import (
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"testing"
)

func TestROETargetUsesActualLeverageWithoutDoubleConversionOrCostBuffer(t *testing.T) {
	configuration := map[string]any{"testnetExecutionProfile": true, "stopLossBps": float64(200), "takeProfitBps": float64(300), "estimatedRoundTripCostBps": float64(20)}
	for _, tc := range []struct {
		side               domain.PositionSide
		leverage, expected string
	}{
		{domain.PositionLong, "10", "100.300000000000000000"},
		{domain.PositionShort, "10", "99.700000000000000000"},
		{domain.PositionLong, "20", "100.150000000000000000"},
	} {
		_, take, err := testnetProtectionPricesWithPlan(configuration, map[string]any{"takeProfitBps": float64(30)}, domain.Position{Side: tc.side, EntryPrice: "100", Leverage: domain.Decimal(tc.leverage)})
		if err != nil || take != tc.expected {
			t.Fatalf("%s %sx: got %s, err=%v", tc.side, tc.leverage, take, err)
		}
	}
	if _, _, err := testnetProtectionPrices(configuration, domain.Position{Side: domain.PositionLong, EntryPrice: "100"}); err == nil {
		t.Fatal("missing leverage must not silently use price targets")
	}
	configuration["takeProfitBasis"] = "PRICE"
	_, take, err := testnetProtectionPrices(configuration, domain.Position{Side: domain.PositionLong, EntryPrice: "100", Leverage: "10"})
	if err != nil || take != "103.200000000000000000" {
		t.Fatalf("manual price target changed: %s %v", take, err)
	}
}
