package entrycheck

import "testing"

func TestManualDirectionKeepsRiskAndPositionLimitsMandatory(t *testing.T) {
	if result := ValidateManualDirection(Input{RiskRewardSatisfied: true, PositionLimitSatisfied: true}); !result.Passed {
		t.Fatalf("valid manual direction was rejected: %#v", result)
	}
	if result := ValidateManualDirection(Input{RiskRewardSatisfied: true}); result.Passed || len(result.Failed) != 1 || result.Failed[0] != "POSITION_LIMIT" {
		t.Fatalf("manual direction bypassed position limit: %#v", result)
	}
}

func TestValidateRequiresEveryPlaybookEntryCriterion(t *testing.T) {
	valid := Input{Regime: "TREND", HigherTimeframeAligned: true, ConfirmedTimeframes: 2,
		RiskRewardSatisfied: true, PositionLimitSatisfied: true, DerivativesAligned: true}
	if result := Validate(valid); !result.Passed || len(result.Failed) != 0 {
		t.Fatalf("valid checklist rejected: %#v", result)
	}

	tests := []struct {
		name string
		edit func(*Input)
	}{
		{"unclear regime", func(value *Input) { value.Regime = "UNCERTAIN" }},
		{"higher timeframe", func(value *Input) { value.HigherTimeframeAligned = false }},
		{"timeframe votes", func(value *Input) { value.ConfirmedTimeframes = 1 }},
		{"risk reward", func(value *Input) { value.RiskRewardSatisfied = false }},
		{"position limit", func(value *Input) { value.PositionLimitSatisfied = false }},
		{"derivatives", func(value *Input) { value.DerivativesAligned = false }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := valid
			test.edit(&input)
			if result := Validate(input); result.Passed || len(result.Failed) != 1 {
				t.Fatalf("incomplete checklist passed: %#v", result)
			}
		})
	}
}

func TestValidateFailsClosedWhenEvidenceIsMissing(t *testing.T) {
	result := Validate(Input{})
	if result.Passed || len(result.Failed) != 6 {
		t.Fatalf("missing evidence did not fail closed: %#v", result)
	}
}

func TestValidatePaperTrainingKeepsCoreRiskEvidenceWithoutTestnetConfluence(t *testing.T) {
	input := Input{Regime: "TREND", ConfirmedTimeframes: 1, RiskRewardSatisfied: true, PositionLimitSatisfied: true}
	if result := ValidatePaperTraining(input); !result.Passed {
		t.Fatalf("paper training evidence rejected: %#v", result)
	}
	input.PositionLimitSatisfied = false
	if result := ValidatePaperTraining(input); result.Passed || len(result.Failed) != 1 || result.Failed[0] != "POSITION_LIMIT" {
		t.Fatalf("paper position limit was bypassed: %#v", result)
	}
}

func TestContinuousPaperTrainingRelaxesOnlyMarketConfluence(t *testing.T) {
	input := Input{Regime: "UNCERTAIN", ConfirmedTimeframes: 0, ContinuousTraining: true, RiskRewardSatisfied: true, PositionLimitSatisfied: true}
	if result := ValidatePaperTraining(input); !result.Passed {
		t.Fatalf("continuous PAPER evidence should pass market-only relaxation: %#v", result)
	}
	input.PositionLimitSatisfied = false
	if result := ValidatePaperTraining(input); result.Passed || len(result.Failed) != 1 || result.Failed[0] != "POSITION_LIMIT" {
		t.Fatalf("continuous PAPER must keep exposure limits mandatory: %#v", result)
	}
}

func TestTestnetTrainingKeepsRegimeTimeframeRiskAndPositionLimits(t *testing.T) {
	input := Input{Regime: "TREND", ConfirmedTimeframes: 1, DerivativesAligned: true, TestnetTraining: true, RiskRewardSatisfied: true, PositionLimitSatisfied: true}
	if result := ValidateTestnetTraining(input); !result.Passed {
		t.Fatalf("explicit TESTNET training evidence rejected: %#v", result)
	}
	input.ConfirmedTimeframes = 0
	if result := ValidateTestnetTraining(input); result.Passed || result.Failed[0] != "MARKET_TIMEFRAME_CONFIRMATION" {
		t.Fatalf("TESTNET training bypassed market evidence: %#v", result)
	}
}

func TestTestnetTrainingAllowsConfirmedHighVolatilityButNotUncertain(t *testing.T) {
	input := Input{Regime: "HIGH_VOLATILITY", ConfirmedTimeframes: 1, DerivativesAligned: true, TestnetTraining: true, RiskRewardSatisfied: true, PositionLimitSatisfied: true}
	if result := ValidateTestnetTraining(input); !result.Passed {
		t.Fatalf("confirmed high-volatility TESTNET evidence rejected: %#v", result)
	}

	input.Regime = "UNCERTAIN"
	if result := ValidateTestnetTraining(input); result.Passed {
		t.Fatalf("raw uncertain TESTNET evidence must remain blocked: %#v", result)
	}

	input.ConfirmedTimeframes = 2
	input.TransitionRegimeAccepted = true
	if result := ValidateTestnetTraining(input); !result.Passed {
		t.Fatalf("guarded TESTNET transition evidence was rejected: %#v", result)
	}
	input.DerivativesAligned = false
	if result := ValidateTestnetTraining(input); result.Passed {
		t.Fatalf("guarded transition bypassed derivatives evidence: %#v", result)
	}
}
