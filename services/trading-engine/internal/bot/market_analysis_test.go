package bot

import (
	"fmt"
	"testing"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

func TestAnalyzeMarketRequiresAlignedTrendAndTwoTimeframes(t *testing.T) {
	snapshot := trendingSnapshot(1)
	analysis, err := AnalyzeMarket(snapshot, "BUY")
	if err != nil || analysis.Regime != "TREND" || !analysis.HigherTimeframeAligned || analysis.ConfirmedTimeframes != 3 || !analysis.DerivativesAligned || !analysis.OIConfirmed {
		t.Fatalf("unexpected trend analysis: %#v err=%v", analysis, err)
	}
	short, err := AnalyzeMarket(snapshot, "SELL")
	if err != nil || short.HigherTimeframeAligned || short.ConfirmedTimeframes != 0 {
		t.Fatalf("counter-trend entry was aligned: %#v err=%v", short, err)
	}
}

func TestAnalyzeMarketRejectsMissingDerivativesEvidence(t *testing.T) {
	snapshot := trendingSnapshot(1)
	snapshot.Derivatives = domain.DerivativesContext{}
	analysis, err := AnalyzeMarket(snapshot, "BUY")
	if err != nil || analysis.DerivativesAligned {
		t.Fatalf("missing derivatives evidence passed: %#v err=%v", analysis, err)
	}
}

func trendingSnapshot(direction float64) MarketSnapshot {
	series := make([]domain.MarketCandle, 220)
	start := 100.0
	if direction < 0 {
		start = 300
	}
	for index := range series {
		close := start + direction*float64(index)*0.5
		series[index] = domain.MarketCandle{Open: domain.Decimal(fmt.Sprintf("%.4f", close-0.2*direction)), High: domain.Decimal(fmt.Sprintf("%.4f", close+0.4)), Low: domain.Decimal(fmt.Sprintf("%.4f", close-0.4)), Close: domain.Decimal(fmt.Sprintf("%.4f", close)), Volume: "100"}
	}
	return MarketSnapshot{Candles: map[string][]domain.MarketCandle{"1m": series, "5m": series, "15m": series, "1h": series, "4h": series},
		Derivatives: domain.DerivativesContext{FundingRate: "0.0001", OpenInterest: "110", PreviousOpenInterest: "100"}}
}
