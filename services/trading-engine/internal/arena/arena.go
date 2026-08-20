package arena

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/paper"
)

type MarketEvent struct {
	Symbol           string
	Timeframe        string
	MarkPrice        string
	FundingRate      string
	ApplyFunding     bool
	RegimeSnapshotID *uint64
	Sequence         uint64
	OccurredAt       time.Time
}

type Bot struct {
	ID                string
	StrategyVersionID string
	Symbol            string
	Symbols           []string
	Timeframe         string
	StartingBalance   string
	Parameters        map[string]any
}

type Signal struct {
	Action      string
	Quantity    string
	Leverage    int
	Liquidity   paper.Liquidity
	LimitPrice  string
	StopLoss    string
	TakeProfit  string
	CloseReason paper.CloseReason
}

const (
	SignalHold      = "HOLD"
	SignalOpenLong  = "OPEN_LONG"
	SignalOpenShort = "OPEN_SHORT"
	SignalClose     = "CLOSE"
)

type RuntimeState struct {
	Paused          bool
	Strategy        map[string]string
	Position        *paper.Position
	Trade           *paper.TradeRecord
	Equity          string
	RealizedPnL     string
	LastSequence    uint64
	LastEventAt     time.Time
	ProcessedEvents uint64
}

type Strategy interface {
	OnMarket(context.Context, Bot, MarketEvent, map[string]string) (Signal, map[string]string, error)
}

type StrategyRegistry interface {
	Resolve(string) (Strategy, error)
}

type Executor interface {
	Handle(context.Context, Bot, MarketEvent, Signal, *RuntimeState) error
}

type BotStore interface {
	LoadActivePaperBots(context.Context) ([]Bot, error)
	RecordArenaBotError(context.Context, string, string, time.Time) error
}

type MarketSource interface {
	Snapshot(context.Context, string, string) (MarketEvent, error)
}

type DispatchReport struct {
	Matched   int
	Processed int
	Failed    int
	Skipped   int
}

type Options struct {
	Store      BotStore
	Strategies StrategyRegistry
	Executor   Executor
	Workers    int
}

type managedBot struct {
	bot      Bot
	strategy Strategy
	state    RuntimeState
	mutex    sync.Mutex
}

type Arena struct {
	store         BotStore
	strategies    StrategyRegistry
	executor      Executor
	workers       int
	mutex         sync.RWMutex
	bots          map[string]*managedBot
	subscriptions map[string][]string
}

func New(options Options) (*Arena, error) {
	if options.Store == nil || options.Strategies == nil || options.Executor == nil {
		return nil, errors.New("arena store, strategy registry and paper executor are required")
	}
	workers := options.Workers
	if workers <= 0 {
		workers = runtime.GOMAXPROCS(0)
	}
	if workers > 32 {
		workers = 32
	}
	return &Arena{
		store: options.Store, strategies: options.Strategies, executor: options.Executor, workers: workers,
		bots: make(map[string]*managedBot), subscriptions: make(map[string][]string),
	}, nil
}

func (arena *Arena) Load(ctx context.Context) error {
	bots, err := arena.store.LoadActivePaperBots(ctx)
	if err != nil {
		return fmt.Errorf("load active paper bots: %w", err)
	}
	loaded := make(map[string]*managedBot, len(bots))
	subscriptions := make(map[string][]string)
	now := time.Now().UTC()
	for _, bot := range bots {
		if len(bot.Symbols) == 0 && bot.Symbol != "" {
			bot.Symbols = []string{bot.Symbol}
		}
		if bot.ID == "" || bot.StrategyVersionID == "" || len(bot.Symbols) == 0 || bot.Timeframe == "" {
			_ = arena.store.RecordArenaBotError(ctx, bot.ID, "active paper bot is incomplete", now)
			continue
		}
		strategy, err := arena.strategies.Resolve(bot.StrategyVersionID)
		if err != nil {
			_ = arena.store.RecordArenaBotError(ctx, bot.ID, fmt.Sprintf("resolve strategy runtime: %v", err), now)
			continue
		}
		loaded[bot.ID] = &managedBot{bot: bot, strategy: strategy, state: RuntimeState{
			Strategy: make(map[string]string), Equity: bot.StartingBalance, RealizedPnL: "0",
		}}
		for _, symbol := range bot.Symbols {
			key := marketKey(symbol, bot.Timeframe)
			subscriptions[key] = append(subscriptions[key], bot.ID)
		}
	}
	for key := range subscriptions {
		sort.Strings(subscriptions[key])
	}
	arena.mutex.Lock()
	arena.bots, arena.subscriptions = loaded, subscriptions
	arena.mutex.Unlock()
	return nil
}

func (arena *Arena) Tick(ctx context.Context, source MarketSource, symbol, timeframe string) (DispatchReport, error) {
	if source == nil {
		return DispatchReport{}, errors.New("arena market source is required")
	}
	event, err := source.Snapshot(ctx, symbol, timeframe)
	if err != nil {
		return DispatchReport{}, fmt.Errorf("load shared market snapshot: %w", err)
	}
	return arena.Publish(ctx, event)
}

func (arena *Arena) Publish(ctx context.Context, event MarketEvent) (DispatchReport, error) {
	if event.Symbol == "" || event.Timeframe == "" || event.MarkPrice == "" || event.OccurredAt.IsZero() {
		return DispatchReport{}, errors.New("arena market event is incomplete")
	}
	arena.mutex.RLock()
	ids := append([]string(nil), arena.subscriptions[marketKey(event.Symbol, event.Timeframe)]...)
	managed := make([]*managedBot, 0, len(ids))
	for _, id := range ids {
		managed = append(managed, arena.bots[id])
	}
	arena.mutex.RUnlock()

	report := DispatchReport{Matched: len(managed)}
	if len(managed) == 0 {
		return report, nil
	}
	jobs := make(chan *managedBot)
	results := make(chan error, len(managed))
	workerCount := arena.workers
	if workerCount > len(managed) {
		workerCount = len(managed)
	}
	var wait sync.WaitGroup
	for index := 0; index < workerCount; index++ {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for bot := range jobs {
				results <- arena.processBot(ctx, bot, event)
			}
		}()
	}
	for _, bot := range managed {
		jobs <- bot
	}
	close(jobs)
	wait.Wait()
	close(results)
	for err := range results {
		switch {
		case err == nil:
			report.Processed++
		case errors.Is(err, errSkipped):
			report.Skipped++
		default:
			report.Failed++
		}
	}
	return report, nil
}

var errSkipped = errors.New("arena bot skipped")

func (arena *Arena) processBot(ctx context.Context, managed *managedBot, event MarketEvent) error {
	managed.mutex.Lock()
	defer managed.mutex.Unlock()
	if managed.state.Paused || event.Sequence <= managed.state.LastSequence || !event.OccurredAt.After(managed.state.LastEventAt) {
		return errSkipped
	}
	signal, nextState, err := managed.strategy.OnMarket(ctx, managed.bot, event, cloneState(managed.state.Strategy))
	if err == nil {
		err = arena.executor.Handle(ctx, managed.bot, event, signal, &managed.state)
	}
	if err != nil {
		_ = arena.store.RecordArenaBotError(ctx, managed.bot.ID, err.Error(), event.OccurredAt)
		return err
	}
	managed.state.Strategy = cloneState(nextState)
	managed.state.LastSequence = event.Sequence
	managed.state.LastEventAt = event.OccurredAt
	managed.state.ProcessedEvents++
	return nil
}

func (arena *Arena) Pause(botID string) error  { return arena.setPaused(botID, true) }
func (arena *Arena) Resume(botID string) error { return arena.setPaused(botID, false) }

func (arena *Arena) setPaused(botID string, paused bool) error {
	arena.mutex.RLock()
	bot := arena.bots[botID]
	arena.mutex.RUnlock()
	if bot == nil {
		return errors.New("arena bot not found")
	}
	bot.mutex.Lock()
	bot.state.Paused = paused
	bot.mutex.Unlock()
	return nil
}

func (arena *Arena) State(botID string) (RuntimeState, bool) {
	arena.mutex.RLock()
	bot := arena.bots[botID]
	arena.mutex.RUnlock()
	if bot == nil {
		return RuntimeState{}, false
	}
	bot.mutex.Lock()
	defer bot.mutex.Unlock()
	state := bot.state
	state.Strategy = cloneState(state.Strategy)
	if state.Position != nil {
		position := *state.Position
		state.Position = &position
	}
	if state.Trade != nil {
		trade := *state.Trade
		state.Trade = &trade
	}
	return state, true
}

func marketKey(symbol, timeframe string) string {
	return strings.ToUpper(symbol) + "|" + strings.ToLower(timeframe)
}
func cloneState(state map[string]string) map[string]string {
	cloned := make(map[string]string, len(state))
	for key, value := range state {
		cloned[key] = value
	}
	return cloned
}
