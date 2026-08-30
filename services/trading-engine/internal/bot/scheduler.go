package bot

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"
)

type Instance struct {
	ID, UserID, ExchangeAccountID, Name, Type, Mode, Symbol string
	StrategyVersionID                                       string
	StrategyFamily                                          string
	State                                                   State
	DesiredState                                            string
	IntervalSeconds                                         int
	Configuration                                           map[string]any
	NeedsReconciliation                                     bool
}

type Gate struct {
	Ready   bool
	Code    string
	Message string
}

type Decision struct {
	Kind              string
	Summary           string
	MarkPrice         string
	ReferencePrice    string
	Metrics           map[string]any
	HypotheticalOrder map[string]any
	AIObservation     *AIObservation
}

type AIObservation struct {
	Action, Rationale, Provider, Model, PromptVersion string
	Confidence                                        float64
	InvalidationLevel                                 float64
	SuggestedLeverage                                 int
	AgreesWithRuleEngine                              bool
	ExpiresAt                                         time.Time
}

type Store interface {
	AcquireNext(context.Context, string, time.Time, time.Time, bool) (*Instance, error)
	CheckGate(context.Context, Instance) (Gate, error)
	UpdateState(context.Context, *Instance, string, State, string, time.Time) error
	CompleteCycle(context.Context, Instance, string, Decision, time.Time, time.Time) (CycleResult, error)
	Release(context.Context, string, string) error
}

type CycleResult struct {
	DecisionID            int64
	RiskApproved          bool
	PaperExecutionChanged bool
	ExecutionStatus       string
	ExecutionReasonCode   string
}

type TestnetExecutor interface {
	Execute(context.Context, Instance, Decision, int64, time.Time) error
}

type TestnetExecutionFailureRecorder interface {
	RecordFailure(context.Context, int64, error) error
}

type TestnetPositionMaintainer interface {
	MaintainPosition(context.Context, Instance, int64, time.Time) error
}

type Runner interface {
	Tick(context.Context, Instance) (Decision, error)
}

type SignalObserver interface {
	Observe(context.Context, Instance, Decision) (*AIObservation, error)
}

type PerformanceRefresher interface {
	RefreshBotPerformance(context.Context, string) error
}

type Scheduler struct {
	store                      Store
	runner                     Runner
	observer                   SignalObserver
	testnetExecutor            TestnetExecutor
	owner                      string
	logger                     *slog.Logger
	interval, leaseDuration    time.Duration
	performanceRefreshInterval time.Duration
	lastPerformanceRefresh     map[string]time.Time
	performanceRefreshMu       sync.Mutex
	now                        func() time.Time
}

type Options struct {
	Store                      Store
	Runner                     Runner
	Owner                      string
	Logger                     *slog.Logger
	Observer                   SignalObserver
	TestnetExecutor            TestnetExecutor
	Interval, LeaseDuration    time.Duration
	PerformanceRefreshInterval time.Duration
}

func NewScheduler(options Options) *Scheduler {
	interval := options.Interval
	if interval <= 0 {
		interval = time.Second
	}
	leaseDuration := options.LeaseDuration
	if leaseDuration <= 0 {
		// A cycle can include multiple TESTNET HTTP reads. Keep ownership long
		// enough that another worker cannot reclaim the bot mid-analysis.
		leaseDuration = 30 * time.Second
	}
	if leaseDuration <= interval {
		leaseDuration = 3 * interval
	}
	performanceRefreshInterval := options.PerformanceRefreshInterval
	if performanceRefreshInterval <= 0 {
		performanceRefreshInterval = 15 * time.Minute
	}
	logger := options.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &Scheduler{store: options.Store, runner: options.Runner, observer: options.Observer, testnetExecutor: options.TestnetExecutor, owner: options.Owner, logger: logger,
		interval: interval, leaseDuration: leaseDuration, performanceRefreshInterval: performanceRefreshInterval, lastPerformanceRefresh: make(map[string]time.Time), now: time.Now}
}

func (s *Scheduler) Run(ctx context.Context) {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	for {
		s.runOnce(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Scheduler) runOnce(ctx context.Context) {
	now := s.now().UTC()
	instance, err := s.store.AcquireNext(ctx, s.owner, now, now.Add(s.leaseDuration), s.testnetExecutor != nil)
	if err != nil {
		s.logger.Warn("bot lease acquisition failed", "error", err)
		return
	}
	if instance == nil {
		return
	}
	if instance.Mode != "SHADOW" && instance.Mode != "PAPER" && !(instance.Mode == "DEMO" && s.testnetExecutor != nil) {
		s.transition(ctx, instance, StateError, "Demo runner shadow kabulü tamamlanmadan kilitli.", now)
		return
	}
	if instance.State == StateRiskBlocked || instance.State == StateError {
		if !s.transition(ctx, instance, StateStarting, "Scheduler güvenlik kapısını yeniden deniyor.", now) {
			return
		}
	}
	if instance.State != StateRunning || instance.NeedsReconciliation {
		if !s.transition(ctx, instance, StateReconciling, "Scheduler restart güvenlik kontrolü.", now) {
			return
		}
	}
	gate, err := s.store.CheckGate(ctx, *instance)
	if err != nil {
		s.transition(ctx, instance, StateRiskBlocked, "Güvenlik kapısı okunamadı.", now)
		return
	}
	if !gate.Ready {
		s.transition(ctx, instance, StateRiskBlocked, gate.Message, now)
		return
	}
	if instance.State != StateRunning && !s.transition(ctx, instance, StateRunning, "Shadow/paper runner aktif.", now) {
		return
	}
	strategyStartedAt := time.Now()
	decision, err := s.runner.Tick(ctx, *instance)
	if err != nil {
		s.logger.Warn("bot runner cycle failed", "bot_id", instance.ID, "symbol", instance.Symbol, "mode", instance.Mode, "error", err)
		s.transition(ctx, instance, StateError, "Runner çevrimi başarısız.", now)
		return
	}
	if decision.Metrics == nil {
		decision.Metrics = make(map[string]any)
	}
	decision.Metrics["strategyExecutionLatencyMs"] = float64(time.Since(strategyStartedAt).Microseconds()) / 1000
	if s.observer != nil && decision.Metrics["manualBotInstruction"] != true {
		observation, observeErr := s.observer.Observe(ctx, *instance, decision)
		if observeErr != nil {
			s.logger.Warn("AI mentor cycle failed; new entries fail closed", "bot_id", instance.ID, "error", observeErr)
			decision.AIObservation = &AIObservation{Action: "HOLD", Confidence: 0, Rationale: "AI mentor unavailable; safe HOLD fallback.", Provider: "FAIL_SAFE", Model: "none", PromptVersion: "fallback-v1", ExpiresAt: now.Add(time.Minute)}
		} else {
			decision.AIObservation = observation
		}
		decision = ApplyAIMentorPolicy(*instance, decision)
	}
	cycle, err := s.store.CompleteCycle(ctx, *instance, s.owner, decision, now, now.Add(s.leaseDuration))
	if err != nil {
		s.logger.Warn("bot cycle persistence failed", "bot_id", instance.ID, "error", err)
		// A deterministic persistence/ledger error must not be reacquired every
		// poll tick by the same owner. ERROR writes lastDecisionAt, applying the
		// bot interval as a retry backoff while other bots keep their workers.
		s.transition(ctx, instance, StateError, "Karar/işlem kaydı tamamlanamadı; güvenli yeniden deneme bekleniyor.", now)
		return
	}
	if decision.HypotheticalOrder != nil && !cycle.RiskApproved {
		s.logger.Warn("autonomous signal rejected before execution", "bot_id", instance.ID, "decision_id", cycle.DecisionID, "status", cycle.ExecutionStatus, "reason_code", cycle.ExecutionReasonCode)
	}
	if (instance.Mode == "PAPER" || instance.Mode == "DEMO") && s.performanceRefreshDue(instance.ID, now, cycle.PaperExecutionChanged) {
		if refresher, ok := s.store.(PerformanceRefresher); ok {
			if err := refresher.RefreshBotPerformance(ctx, instance.ID); err != nil {
				s.logger.Warn("bot performance refresh failed", "bot_id", instance.ID, "mode", instance.Mode, "error", err)
			}
		}
	}
	if instance.Mode == "DEMO" {
		if maintainer, ok := s.testnetExecutor.(TestnetPositionMaintainer); ok {
			if err := maintainer.MaintainPosition(ctx, *instance, cycle.DecisionID, now); err != nil {
				s.logger.Error("autonomous testnet position maintenance failed", "bot_id", instance.ID, "decision_id", cycle.DecisionID, "error", err)
				if recorder, ok := s.testnetExecutor.(TestnetExecutionFailureRecorder); ok {
					if recordErr := recorder.RecordFailure(ctx, cycle.DecisionID, err); recordErr != nil {
						s.logger.Error("autonomous testnet maintenance failure persistence failed", "bot_id", instance.ID, "decision_id", cycle.DecisionID, "error", recordErr)
					}
				}
				return
			}
		}
	}
	if instance.Mode == "DEMO" && cycle.RiskApproved && decision.HypotheticalOrder != nil {
		if err := s.testnetExecutor.Execute(ctx, *instance, decision, cycle.DecisionID, now); err != nil {
			s.logger.Error("autonomous testnet execution failed", "bot_id", instance.ID, "decision_id", cycle.DecisionID, "error", err)
			if recorder, ok := s.testnetExecutor.(TestnetExecutionFailureRecorder); ok {
				if recordErr := recorder.RecordFailure(ctx, cycle.DecisionID, err); recordErr != nil {
					s.logger.Error("autonomous testnet execution failure persistence failed", "bot_id", instance.ID, "decision_id", cycle.DecisionID, "error", recordErr)
				}
			}
		}
	}
}

func (s *Scheduler) performanceRefreshDue(botID string, now time.Time, executionChanged bool) bool {
	s.performanceRefreshMu.Lock()
	defer s.performanceRefreshMu.Unlock()
	last, exists := s.lastPerformanceRefresh[botID]
	if !executionChanged && exists && now.Sub(last) < s.performanceRefreshInterval {
		return false
	}
	// Record the attempt before calling the store so a transient DB failure does
	// not turn every HOLD cycle into a new expensive full-history score rebuild.
	s.lastPerformanceRefresh[botID] = now
	return true
}

func (s *Scheduler) transition(ctx context.Context, instance *Instance, target State, reason string, now time.Time) bool {
	if err := ValidateTransition(instance.State, target); err != nil {
		if errors.Is(err, context.Canceled) {
			return false
		}
		s.logger.Error("bot state transition rejected", "bot_id", instance.ID, "from", instance.State, "to", target, "error", err)
		return false
	}
	if err := s.store.UpdateState(ctx, instance, s.owner, target, reason, now); err != nil {
		s.logger.Warn("bot state transition persistence failed", "bot_id", instance.ID, "to", target, "error", err)
		return false
	}
	instance.State = target
	return true
}
