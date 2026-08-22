package bot

import (
	"context"
	"errors"
	"log/slog"
	"time"
)

type Instance struct {
	ID, UserID, ExchangeAccountID, Name, Type, Mode, Symbol string
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
	ExpiresAt                                         time.Time
}

type Store interface {
	AcquireNext(context.Context, string, time.Time, time.Time) (*Instance, error)
	CheckGate(context.Context, Instance) (Gate, error)
	UpdateState(context.Context, *Instance, string, State, string, time.Time) error
	CompleteCycle(context.Context, Instance, string, Decision, time.Time, time.Time) error
	Release(context.Context, string, string) error
}

type Runner interface {
	Tick(context.Context, Instance) (Decision, error)
}

type SignalObserver interface {
	Observe(context.Context, Instance, Decision) (*AIObservation, error)
}

type Scheduler struct {
	store                   Store
	runner                  Runner
	observer                SignalObserver
	owner                   string
	logger                  *slog.Logger
	interval, leaseDuration time.Duration
	now                     func() time.Time
}

type Options struct {
	Store                   Store
	Runner                  Runner
	Owner                   string
	Logger                  *slog.Logger
	Observer                SignalObserver
	Interval, LeaseDuration time.Duration
}

func NewScheduler(options Options) *Scheduler {
	interval := options.Interval
	if interval <= 0 {
		interval = time.Second
	}
	leaseDuration := options.LeaseDuration
	if leaseDuration <= interval {
		leaseDuration = 3 * interval
	}
	logger := options.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return &Scheduler{store: options.Store, runner: options.Runner, observer: options.Observer, owner: options.Owner, logger: logger, interval: interval, leaseDuration: leaseDuration, now: time.Now}
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
	instance, err := s.store.AcquireNext(ctx, s.owner, now, now.Add(s.leaseDuration))
	if err != nil {
		s.logger.Warn("bot lease acquisition failed", "error", err)
		return
	}
	if instance == nil {
		return
	}
	if instance.Mode != "SHADOW" && instance.Mode != "PAPER" {
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
		s.transition(ctx, instance, StateError, "Runner çevrimi başarısız.", now)
		return
	}
	if decision.Metrics == nil {
		decision.Metrics = make(map[string]any)
	}
	decision.Metrics["strategyExecutionLatencyMs"] = float64(time.Since(strategyStartedAt).Microseconds()) / 1000
	if s.observer != nil {
		observation, observeErr := s.observer.Observe(ctx, *instance, decision)
		if observeErr != nil {
			s.logger.Warn("AI observer cycle failed; rule decision remains active", "bot_id", instance.ID, "error", observeErr)
		} else {
			decision.AIObservation = observation
		}
	}
	if err := s.store.CompleteCycle(ctx, *instance, s.owner, decision, now, now.Add(s.leaseDuration)); err != nil {
		s.logger.Warn("bot cycle persistence failed", "bot_id", instance.ID, "error", err)
	}
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
