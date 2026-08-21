package bot

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"
)

type schedulerStore struct {
	instance *Instance
	gate     Gate
	states   []State
	decision Decision
}

type fixedRunner struct{}

type fixedObserver struct{ err error }

func (o fixedObserver) Observe(context.Context, Instance, Decision) (*AIObservation, error) {
	if o.err != nil {
		return nil, o.err
	}
	return &AIObservation{Action: "HOLD", Confidence: 0.7, Rationale: "Karşılaştırma gözlemi."}, nil
}

func (fixedRunner) Tick(context.Context, Instance) (Decision, error) {
	return Decision{Kind: "BUY", Summary: "Test kararı.", MarkPrice: "1", HypotheticalOrder: map[string]any{"submittedToExchange": false}}, nil
}

func (s *schedulerStore) AcquireNext(context.Context, string, time.Time, time.Time) (*Instance, error) {
	instance := s.instance
	s.instance = nil
	return instance, nil
}
func (s *schedulerStore) CheckGate(context.Context, Instance) (Gate, error) { return s.gate, nil }
func (s *schedulerStore) UpdateState(_ context.Context, instance *Instance, _ string, state State, _ string, _ time.Time) error {
	s.states = append(s.states, state)
	instance.State = state
	return nil
}
func (s *schedulerStore) CompleteCycle(_ context.Context, _ Instance, _ string, decision Decision, _, _ time.Time) error {
	s.decision = decision
	return nil
}
func (*schedulerStore) Release(context.Context, string, string) error { return nil }

func TestSchedulerReconcilesBeforePaperCycle(t *testing.T) {
	store := &schedulerStore{instance: &Instance{
		ID: "bot-1", State: StateStarting, Mode: "PAPER", Symbol: "BTCUSDT",
		Configuration: map[string]any{"quantity": "0.001", "leverage": float64(2), "side": "BUY"},
	}, gate: Gate{Ready: true}}
	scheduler := NewScheduler(Options{Store: store, Runner: fixedRunner{}, Owner: "test", Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	scheduler.runOnce(t.Context())
	if len(store.states) != 2 || store.states[0] != StateReconciling || store.states[1] != StateRunning {
		t.Fatalf("unsafe scheduler state path: %#v", store.states)
	}
	if store.decision.Kind != "BUY" || store.decision.HypotheticalOrder["submittedToExchange"] != false {
		t.Fatalf("unsafe paper decision: %#v", store.decision)
	}
	if _, ok := store.decision.Metrics["strategyExecutionLatencyMs"].(float64); !ok {
		t.Fatalf("strategy execution latency was not recorded: %#v", store.decision.Metrics)
	}
}

func TestSchedulerBlocksRunnerWhenRiskGateIsClosed(t *testing.T) {
	store := &schedulerStore{instance: &Instance{ID: "bot-2", State: StateStarting, Mode: "SHADOW"}, gate: Gate{Code: "GLOBAL_KILL_SWITCH_ACTIVE", Message: "blocked"}}
	scheduler := NewScheduler(Options{Store: store, Runner: fixedRunner{}, Owner: "test", Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	scheduler.runOnce(t.Context())
	if len(store.states) != 2 || store.states[1] != StateRiskBlocked || store.decision.Kind != "" {
		t.Fatalf("closed risk gate did not block runner: states=%#v decision=%#v", store.states, store.decision)
	}
}

func TestSchedulerReconcilesRunningBotAfterLeaseTakeover(t *testing.T) {
	store := &schedulerStore{instance: &Instance{ID: "bot-3", State: StateRunning, Mode: "SHADOW", NeedsReconciliation: true}, gate: Gate{Ready: true}}
	scheduler := NewScheduler(Options{Store: store, Runner: fixedRunner{}, Owner: "new-owner", Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	scheduler.runOnce(t.Context())
	if len(store.states) != 2 || store.states[0] != StateReconciling || store.states[1] != StateRunning {
		t.Fatalf("lease takeover skipped reconciliation: %#v", store.states)
	}
}

func TestSchedulerAttachesAIObservationWithoutChangingRuleDecision(t *testing.T) {
	store := &schedulerStore{instance: &Instance{ID: "bot-ai", State: StateRunning, Mode: "SHADOW"}, gate: Gate{Ready: true}}
	scheduler := NewScheduler(Options{Store: store, Runner: fixedRunner{}, Observer: fixedObserver{}, Owner: "test", Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	scheduler.runOnce(t.Context())
	if store.decision.Kind != "BUY" || store.decision.AIObservation == nil || store.decision.AIObservation.Action != "HOLD" {
		t.Fatalf("rule/AI comparison was not preserved: %#v", store.decision)
	}
}

func TestSchedulerKeepsRuleDecisionWhenAIObserverFails(t *testing.T) {
	store := &schedulerStore{instance: &Instance{ID: "bot-ai-fail", State: StateRunning, Mode: "PAPER"}, gate: Gate{Ready: true}}
	scheduler := NewScheduler(Options{Store: store, Runner: fixedRunner{}, Observer: fixedObserver{err: errors.New("observer unavailable")}, Owner: "test", Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	scheduler.runOnce(t.Context())
	if store.decision.Kind != "BUY" || store.decision.AIObservation != nil {
		t.Fatalf("observer failure changed rule decision: %#v", store.decision)
	}
}
