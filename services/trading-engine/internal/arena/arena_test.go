package arena

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/paper"
)

type arenaStore struct {
	bots       []Bot
	mutex      sync.Mutex
	errors     []string
	rejections []MarketRejection
}

func (store *arenaStore) RecordArenaMarketRejection(_ context.Context, _ []string, rejection MarketRejection) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	store.rejections = append(store.rejections, rejection)
	return nil
}

func (store *arenaStore) LoadActivePaperBots(context.Context) ([]Bot, error) {
	return append([]Bot(nil), store.bots...), nil
}
func (store *arenaStore) RecordArenaBotError(_ context.Context, id, message string, _ time.Time) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	store.errors = append(store.errors, id+":"+message)
	return nil
}

type countingSource struct {
	mutex sync.Mutex
	calls int
	event MarketEvent
}

func (source *countingSource) Snapshot(context.Context, string, string) (MarketEvent, error) {
	source.mutex.Lock()
	defer source.mutex.Unlock()
	source.calls++
	return source.event, nil
}

type holdStrategy struct{ failBot string }

func (strategy holdStrategy) OnMarket(_ context.Context, bot Bot, _ MarketEvent, state map[string]string) (Signal, map[string]string, error) {
	if bot.ID == strategy.failBot {
		return Signal{}, nil, fmt.Errorf("isolated strategy failure")
	}
	state["ticks"] = "seen"
	return Signal{Action: SignalHold}, state, nil
}

type countingExecutor struct {
	mutex   sync.Mutex
	calls   int
	failBot string
}

func (executor *countingExecutor) Handle(_ context.Context, bot Bot, _ MarketEvent, _ Signal, _ *RuntimeState) error {
	executor.mutex.Lock()
	executor.calls++
	executor.mutex.Unlock()
	if bot.ID == executor.failBot {
		return fmt.Errorf("isolated paper failure")
	}
	return nil
}

func hundredBots() []Bot {
	bots := make([]Bot, 100)
	for index := range bots {
		bots[index] = Bot{
			ID: fmt.Sprintf("bot-%03d", index), StrategyVersionID: "strategy-v1",
			Symbol: "BTCUSDT", Symbols: []string{"BTCUSDT"}, Timeframe: "1m", StartingBalance: "100",
		}
	}
	return bots
}

func loadedArena(t *testing.T, store *arenaStore, strategy Strategy, executor Executor) *Arena {
	t.Helper()
	registry := NewRegistry()
	if err := registry.Register("strategy-v1", strategy); err != nil {
		t.Fatal(err)
	}
	result, err := New(Options{
		Store: store, Strategies: registry, Executor: executor, Workers: 8,
		MaximumMarketEventAge: 10 * 365 * 24 * time.Hour, MaximumFutureSkew: 10 * 365 * 24 * time.Hour,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := result.Load(context.Background()); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestPublishRejectsStaleMarketDataBeforeStrategyDispatch(t *testing.T) {
	store := &arenaStore{bots: hundredBots()}
	executor := &countingExecutor{}
	registry := NewRegistry()
	if err := registry.Register("strategy-v1", holdStrategy{}); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 22, 12, 0, 0, 0, time.UTC)
	instance, err := New(Options{
		Store: store, Strategies: registry, Executor: executor, Workers: 8,
		MaximumMarketEventAge: 2 * time.Minute, MaximumFutureSkew: 5 * time.Second,
		Now: func() time.Time { return now },
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := instance.Load(context.Background()); err != nil {
		t.Fatal(err)
	}
	report, err := instance.Publish(context.Background(), MarketEvent{
		Symbol: "BTCUSDT", Timeframe: "1m", MarkPrice: "100", Sequence: 1,
		OccurredAt: now.Add(-2*time.Minute - time.Millisecond),
	})
	if err == nil || !strings.Contains(err.Error(), "STALE_MARKET_DATA") {
		t.Fatalf("expected stale rejection, got report=%#v err=%v", report, err)
	}
	if report.Matched != 100 || executor.calls != 0 || len(store.rejections) != 1 || store.rejections[0].Code != "STALE_MARKET_DATA" {
		t.Fatalf("stale event reached dispatch or was not audited: report=%#v calls=%d rejections=%#v", report, executor.calls, store.rejections)
	}
}

func TestPublishRejectsFutureSkewAndAcceptsBoundaryEvents(t *testing.T) {
	store := &arenaStore{bots: []Bot{{ID: "bot-1", StrategyVersionID: "strategy-v1", Symbol: "BTCUSDT", Timeframe: "1m", StartingBalance: "100"}}}
	executor := &countingExecutor{}
	registry := NewRegistry()
	if err := registry.Register("strategy-v1", holdStrategy{}); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 22, 12, 0, 0, 0, time.UTC)
	instance, err := New(Options{Store: store, Strategies: registry, Executor: executor,
		MaximumMarketEventAge: 2 * time.Minute, MaximumFutureSkew: 5 * time.Second, Now: func() time.Time { return now }})
	if err != nil {
		t.Fatal(err)
	}
	if err := instance.Load(context.Background()); err != nil {
		t.Fatal(err)
	}
	_, err = instance.Publish(context.Background(), MarketEvent{Symbol: "BTCUSDT", Timeframe: "1m", MarkPrice: "100", Sequence: 1, OccurredAt: now.Add(5*time.Second + time.Millisecond)})
	if err == nil || !strings.Contains(err.Error(), "FUTURE_MARKET_DATA") {
		t.Fatalf("expected future-skew rejection, got %v", err)
	}
	if executor.calls != 0 || len(store.rejections) != 1 || store.rejections[0].Code != "FUTURE_MARKET_DATA" {
		t.Fatalf("future event reached dispatch or was not audited")
	}
	_, err = instance.Publish(context.Background(), MarketEvent{Symbol: "BTCUSDT", Timeframe: "1m", MarkPrice: "100", Sequence: 2, OccurredAt: now.Add(-2 * time.Minute)})
	if err != nil || executor.calls != 1 {
		t.Fatalf("boundary event should be accepted, calls=%d err=%v", executor.calls, err)
	}
}

func TestOneSharedMarketFetchFansOutToOneHundredBots(t *testing.T) {
	store := &arenaStore{bots: hundredBots()}
	executor := &countingExecutor{}
	arena := loadedArena(t, store, holdStrategy{}, executor)
	source := &countingSource{event: MarketEvent{
		Symbol: "BTCUSDT", Timeframe: "1m", MarkPrice: "100", Sequence: 1,
		OccurredAt: time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC),
	}}
	report, err := arena.Tick(context.Background(), source, "BTCUSDT", "1m")
	if err != nil {
		t.Fatal(err)
	}
	if source.calls != 1 {
		t.Fatalf("expected one shared fetch, got %d", source.calls)
	}
	if report.Processed != 100 || report.Failed != 0 {
		t.Fatalf("unexpected report: %#v", report)
	}
	if executor.calls != 100 {
		t.Fatalf("expected 100 paper dispatches, got %d", executor.calls)
	}
	state, ok := arena.State("bot-099")
	if !ok || state.ProcessedEvents != 1 || state.Strategy["ticks"] != "seen" {
		t.Fatalf("runtime state missing: %#v", state)
	}
}

func TestPauseResumeAndDuplicateEventsAreBotScoped(t *testing.T) {
	store := &arenaStore{bots: hundredBots()}
	arena := loadedArena(t, store, holdStrategy{}, &countingExecutor{})
	if err := arena.Pause("bot-000"); err != nil {
		t.Fatal(err)
	}
	event := MarketEvent{Symbol: "BTCUSDT", Timeframe: "1m", MarkPrice: "100", Sequence: 2, OccurredAt: time.Now().UTC()}
	report, err := arena.Publish(context.Background(), event)
	if err != nil {
		t.Fatal(err)
	}
	if report.Processed != 99 || report.Skipped != 1 {
		t.Fatalf("unexpected paused report: %#v", report)
	}
	if err := arena.Resume("bot-000"); err != nil {
		t.Fatal(err)
	}
	report, err = arena.Publish(context.Background(), event)
	if err != nil {
		t.Fatal(err)
	}
	if report.Processed != 1 || report.Skipped != 99 {
		t.Fatalf("unexpected resume/duplicate report: %#v", report)
	}
}

func TestOneBotFailureDoesNotStopOtherBots(t *testing.T) {
	store := &arenaStore{bots: hundredBots()}
	arena := loadedArena(t, store, holdStrategy{}, &countingExecutor{failBot: "bot-042"})
	report, err := arena.Publish(context.Background(), MarketEvent{
		Symbol: "BTCUSDT", Timeframe: "1m", MarkPrice: "100", Sequence: 1, OccurredAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if report.Processed != 99 || report.Failed != 1 {
		t.Fatalf("failure was not isolated: %#v", report)
	}
	if len(store.errors) != 1 {
		t.Fatalf("expected one recorded bot error, got %d", len(store.errors))
	}
}

type lifecycleStrategy struct{}

func (lifecycleStrategy) OnMarket(_ context.Context, _ Bot, _ MarketEvent, state map[string]string) (Signal, map[string]string, error) {
	if state["opened"] == "" {
		state["opened"] = "yes"
		confidence := 0.76
		return Signal{Action: SignalOpenLong, Quantity: "1", Leverage: 5, Liquidity: paper.Taker, AIConfidence: &confidence, DecisionSummary: "arena test signal"}, state, nil
	}
	return Signal{Action: SignalClose, Liquidity: paper.Taker, CloseReason: paper.CloseManual}, state, nil
}

type memoryPaperStore struct{ created, closed []paper.TradeRecord }

func (store *memoryPaperStore) CreatePaperTrade(_ context.Context, trade paper.TradeRecord) error {
	store.created = append(store.created, trade)
	return nil
}
func (store *memoryPaperStore) ClosePaperTrade(_ context.Context, trade paper.TradeRecord) error {
	store.closed = append(store.closed, trade)
	return nil
}

func TestSignalsFlowThroughPaperEngineAndTradeStore(t *testing.T) {
	engine, err := paper.NewEngine(paper.DefaultFillConfig())
	if err != nil {
		t.Fatal(err)
	}
	tradeStore := &memoryPaperStore{}
	service, err := paper.NewService(engine, tradeStore)
	if err != nil {
		t.Fatal(err)
	}
	executor, err := NewPaperExecutor(engine, service)
	if err != nil {
		t.Fatal(err)
	}
	store := &arenaStore{bots: []Bot{{
		ID: "bot-1", StrategyVersionID: "strategy-v1", Symbol: "BTCUSDT", Timeframe: "1m", StartingBalance: "100",
	}}}
	arena := loadedArena(t, store, lifecycleStrategy{}, executor)
	base := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	for sequence, price := range []string{"100", "110"} {
		_, err := arena.Publish(context.Background(), MarketEvent{
			Symbol: "BTCUSDT", Timeframe: "1m", MarkPrice: price,
			Sequence: uint64(sequence + 1), OccurredAt: base.Add(time.Duration(sequence) * time.Minute), Context: map[string]any{"source": "shared-stream"},
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	if len(tradeStore.created) != 1 || len(tradeStore.closed) != 1 {
		t.Fatalf("paper persistence missing: %#v %#v", tradeStore.created, tradeStore.closed)
	}
	if tradeStore.created[0].MarketContext["source"] != "shared-stream" || tradeStore.created[0].AIConfidence == nil || tradeStore.created[0].DecisionSummary == "" {
		t.Fatalf("decision context did not reach trade memory: %#v", tradeStore.created[0])
	}
	if tradeStore.closed[0].MaxFavorableExcursion == "0.000000000000000000" {
		t.Fatalf("trade excursion was not updated: %#v", tradeStore.closed[0])
	}
	state, _ := arena.State("bot-1")
	if state.Position != nil || state.RealizedPnL == "0" || state.Equity == "100" {
		t.Fatalf("paper equity state was not updated: %#v", state)
	}
}

func BenchmarkArenaFanOut100Bots(benchmark *testing.B) {
	store := &arenaStore{bots: hundredBots()}
	registry := NewRegistry()
	_ = registry.Register("strategy-v1", holdStrategy{})
	arena, _ := New(Options{Store: store, Strategies: registry, Executor: &countingExecutor{}, Workers: 8})
	_ = arena.Load(context.Background())
	base := time.Date(2026, 8, 20, 12, 0, 0, 0, time.UTC)
	benchmark.ResetTimer()
	for index := 0; index < benchmark.N; index++ {
		_, _ = arena.Publish(context.Background(), MarketEvent{
			Symbol: "BTCUSDT", Timeframe: "1m", MarkPrice: "100", Sequence: uint64(index + 1),
			OccurredAt: base.Add(time.Duration(index) * time.Millisecond),
		})
	}
}
