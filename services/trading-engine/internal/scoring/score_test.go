package scoring

import (
	"context"
	"encoding/json"
	"math"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/performance"
)

func metricFixture() performance.Metrics {
	profitFactor, sharpe, sortino := 2.0, 2.0, 3.0
	return performance.Metrics{
		StartingBalance: 100, ROI: .15, TotalTrades: 100, Wins: 60, Losses: 40, WinRate: .6,
		Expectancy: 1, ProfitFactor: &profitFactor, Sharpe: &sharpe, Sortino: &sortino,
		MaxDrawdown: .05, Turnover: 5, FeeCost: .5, FundingCost: .2, SlippageCost: .3,
		MaxConsecutiveLosses: 2,
	}
}

func TestRiskAdjustedScoreRewardsStableQualityNotOnlyReturn(t *testing.T) {
	config := DefaultConfig()
	stable, err := Calculate(config, Input{Metrics: metricFixture(), ReturnInstability: .02})
	if err != nil {
		t.Fatal(err)
	}
	riskyMetrics := metricFixture()
	riskyMetrics.ROI = .4
	riskyMetrics.MaxDrawdown = .3
	riskyMetrics.Turnover = 50
	riskyMetrics.FeeCost = 8
	riskyMetrics.FundingCost = 1
	riskyMetrics.SlippageCost = 1
	risky, err := Calculate(config, Input{Metrics: riskyMetrics, LiquidationCount: 2, ReturnInstability: .1})
	if err != nil {
		t.Fatal(err)
	}
	if stable.FinalScore <= risky.FinalScore {
		t.Fatalf("stable score must beat return-only risky bot: stable=%#v risky=%#v", stable, risky)
	}
	if stable.FinalScore < 0 || stable.FinalScore > 100 || risky.FinalScore < 0 || risky.FinalScore > 100 {
		t.Fatalf("scores must stay normalized: %f %f", stable.FinalScore, risky.FinalScore)
	}
}

func TestLowTradeCountAppliesSampleConfidencePenalty(t *testing.T) {
	metrics := metricFixture()
	full, _ := Calculate(DefaultConfig(), Input{Metrics: metrics, ReturnInstability: .02})
	metrics.TotalTrades = 5
	metrics.Wins, metrics.Losses, metrics.MaxConsecutiveLosses = 3, 2, 1
	low, err := Calculate(DefaultConfig(), Input{Metrics: metrics, ReturnInstability: .02})
	if err != nil {
		t.Fatal(err)
	}
	if low.SampleConfidence != .1 || low.FinalScore >= full.FinalScore {
		t.Fatalf("sample penalty missing: full=%#v low=%#v", full, low)
	}
}

func TestMissingRatiosAndHeavyPenaltiesStayFinite(t *testing.T) {
	metrics := performance.Metrics{StartingBalance: 100, TotalTrades: 50, ROI: -.5, MaxDrawdown: .9, Turnover: 100, FeeCost: 50}
	result, err := Calculate(DefaultConfig(), Input{Metrics: metrics, LiquidationCount: 10, ReturnInstability: 1})
	if err != nil {
		t.Fatal(err)
	}
	if result.FinalScore != 0 || math.IsNaN(result.FinalScore) || math.IsInf(result.FinalScore, 0) {
		t.Fatalf("penalized score must clamp to finite zero: %#v", result)
	}
}

func TestInvalidConfigAndInputsFailClosed(t *testing.T) {
	config := DefaultConfig()
	config.MinimumTrades = 0
	if _, err := Calculate(config, Input{Metrics: metricFixture()}); err == nil {
		t.Fatal("expected invalid evidence config rejection")
	}
	if _, err := Calculate(DefaultConfig(), Input{Metrics: metricFixture(), LiquidationCount: -1}); err == nil {
		t.Fatal("expected invalid liquidation rejection")
	}
}

type scoreStore struct {
	botID   string
	at      time.Time
	score   float64
	payload []byte
}

func (store *scoreStore) SaveBotScore(_ context.Context, botID string, at time.Time, score float64, payload []byte) error {
	store.botID, store.at, store.score, store.payload = botID, at, score, append([]byte(nil), payload...)
	return nil
}

func TestServicePersistsScoreBreakdown(t *testing.T) {
	store := &scoreStore{}
	service, err := NewService(DefaultConfig(), store)
	if err != nil {
		t.Fatal(err)
	}
	at := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	result, err := service.CalculateAndSave(context.Background(), "bot-1", at, Input{Metrics: metricFixture(), ReturnInstability: .02})
	if err != nil {
		t.Fatal(err)
	}
	if store.botID != "bot-1" || store.at != at || store.score != result.FinalScore || !json.Valid(store.payload) {
		t.Fatalf("score breakdown was not persisted: %#v", store)
	}
}
