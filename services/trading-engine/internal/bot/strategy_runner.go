package bot

import (
	"context"
	"fmt"
	"net/http"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/binance"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/bybit"
)

type PriceReader interface {
	GetMarkPrice(context.Context, string) (domain.Decimal, error)
}
type MarketAccount struct {
	Provider    domain.ExchangeProvider
	Environment domain.ExchangeEnvironment
}
type PriceReaderFactory func(MarketAccount) (PriceReader, error)
type StrategyStore interface {
	LoadBotMarketAccount(context.Context, string, string) (MarketAccount, error)
	LoadLatestBotDecisionPrice(context.Context, string) (string, error)
}

type StrategyRunner struct {
	store   StrategyStore
	factory PriceReaderFactory
}

func NewStrategyRunner(store StrategyStore, client *http.Client, endpoints exchange.Endpoints) *StrategyRunner {
	return NewStrategyRunnerWithFactory(store, func(account MarketAccount) (PriceReader, error) {
		switch account.Provider {
		case domain.ProviderBinance:
			return binance.New(binance.Options{Client: client, FuturesURL: endpoints.BinanceFutures, SpotURL: endpoints.BinanceSpot}), nil
		case domain.ProviderBybit:
			return bybit.New(bybit.Options{Client: client, BaseURL: endpoints.Bybit}), nil
		default:
			return nil, fmt.Errorf("unsupported strategy provider %q", account.Provider)
		}
	})
}

func NewStrategyRunnerWithFactory(store StrategyStore, factory PriceReaderFactory) *StrategyRunner {
	return &StrategyRunner{store: store, factory: factory}
}

func (r *StrategyRunner) Tick(ctx context.Context, instance Instance) (Decision, error) {
	account, err := r.store.LoadBotMarketAccount(ctx, instance.UserID, instance.ExchangeAccountID)
	if err != nil {
		return Decision{}, err
	}
	reader, err := r.factory(account)
	if err != nil {
		return Decision{}, err
	}
	markPrice, err := reader.GetMarkPrice(ctx, instance.Symbol)
	if err != nil {
		return Decision{}, err
	}
	referencePrice, err := r.store.LoadLatestBotDecisionPrice(ctx, instance.ID)
	if err != nil {
		return Decision{}, err
	}
	return EvaluateStrategy(instance, string(markPrice), referencePrice)
}
