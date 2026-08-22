package autonomousrisk

import (
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/entrycheck"
)

var now = time.Date(2026, 8, 21, 12, 0, 0, 0, time.UTC)

func TestApprovesOnlyWhenEveryAutonomousLimitPasses(t *testing.T) {
	decision := Evaluate(safePolicy(), safeIntent(), safeSnapshot())
	if !decision.Approved || decision.Code != "RISK_APPROVED" {
		t.Fatalf("unexpected decision: %#v", decision)
	}
}

func TestRequiresStopAndMinimumRiskReward(t *testing.T) {
	intent := safeIntent()
	intent.StopLoss = ""
	if decision := Evaluate(safePolicy(), intent, safeSnapshot()); decision.Code != "RISK_STOP_LOSS_REQUIRED" {
		t.Fatalf("stop was not required: %#v", decision)
	}
	intent = safeIntent()
	intent.TakeProfit = "100.5"
	if decision := Evaluate(safePolicy(), intent, safeSnapshot()); decision.Code != "RISK_MIN_REWARD_RATIO" {
		t.Fatalf("risk reward was not enforced: %#v", decision)
	}
}

func TestEnforcesLossDrawdownCooldownAndConsecutiveLock(t *testing.T) {
	tests := []struct {
		name, code string
		mutate     func(*Snapshot)
	}{
		{"daily", "RISK_MAX_DAILY_LOSS", func(s *Snapshot) { s.DailyLoss = "51" }},
		{"weekly", "RISK_MAX_WEEKLY_LOSS", func(s *Snapshot) { s.WeeklyLoss = "101" }},
		{"drawdown", "RISK_MAX_DRAWDOWN", func(s *Snapshot) { s.DrawdownPct = "0.21" }},
		{"cooldown", "RISK_COOLDOWN_ACTIVE", func(s *Snapshot) { value := now.Add(-30 * time.Second); s.LastFillAt = &value }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			snapshot := safeSnapshot()
			test.mutate(&snapshot)
			if decision := Evaluate(safePolicy(), safeIntent(), snapshot); decision.Code != test.code {
				t.Fatalf("expected %s: %#v", test.code, decision)
			}
		})
	}
}

func TestConsecutiveLossesKeepPaperLearningAndLockTestnet(t *testing.T) {
	lossAt := now.Add(-time.Hour)
	snapshot := safeSnapshot()
	snapshot.ConsecutiveLosses = 3
	snapshot.ConsecutiveLossAt = &lossAt
	if decision := Evaluate(safePolicy(), safeIntent(), snapshot); !decision.Approved || decision.Metrics["observationMode"] != true {
		t.Fatalf("paper observation should continue: %#v", decision)
	}
	testnet := safeIntent()
	testnet.ExecutionMode = "DEMO"
	if decision := Evaluate(safePolicy(), testnet, snapshot); decision.Code != "RISK_OBSERVATION_MODE_ACTIVE" {
		t.Fatalf("testnet was not paused: %#v", decision)
	}
	snapshot.Now = now.Add(25 * time.Hour)
	if decision := Evaluate(safePolicy(), testnet, snapshot); decision.Code != "RISK_OBSERVATION_APPROVAL_REQUIRED" {
		t.Fatalf("testnet did not require approval: %#v", decision)
	}
	testnet.ObservationApproved = true
	if decision := Evaluate(safePolicy(), testnet, snapshot); !decision.Approved {
		t.Fatalf("approved observation exit was rejected: %#v", decision)
	}
}

func TestEnforcesExposureLeverageMarginAndPositionCount(t *testing.T) {
	intent := safeIntent()
	intent.Leverage = 6
	if decision := Evaluate(safePolicy(), intent, safeSnapshot()); decision.Code != "RISK_MAX_LEVERAGE_EXCEEDED" {
		t.Fatal(decision.Code)
	}
	intent = safeIntent()
	intent.MarginMode = "CROSS"
	if decision := Evaluate(safePolicy(), intent, safeSnapshot()); decision.Code != "RISK_MARGIN_MODE_POLICY" {
		t.Fatal(decision.Code)
	}
	snapshot := safeSnapshot()
	snapshot.ProjectedTotalExposure = "501"
	if decision := Evaluate(safePolicy(), safeIntent(), snapshot); decision.Code != "RISK_MAX_TOTAL_EXPOSURE" {
		t.Fatal(decision.Code)
	}
	snapshot = safeSnapshot()
	snapshot.OpenPositions = 5
	if decision := Evaluate(safePolicy(), safeIntent(), snapshot); decision.Code != "RISK_MAX_CONCURRENT_POSITIONS" {
		t.Fatal(decision.Code)
	}
}

func TestFailsClosedAndStillAllowsCalculatedRiskReducingExit(t *testing.T) {
	policy := safePolicy()
	policy.Enabled = false
	if decision := Evaluate(policy, safeIntent(), safeSnapshot()); decision.Status != "SYSTEM_BLOCKED" {
		t.Fatalf("did not fail closed: %#v", decision)
	}
	intent := safeIntent()
	intent.RiskReducing = true
	intent.StopLoss = ""
	intent.TakeProfit = ""
	if decision := Evaluate(policy, intent, safeSnapshot()); !decision.Approved || decision.Code != "RISK_REDUCING_EXIT" {
		t.Fatalf("exit blocked: %#v", decision)
	}
}

func safePolicy() Policy {
	return Policy{Enabled: true, MaxRiskPerTradePct: "0.01", MaxDailyLossPct: "0.05", MaxWeeklyLossPct: "0.10", MaxDrawdownPct: "0.20", MaxLeverage: 5, MaxConcurrentPositions: 5, MaxTotalExposure: "500", MaxSymbolExposure: "200", MaxPositionSize: "100", MinRiskReward: "1.5", StopLossRequired: true, MarginModePolicy: "ISOLATED_ONLY", CooldownSeconds: 60, MaxConsecutiveLosses: 3}
}
func safeIntent() Intent {
	return Intent{Mode: "PAPER", ExecutionMode: "PAPER", Side: "BUY", MarginMode: "ISOLATED", EntryPrice: "100", StopLoss: "99", TakeProfit: "102", Quantity: "1", Leverage: 2, OpensNewPosition: true,
		EntryEvidence: entrycheck.Input{Regime: "TREND", HigherTimeframeAligned: true, ConfirmedTimeframes: 2, DerivativesAligned: true}}
}
func safeSnapshot() Snapshot {
	return Snapshot{Equity: "1000", DailyLoss: "10", WeeklyLoss: "20", DrawdownPct: "0.1", ProjectedTotalExposure: "100", ProjectedSymbolExposure: "100", ProjectedPositionSize: "100", OpenPositions: 0, Now: now}
}
