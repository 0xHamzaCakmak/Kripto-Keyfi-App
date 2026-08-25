package shadow

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

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

type readOnlyAccountStore interface {
	ResolveReadOnly(context.Context, string, string) (account.Resolved, error)
}

type Service struct {
	store   account.Store
	factory ReaderFactory
	cacheMu sync.Mutex
	cache   map[string]cachedSnapshot
	locks   map[string]*sync.Mutex
}

type cachedSnapshot struct {
	value Snapshot
	at    time.Time
}

const snapshotTTL = 5 * time.Second

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
	accountLock := s.lockFor(accountID)
	accountLock.Lock()
	defer accountLock.Unlock()
	s.cacheMu.Lock()
	cached, ok := s.cache[accountID]
	s.cacheMu.Unlock()
	if ok && time.Since(cached.at) < snapshotTTL {
		return cached.value, nil
	}
	var resolved account.Resolved
	var err error
	if readStore, ok := s.store.(readOnlyAccountStore); ok {
		resolved, err = readStore.ResolveReadOnly(ctx, userID, accountID)
	} else {
		resolved, err = s.store.Resolve(ctx, userID, accountID)
	}
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
	s.cacheMu.Lock()
	if s.cache == nil {
		s.cache = make(map[string]cachedSnapshot)
	}
	s.cache[accountID] = cachedSnapshot{value: result, at: time.Now()}
	s.cacheMu.Unlock()
	return result, nil
}

func (s *Service) lockFor(accountID string) *sync.Mutex {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	if s.locks == nil {
		s.locks = make(map[string]*sync.Mutex)
	}
	if existing := s.locks[accountID]; existing != nil {
		return existing
	}
	created := &sync.Mutex{}
	s.locks[accountID] = created
	return created
}
