package entrycheck

import "strings"

// Input contains independently established evidence for every mandatory
// Playbook section 4 entry criterion. Missing evidence fails closed.
type Input struct {
	Regime                   string
	HigherTimeframeAligned   bool
	ConfirmedTimeframes      int
	RiskRewardSatisfied      bool
	PositionLimitSatisfied   bool
	DerivativesAligned       bool
	ContinuousTraining       bool
	TestnetTraining          bool
	TransitionRegimeAccepted bool
}

// ValidateTestnetTraining is available only to an explicitly activated
// Binance TESTNET profile. It relaxes directional funding/OI confluence so a
// demo fleet can collect execution evidence, while retaining a clear regime,
// Binance OHLCV confirmation, risk/reward and position limits.
func ValidateTestnetTraining(input Input) Result {
	failed := make([]string, 0, 5)
	regime := strings.ToUpper(strings.TrimSpace(input.Regime))
	establishedRegime := regime == "TREND" || regime == "RANGE" || regime == "HIGH_VOLATILITY"
	guardedTransition := regime == "UNCERTAIN" && input.TransitionRegimeAccepted && input.ConfirmedTimeframes >= 2 && input.DerivativesAligned
	if !establishedRegime && !guardedTransition {
		failed = append(failed, "REGIME_CLEAR")
	}
	if input.ConfirmedTimeframes < 1 || (regime == "UNCERTAIN" && input.ConfirmedTimeframes < 2) {
		failed = append(failed, "MARKET_TIMEFRAME_CONFIRMATION")
	}
	if !input.DerivativesAligned {
		failed = append(failed, "FUNDING_OPEN_INTEREST_ALIGNMENT")
	}
	if !input.RiskRewardSatisfied {
		failed = append(failed, "MINIMUM_RISK_REWARD")
	}
	if !input.PositionLimitSatisfied {
		failed = append(failed, "POSITION_LIMIT")
	}
	return Result{Passed: len(failed) == 0, Failed: failed}
}

type Result struct {
	Passed bool
	Failed []string
}

// ValidateManualDirection preserves immutable risk/reward and position limits
// while treating the authenticated administrator as the directional evidence.
// It is only selected by the DEMO risk adapter for an auditable campaign item.
func ValidateManualDirection(input Input) Result {
	failed := make([]string, 0, 2)
	if !input.RiskRewardSatisfied {
		failed = append(failed, "MINIMUM_RISK_REWARD")
	}
	if !input.PositionLimitSatisfied {
		failed = append(failed, "POSITION_LIMIT")
	}
	return Result{Passed: len(failed) == 0, Failed: failed}
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
