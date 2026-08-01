package shadow

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/binance"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/bybit"
)

type Snapshot struct {
	Account   domain.ExchangeAccountRef `json:"account"`
	Balances  []domain.Balance          `json:"balances"`
	Symbols   []domain.SymbolRule       `json:"symbols"`
	Orders    []domain.Order            `json:"orders"`
	Positions []domain.Position         `json:"positions"`
}

type ReaderFactory func(account.Resolved) (exchange.Reader, error)

type Service struct {
	store   account.Store
	factory ReaderFactory
}

func New(store account.Store, client *http.Client, endpoints exchange.Endpoints) *Service {
	return &Service{store: store, factory: func(resolved account.Resolved) (exchange.Reader, error) {
		switch resolved.Reference.Provider {
		case domain.ProviderBinance:
			return binance.New(binance.Options{
				Credentials: resolved.Credentials, Client: client,
				FuturesURL: endpoints.BinanceFutures, SpotURL: endpoints.BinanceSpot,
			}), nil
		case domain.ProviderBybit:
			return bybit.New(bybit.Options{Credentials: resolved.Credentials, Client: client, BaseURL: endpoints.Bybit}), nil
		default:
			return nil, fmt.Errorf("unsupported exchange provider %q", resolved.Reference.Provider)
		}
	}}
}

func NewWithFactory(store account.Store, factory ReaderFactory) *Service {
	return &Service{store: store, factory: factory}
}

func (s *Service) Snapshot(ctx context.Context, userID, accountID string) (Snapshot, error) {
	if userID == "" || accountID == "" {
		return Snapshot{}, errors.New("userId and accountId are required")
	}
	resolved, err := s.store.Resolve(ctx, userID, accountID)
	if err != nil {
		return Snapshot{}, err
	}
	reader, err := s.factory(resolved)
	if err != nil {
		return Snapshot{}, err
	}
	result := Snapshot{Account: resolved.Reference}
	var wait sync.WaitGroup
	var balancesErr, symbolsErr, ordersErr, positionsErr error
	wait.Add(4)
	go func() { defer wait.Done(); result.Balances, balancesErr = reader.GetBalances(ctx) }()
	go func() { defer wait.Done(); result.Symbols, symbolsErr = reader.GetSymbols(ctx) }()
	go func() { defer wait.Done(); result.Orders, ordersErr = reader.GetOpenOrders(ctx) }()
	go func() { defer wait.Done(); result.Positions, positionsErr = reader.GetPositions(ctx) }()
	wait.Wait()
	if err := errors.Join(balancesErr, symbolsErr, ordersErr, positionsErr); err != nil {
		return Snapshot{}, err
	}
	return result, nil
}
