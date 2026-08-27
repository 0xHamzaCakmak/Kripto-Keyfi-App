package bot

import "strings"

const defaultAIConfidenceThreshold = 0.75

// ApplyAIMentorPolicy arbitrates only new entries. Protective/reduce-only
// orders are never frozen by an unavailable advisory provider.
func ApplyAIMentorPolicy(instance Instance, decision Decision) Decision {
	observation := decision.AIObservation
	if observation == nil || decision.HypotheticalOrder == nil || decision.HypotheticalOrder["reduceOnly"] == true {
		return decision
	}
	level := strings.ToLower(strings.TrimSpace(stringValue(instance.Configuration["aiAutonomyLevel"])))
	if level == "" {
		level = "advisory"
	}
	threshold := configNumberOr(instance.Configuration, "aiConfidenceThreshold", defaultAIConfidenceThreshold)
	if threshold < 0.5 || threshold > 0.99 {
		threshold = defaultAIConfidenceThreshold
	}
	if decision.Metrics == nil {
		decision.Metrics = make(map[string]any)
	}
	ruleAction := signalActionForObserver(decision.Kind)
	decision.Metrics["aiRuleDecisionKindBeforeMentor"] = decision.Kind
	decision.Metrics["aiRuleActionBeforeMentor"] = ruleAction
	directionalAI := observation.Action == "BUY" || observation.Action == "SELL"
	agreement := directionalAI && observation.Action == ruleAction
	highConfidence := directionalAI && observation.Confidence >= threshold
	decision.Metrics["aiAutonomyLevel"] = level
	decision.Metrics["aiConfidenceThreshold"] = threshold
	decision.Metrics["aiMentorAction"] = observation.Action
	decision.Metrics["aiMentorConfidence"] = observation.Confidence
	decision.Metrics["aiMentorAgreement"] = agreement
	decision.Metrics["aiMentorReportedAgreement"] = observation.AgreesWithRuleEngine
	decision.Metrics["aiMentorInvalidationLevel"] = observation.InvalidationLevel
	decision.Metrics["aiMentorSuggestedLeverage"] = observation.SuggestedLeverage

	switch level {
	case "advisory":
		decision.Metrics["aiMentorGatePassed"] = true
		decision.Metrics["aiMentorComparisonOnly"] = true
		return decision
	case "autonomous":
		if instance.Configuration["aiAutonomousApproved"] != true {
			return holdEntry(decision, "AI autonomous modu yönetici onayı olmadan kilitlidir.", "AI_AUTONOMOUS_APPROVAL_REQUIRED")
		}
		// The mentor cannot fabricate quantity, stop or take-profit. Autonomous
		// mode may approve an existing deterministic risk plan only.
		if !highConfidence {
			return holdEntry(decision, "AI mentör autonomous confidence eşiğini geçmedi.", "AI_AUTONOMOUS_CONFIDENCE_NOT_MET")
		}
		decision.Metrics["aiMentorGatePassed"] = true
		return decision
	case "co_signal":
		if agreement || highConfidence {
			decision.Metrics["aiMentorGatePassed"] = true
			return decision
		}
		return holdEntry(decision, "AI mentör ile kural motoru ortak giriş teyidi üretemedi.", "AI_CO_SIGNAL_NOT_CONFIRMED")
	default:
		return holdEntry(decision, "Geçersiz AI autonomy seviyesi; güvenli HOLD.", "AI_AUTONOMY_LEVEL_INVALID")
	}
}

func holdEntry(decision Decision, summary, code string) Decision {
	decision.Kind = "HOLD"
	decision.Summary = summary
	decision.HypotheticalOrder = nil
	decision.Metrics["aiMentorGatePassed"] = false
	decision.Metrics["aiMentorGateCode"] = code
	return decision
}
