package performance

import (
	"context"
	"encoding/json"
	"math"
	"strings"
	"testing"
	"time"
)

func TestComputeCompletePerformanceSnapshot(t *testing.T) {
	base := time.Date(2025, 8, 20, 0, 0, 0, 0, time.UTC)
	trades := []Trade{
		{NetPnL: "10", RiskAmount: "5", Notional: "100", Fees: "1", FundingCost: "0.2", SlippageCost: "0.5", OpenedAt: base, ClosedAt: base.Add(time.Hour)},
		{NetPnL: "-5", RiskAmount: "5", Notional: "100", Fees: "1", FundingCost: "-0.1", SlippageCost: "0.5", OpenedAt: base.Add(2 * time.Hour), ClosedAt: base.Add(4 * time.Hour)},
		{NetPnL: "15", RiskAmount: "5", Notional: "100", Fees: "1", FundingCost: "0.2", SlippageCost: "0.5", OpenedAt: base.Add(5 * time.Hour), ClosedAt: base.Add(6 * time.Hour)},
		{NetPnL: "-2", RiskAmount: "5", Notional: "100", Fees: "1", FundingCost: "0", SlippageCost: "0.5", OpenedAt: base.Add(7 * time.Hour), ClosedAt: base.Add(9 * time.Hour)},
	}
	metrics, err := Compute(Input{
		StartingBalance: "100", UnrealizedPnL: "2", Trades: trades, PeriodsPerYear: 365,
		EquityCurve: []EquityPoint{
			{At: base, Equity: "100"}, {At: base.Add(120 * 24 * time.Hour), Equity: "110"},
			{At: base.Add(240 * 24 * time.Hour), Equity: "100"}, {At: base.Add(365 * 24 * time.Hour), Equity: "120"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if metrics.CurrentEquity != 120 || metrics.RealizedPnL != 18 || metrics.UnrealizedPnL != 2 || metrics.ROI != 0.2 {
		t.Fatalf("unexpected balances: %#v", metrics)
	}
	if metrics.Wins != 2 || metrics.Losses != 2 || metrics.WinRate != 0.5 || metrics.Expectancy != 4.5 {
		t.Fatalf("unexpected trade metrics: %#v", metrics)
	}
	if metrics.AverageWin != 12.5 || metrics.AverageLoss != -3.5 || metrics.MaxConsecutiveWins != 1 || metrics.MaxConsecutiveLosses != 1 {
		t.Fatalf("unexpected streak/average metrics: %#v", metrics)
	}
	if metrics.ProfitFactor == nil || math.Abs(*metrics.ProfitFactor-25.0/7.0) > 1e-12 {
		t.Fatalf("unexpected profit factor: %#v", metrics.ProfitFactor)
	}
	if metrics.AverageRiskReward == nil || math.Abs(*metrics.AverageRiskReward-0.9) > 1e-12 {
		t.Fatalf("unexpected average R:R: %#v", metrics.AverageRiskReward)
	}
	if math.Abs(metrics.MaxDrawdown-10.0/110.0) > 1e-12 || metrics.Sharpe == nil || metrics.Sortino == nil || metrics.Calmar == nil {
		t.Fatalf("risk-adjusted metrics missing: %#v", metrics)
	}
	if metrics.Turnover != 4 || metrics.FeeCost != 4 || math.Abs(metrics.FundingCost-0.3) > 1e-12 || metrics.SlippageCost != 2 {
		t.Fatalf("unexpected cost metrics: %#v", metrics)
	}
}

func TestLowSampleAndZeroDenominatorsReturnNilNotNaN(t *testing.T) {
	metrics, err := Compute(Input{StartingBalance: "100"})
	if err != nil {
		t.Fatal(err)
	}
	if metrics.ProfitFactor != nil || metrics.AverageRiskReward != nil || metrics.Sharpe != nil || metrics.Sortino != nil || metrics.Calmar != nil {
		t.Fatalf("undefined metrics must be nil: %#v", metrics)
	}
	payload, err := json.Marshal(metrics)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(payload), "NaN") || strings.Contains(string(payload), "Infinity") {
		t.Fatalf("unsafe numeric JSON: %s", payload)
	}
}

func TestAllWinningCurveDoesNotInventProfitFactorOrSortino(t *testing.T) {
	base := time.Now().UTC()
	metrics, err := Compute(Input{
		StartingBalance: "100",
		Trades:          []Trade{{NetPnL: "5", Notional: "10", Fees: "0", FundingCost: "0", SlippageCost: "0", OpenedAt: base, ClosedAt: base.Add(time.Hour)}},
		EquityCurve:     []EquityPoint{{At: base, Equity: "100"}, {At: base.Add(24 * time.Hour), Equity: "105"}, {At: base.Add(48 * time.Hour), Equity: "110"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if metrics.ProfitFactor != nil || metrics.Sortino != nil || metrics.Calmar != nil {
		t.Fatalf("undefined ratios must stay nil: %#v", metrics)
	}
}

func TestInvalidDecimalsAndDurationsFailClosed(t *testing.T) {
	if _, err := Compute(Input{StartingBalance: "NaN"}); err == nil {
		t.Fatal("expected invalid starting balance rejection")
	}
	if _, err := Compute(Input{StartingBalance: "1e308", UnrealizedPnL: "1e308"}); err == nil {
		t.Fatal("expected finite overflow rejection")
	}
	now := time.Now().UTC()
	_, err := Compute(Input{StartingBalance: "100", Trades: []Trade{{
		NetPnL: "1", Notional: "1", Fees: "0", FundingCost: "0", SlippageCost: "0", OpenedAt: now, ClosedAt: now.Add(-time.Second),
	}}})
	if err == nil {
		t.Fatal("expected invalid holding duration rejection")
	}
}

type metricStore struct {
	snapshots []Snapshot
	payloads  [][]byte
}

func (store *metricStore) SaveBotMetric(_ context.Context, snapshot Snapshot, payload []byte) error {
	store.snapshots = append(store.snapshots, snapshot)
	store.payloads = append(store.payloads, append([]byte(nil), payload...))
	return nil
}

func TestServicePersistsBotMetricSnapshot(t *testing.T) {
	store := &metricStore{}
	service, err := NewService(store)
	if err != nil {
		t.Fatal(err)
	}
	fixed := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return fixed }
	snapshot, err := service.ComputeAndSave(context.Background(), "bot-1", "strategy-v1", nil, Input{StartingBalance: "100"})
	if err != nil {
		t.Fatal(err)
	}
	if len(store.snapshots) != 1 || snapshot.SnapshotAt != fixed || !json.Valid(store.payloads[0]) {
		t.Fatalf("snapshot was not persisted: %#v", snapshot)
	}
}
