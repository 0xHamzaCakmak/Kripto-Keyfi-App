package bot

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type strategyRunnerStore struct {
	account   MarketAccount
	reference string
	loaded    bool
}

func (s *strategyRunnerStore) LoadBotMarketAccount(context.Context, string, string, string) (MarketAccount, error) {
	s.loaded = true
	return s.account, nil
}
func (s *strategyRunnerStore) LoadBotStrategyFamily(context.Context, string) (string, error) {
	return "MOMENTUM", nil
}
func (s *strategyRunnerStore) LoadLatestBotDecisionPrice(context.Context, string) (string, error) {
	return s.reference, nil
}
func (s *strategyRunnerStore) LoadRecentNewsContext(context.Context, string, time.Time) (NewsContext, error) {
	return NewsContext{}, nil
}

type fixedPriceReader struct{ price domain.Decimal }

func (r fixedPriceReader) GetMarkPrice(context.Context, string) (domain.Decimal, error) {
	return r.price, nil
}

type blockingPriceReader struct {
	entered chan<- string
	release <-chan struct{}
}

func (r blockingPriceReader) GetMarkPrice(_ context.Context, symbol string) (domain.Decimal, error) {
	r.entered <- symbol
	<-r.release
	return "100", nil
}

type unavailableDerivativesReader struct{ fixedPriceReader }

func (r unavailableDerivativesReader) GetRecentCandles(_ context.Context, _ string, interval string, _ int) ([]domain.MarketCandle, error) {
	return trendingSnapshot(1).Candles[interval], nil
}
func (unavailableDerivativesReader) GetDerivativesContext(context.Context, string) (domain.DerivativesContext, error) {
	return domain.DerivativesContext{}, errors.New("OI unavailable")
}

func TestStrategyRunnerUsesPublicMarketAccount(t *testing.T) {
	store := &strategyRunnerStore{
		account:   MarketAccount{Provider: domain.ProviderBinance, Environment: domain.EnvironmentDemo},
		reference: "50000",
	}
	runner := NewStrategyRunnerWithFactory(store, func(account MarketAccount) (PriceReader, error) {
		if account.Provider != domain.ProviderBinance {
			t.Fatalf("unexpected provider: %s", account.Provider)
		}
		return fixedPriceReader{price: "50150"}, nil
	})
	decision, err := runner.Tick(t.Context(), scalpingInstance("SHADOW"))
	if err != nil || !store.loaded || decision.Kind != "BUY" {
		t.Fatalf("public strategy tick failed: %#v, err=%v", decision, err)
	}
}

func TestStrategyRunnerSeparatesPaperAndShadowMarketReaders(t *testing.T) {
	store := &strategyRunnerStore{account: MarketAccount{Provider: domain.ProviderBinance}, reference: "50000"}
	paperCalls, shadowCalls := 0, 0
	runner := &StrategyRunner{store: store,
		paperFactory: func(MarketAccount) (PriceReader, error) {
			paperCalls++
			return fixedPriceReader{price: "50150"}, nil
		},
		shadowFactory: func(MarketAccount) (PriceReader, error) {
			shadowCalls++
			return fixedPriceReader{price: "50150"}, nil
		},
	}
	if _, err := runner.Tick(t.Context(), scalpingInstance("PAPER")); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Tick(t.Context(), scalpingInstance("SHADOW")); err != nil {
		t.Fatal(err)
	}
	if paperCalls != 1 || shadowCalls != 1 {
		t.Fatalf("market readers crossed mode boundary: paper=%d shadow=%d", paperCalls, shadowCalls)
	}
}

func TestStrategyRunnerFansOutOnePriceAcrossPaperPopulation(t *testing.T) {
	store := &strategyRunnerStore{account: MarketAccount{Provider: domain.ProviderBinance}, reference: "50000"}
	calls := 0
	runner := NewStrategyRunnerWithFactory(store, func(MarketAccount) (PriceReader, error) {
		calls++
		return fixedPriceReader{price: "50150"}, nil
	})
	first, second := scalpingInstance("PAPER"), scalpingInstance("PAPER")
	second.ID = "bot-2"
	if _, err := runner.Tick(t.Context(), first); err != nil {
		t.Fatal(err)
	}
	if _, err := runner.Tick(t.Context(), second); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("expected one shared market read, got %d", calls)
	}
}

func TestStrategyRunnerFetchesDifferentSymbolsConcurrently(t *testing.T) {
	entered := make(chan string, 2)
	release := make(chan struct{})
	runner := NewStrategyRunnerWithFactory(&strategyRunnerStore{}, func(MarketAccount) (PriceReader, error) {
		return blockingPriceReader{entered: entered, release: release}, nil
	})
	account := MarketAccount{Provider: domain.ProviderBinance, Environment: domain.EnvironmentTestnet}
	done := make(chan error, 2)
	for _, symbol := range []string{"BTCUSDT", "ETHUSDT"} {
		go func() {
			_, err := runner.getMarkPrice(t.Context(), runner.paperFactory, account, "PAPER", symbol)
			done <- err
		}()
	}
	for range 2 {
		select {
		case <-entered:
		case <-time.After(500 * time.Millisecond):
			close(release)
			t.Fatal("different-symbol market fetches were serialized by the cache lock")
		}
	}
	close(release)
	for range 2 {
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}
}

func TestAutonomousRunnerSeparatesPaperTrainingFromTestnetDerivativesGate(t *testing.T) {
	store := &strategyRunnerStore{account: MarketAccount{Provider: domain.ProviderBinance}, reference: "209"}
	runner := NewStrategyRunnerWithFactory(store, func(MarketAccount) (PriceReader, error) {
		return unavailableDerivativesReader{fixedPriceReader{price: "209.5"}}, nil
	})
	instance := autonomousMomentumInstance("PAPER")
	instance.Configuration["signalThresholdBps"] = float64(5)
	decision, err := runner.Tick(t.Context(), instance)
	if err != nil || decision.Kind != "BUY" || decision.HypotheticalOrder == nil || decision.Metrics["derivativesAvailable"] != false {
		t.Fatalf("PAPER training did not accept valid price evidence: %#v err=%v", decision, err)
	}
	instance.Mode = "DEMO"
	decision, err = runner.Tick(t.Context(), instance)
	if err != nil || decision.Kind != "HOLD" || decision.HypotheticalOrder != nil {
		t.Fatalf("TESTNET derivatives gate was relaxed: %#v err=%v", decision, err)
	}
}
