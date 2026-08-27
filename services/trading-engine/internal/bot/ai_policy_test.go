package bot

import "testing"

func TestAIMentorCoSignalRequiresAgreementOrDirectionalConfidence(t *testing.T) {
	instance := Instance{Configuration: map[string]any{"aiAutonomyLevel": "co_signal", "aiConfidenceThreshold": 0.75}}
	base := Decision{Kind: "BUY", Metrics: map[string]any{}, HypotheticalOrder: map[string]any{"side": "BUY"}}
	base.AIObservation = &AIObservation{Action: "HOLD", Confidence: 0.99}
	if result := ApplyAIMentorPolicy(instance, base); result.Kind != "HOLD" || result.HypotheticalOrder != nil {
		t.Fatalf("high-confidence HOLD incorrectly approved an entry: %#v", result)
	}
	base.AIObservation = &AIObservation{Action: "BUY", Confidence: 0.4}
	if result := ApplyAIMentorPolicy(instance, base); result.Kind != "BUY" || result.HypotheticalOrder == nil {
		t.Fatalf("aligned co-signal did not approve deterministic entry: %#v", result)
	}
	base.AIObservation = &AIObservation{Action: "SELL", Confidence: 0.9}
	if result := ApplyAIMentorPolicy(instance, base); result.Kind != "BUY" || result.HypotheticalOrder == nil {
		t.Fatalf("directional high-confidence mentor should gate, not reverse, deterministic order: %#v", result)
	}
}

func TestAIMentorNeverBlocksReduceOnlyProtection(t *testing.T) {
	decision := Decision{Kind: "SELL", Metrics: map[string]any{}, HypotheticalOrder: map[string]any{"side": "SELL", "reduceOnly": true}, AIObservation: &AIObservation{Action: "HOLD"}}
	result := ApplyAIMentorPolicy(Instance{Configuration: map[string]any{"aiAutonomyLevel": "co_signal"}}, decision)
	if result.Kind != "SELL" || result.HypotheticalOrder == nil {
		t.Fatalf("AI mentor blocked a risk-reducing order: %#v", result)
	}
}

func TestAIAutonomousRequiresExplicitApproval(t *testing.T) {
	decision := Decision{Kind: "BUY", Metrics: map[string]any{}, HypotheticalOrder: map[string]any{"side": "BUY"}, AIObservation: &AIObservation{Action: "BUY", Confidence: 0.99}}
	result := ApplyAIMentorPolicy(Instance{Configuration: map[string]any{"aiAutonomyLevel": "autonomous"}}, decision)
	if result.Kind != "HOLD" || result.Metrics["aiMentorGateCode"] != "AI_AUTONOMOUS_APPROVAL_REQUIRED" {
		t.Fatalf("autonomous mode was enabled without explicit approval: %#v", result)
	}
}
