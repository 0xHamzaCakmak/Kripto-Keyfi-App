package regime

import (
	"context"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/performance"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/scoring"
)

func number(value float64) *float64 { return &value }
func features(trend, volatility, breakout, noise float64) Features {
	return Features{TrendReturn: number(trend), Volatility: number(volatility), BreakoutStrength: number(breakout), NoiseRatio: number(noise)}
}

func TestDeterministicClassifierCoversInitialRegimes(t *testing.T) {
	classifier, err := NewClassifier(DefaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name     string
		features Features
		expected Type
	}{
		{"trending up", features(.02, .02, .01, .2), TrendingUp},
		{"trending down", features(-.02, .02, .01, .2), TrendingDown},
		{"ranging", features(.002, .02, .01, .2), Ranging},
		{"breakout", features(.005, .02, .04, .2), Breakout},
		{"high volatility", features(.02, .06, .01, .2), HighVolatility},
		{"low volatility", features(.002, .003, .01, .2), LowVolatility},
		{"chaotic", features(.001, .05, .01, .8), Chaotic},
	}
	for _, item := range cases {
		t.Run(item.name, func(t *testing.T) {
			result := classifier.Classify(item.features)
			if result.Regime != item.expected || result.Confidence < 0 || result.Confidence > 1 {
				t.Fatalf("unexpected classification: %#v", result)
			}
		})
	}
	if result := classifier.Classify(Features{}); result.Regime != Unknown || result.Confidence != 0 {
		t.Fatalf("missing data must be unknown: %#v", result)
	}
}

type snapshotStore struct {
	snapshots []Snapshot
	payloads  [][]byte
}

func (store *snapshotStore) SaveMarketRegimeSnapshot(_ context.Context, snapshot Snapshot, payload []byte) (uint64, error) {
	store.snapshots = append(store.snapshots, snapshot)
	store.payloads = append(store.payloads, payload)
	return 42, nil
}

func TestClassifierServicePersistsSnapshot(t *testing.T) {
	classifier, _ := NewClassifier(DefaultConfig())
	store := &snapshotStore{}
	service, err := NewService(classifier, store)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := service.ClassifyAndSave(context.Background(), "BTCUSDT", "15m", time.Now().UTC(), features(.02, .02, .01, .2))
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.ID != 42 || snapshot.Classification.Regime != TrendingUp || len(store.snapshots) != 1 {
		t.Fatalf("snapshot missing: %#v", snapshot)
	}
}

func TestAggregateBuildsRegimeSpecificMetricsAndScores(t *testing.T) {
	base := time.Date(2026, 8, 20, 0, 0, 0, 0, time.UTC)
	trade := func(regime Type, pnl string, offset int) Trade {
		return Trade{Regime: regime, Performance: performance.Trade{
			NetPnL: pnl, RiskAmount: "2", Notional: "20", Fees: ".1", FundingCost: "0", SlippageCost: ".1",
			OpenedAt: base.Add(time.Duration(offset) * time.Hour), ClosedAt: base.Add(time.Duration(offset+1) * time.Hour),
		}}
	}
	stats, err := Aggregate("100", []Trade{
		trade(TrendingUp, "5", 0), trade(TrendingUp, "-1", 2), trade(Ranging, "2", 4),
	}, scoring.DefaultConfig())
	if err != nil {
		t.Fatal(err)
	}
	if stats[TrendingUp].Metrics.TotalTrades != 2 || stats[TrendingUp].Metrics.NetPnL != 4 || stats[TrendingUp].Metrics.WinRate != .5 {
		t.Fatalf("unexpected trending stats: %#v", stats[TrendingUp])
	}
	if stats[Ranging].Metrics.TotalTrades != 1 || stats[Ranging].Metrics.NetPnL != 2 {
		t.Fatalf("unexpected ranging stats: %#v", stats[Ranging])
	}
	if stats[TrendingUp].Score.FinalScore < 0 || stats[TrendingUp].Score.FinalScore > 100 {
		t.Fatalf("invalid regime score: %#v", stats[TrendingUp].Score)
	}
}
