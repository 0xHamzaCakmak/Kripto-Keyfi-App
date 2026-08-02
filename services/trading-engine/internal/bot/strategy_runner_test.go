package bot

import (
	"context"
	"testing"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type strategyRunnerStore struct {
	account   MarketAccount
	reference string
	loaded    bool
}

func (s *strategyRunnerStore) LoadBotMarketAccount(context.Context, string, string) (MarketAccount, error) {
	s.loaded = true
	return s.account, nil
}
func (s *strategyRunnerStore) LoadLatestBotDecisionPrice(context.Context, string) (string, error) {
	return s.reference, nil
}

type fixedPriceReader struct{ price domain.Decimal }

func (r fixedPriceReader) GetMarkPrice(context.Context, string) (domain.Decimal, error) {
	return r.price, nil
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
