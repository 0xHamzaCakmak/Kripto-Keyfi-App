package entrycheck

import "testing"

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
