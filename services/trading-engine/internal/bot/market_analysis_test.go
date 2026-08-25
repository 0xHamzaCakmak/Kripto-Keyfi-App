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
	if analysis.ATRBps15m <= 0 {
		t.Fatalf("normalized ATR evidence is missing: %#v", analysis)
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

func TestAnalyzeMarketUsesOnly15mAnd1hWith24hAnd48hWindows(t *testing.T) {
	source := trendingSnapshot(1)
	snapshot := MarketSnapshot{
		Candles: map[string][]domain.MarketCandle{
			"15m": source.Candles["15m"][:193],
			"1h":  source.Candles["1h"][:49],
		},
		Derivatives: source.Derivatives,
	}
	analysis, err := AnalyzeMarket(snapshot, "BUY")
	if err != nil || analysis.HigherDirection != "BUY" || analysis.MiddleDirection != "BUY" || analysis.LowerDirection != "BUY" || analysis.ConfirmedTimeframes != 3 {
		t.Fatalf("15m/1h 24h/48h analysis failed: %#v err=%v", analysis, err)
	}
}

func TestWindowDirectionUsesExactHistoricalWindow(t *testing.T) {
	values := make([]float64, 193)
	for index := range values {
		values[index] = 100 + float64(index)*0.1
	}
	if direction := windowDirection(values, 96, 5); direction != "BUY" {
		t.Fatalf("24h 15m window direction mismatch: %s", direction)
	}
	if direction := windowDirection(values, 192, 5); direction != "BUY" {
		t.Fatalf("48h 15m window direction mismatch: %s", direction)
	}
}

func TestAnalyzeMarketTreatsFlatQuantizedSeriesAsRange(t *testing.T) {
	series := make([]domain.MarketCandle, 220)
	for index := range series {
		series[index] = domain.MarketCandle{Open: "1", High: "1", Low: "1", Close: "1", Volume: "100"}
	}
	snapshot := MarketSnapshot{Candles: map[string][]domain.MarketCandle{"1m": series, "5m": series, "15m": series, "1h": series, "4h": series},
		Derivatives: domain.DerivativesContext{FundingRate: "0", OpenInterest: "100", PreviousOpenInterest: "100"}}
	analysis, err := AnalyzeMarket(snapshot, "BUY")
	if err != nil || analysis.Regime != "RANGE" || analysis.ATRExpansion != 1 {
		t.Fatalf("flat valid series was not classified safely: %#v err=%v", analysis, err)
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
