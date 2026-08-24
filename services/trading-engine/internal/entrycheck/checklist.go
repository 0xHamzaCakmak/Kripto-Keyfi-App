package entrycheck

import "strings"

// Input contains independently established evidence for every mandatory
// Playbook section 4 entry criterion. Missing evidence fails closed.
type Input struct {
	Regime                 string
	HigherTimeframeAligned bool
	ConfirmedTimeframes    int
	RiskRewardSatisfied    bool
	PositionLimitSatisfied bool
	DerivativesAligned     bool
	ContinuousTraining     bool
}

type Result struct {
	Passed bool
	Failed []string
}

func Validate(input Input) Result {
	failed := make([]string, 0, 6)
	regime := strings.ToUpper(strings.TrimSpace(input.Regime))
	if regime != "TREND" && regime != "RANGE" {
		failed = append(failed, "REGIME_CLEAR")
	}
	if !input.HigherTimeframeAligned {
		failed = append(failed, "HIGHER_TIMEFRAME_ALIGNED")
	}
	if input.ConfirmedTimeframes < 2 {
		failed = append(failed, "MULTI_TIMEFRAME_CONFIRMATION")
	}
	if !input.RiskRewardSatisfied {
		failed = append(failed, "MINIMUM_RISK_REWARD")
	}
	if !input.PositionLimitSatisfied {
		failed = append(failed, "POSITION_LIMIT")
	}
	if !input.DerivativesAligned {
		failed = append(failed, "FUNDING_OPEN_INTEREST_ALIGNMENT")
	}
	return Result{Passed: len(failed) == 0, Failed: failed}
}

// ValidatePaperTraining keeps risk/reward, regime and fleet limits mandatory,
// while allowing PAPER evidence collection when exchange derivatives or a
// second higher timeframe are not yet aligned. TESTNET and SHADOW continue to
// use the stricter Validate checklist.
func ValidatePaperTraining(input Input) Result {
	failed := make([]string, 0, 4)
	regime := strings.ToUpper(strings.TrimSpace(input.Regime))
	if !input.ContinuousTraining && regime != "TREND" && regime != "RANGE" {
		failed = append(failed, "REGIME_CLEAR")
	}
	if !input.ContinuousTraining && input.ConfirmedTimeframes < 1 {
		failed = append(failed, "MARKET_TIMEFRAME_CONFIRMATION")
	}
	if !input.RiskRewardSatisfied {
		failed = append(failed, "MINIMUM_RISK_REWARD")
	}
	if !input.PositionLimitSatisfied {
		failed = append(failed, "POSITION_LIMIT")
	}
	return Result{Passed: len(failed) == 0, Failed: failed}
}
