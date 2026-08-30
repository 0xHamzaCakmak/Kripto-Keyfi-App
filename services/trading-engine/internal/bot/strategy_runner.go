package bot

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/binance"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/bybit"
)

type PriceReader interface {
	GetMarkPrice(context.Context, string) (domain.Decimal, error)
}
type ChartReader interface {
	GetRecentCloses(context.Context, string, string, int) ([]domain.Decimal, error)
}
type MarketContextReader interface {
	GetRecentCandles(context.Context, string, string, int) ([]domain.MarketCandle, error)
	GetDerivativesContext(context.Context, string) (domain.DerivativesContext, error)
}
type LiquidationContextReader interface {
	LiquidationContext(context.Context, string, time.Time) (LiquidationContext, error)
}
type MarketAccount struct {
	Provider    domain.ExchangeProvider
	Environment domain.ExchangeEnvironment
}
type PriceReaderFactory func(MarketAccount) (PriceReader, error)
type StrategyStore interface {
	LoadBotMarketAccount(context.Context, string, string, string) (MarketAccount, error)
	LoadBotStrategyFamily(context.Context, string) (string, error)
	LoadLatestBotDecisionPrice(context.Context, string) (string, error)
	LoadRecentNewsContext(context.Context, string, time.Time) (NewsContext, error)
}

type StrategyRunner struct {
	store                       StrategyStore
	paperFactory, shadowFactory PriceReaderFactory
	cacheMu                     sync.RWMutex
	keyLocksMu                  sync.Mutex
	keyLocks                    map[string]*sync.Mutex
	priceCache                  map[string]cachedPrice
	chartCache                  map[string]cachedChart
	candleCache                 map[string]cachedCandles
	derivativesCache            map[string]cachedDerivatives
	cacheTTL                    time.Duration
	now                         func() time.Time
	liquidationReader           LiquidationContextReader
}

func (r *StrategyRunner) SetLiquidationReader(reader LiquidationContextReader) {
	r.liquidationReader = reader
}

type cachedPrice struct {
	value domain.Decimal
	at    time.Time
}

type cachedChart struct {
	values []domain.Decimal
	at     time.Time
}
type cachedCandles struct {
	values []domain.MarketCandle
	at     time.Time
}
type cachedDerivatives struct {
	value domain.DerivativesContext
	at    time.Time
}

func NewStrategyRunner(store StrategyStore, client *http.Client, paperEndpoints, shadowEndpoints exchange.Endpoints) *StrategyRunner {
	return &StrategyRunner{store: store,
		paperFactory:  endpointPriceReaderFactory(client, paperEndpoints),
		shadowFactory: endpointPriceReaderFactory(client, shadowEndpoints),
		priceCache:    make(map[string]cachedPrice), chartCache: make(map[string]cachedChart), candleCache: make(map[string]cachedCandles), derivativesCache: make(map[string]cachedDerivatives), keyLocks: make(map[string]*sync.Mutex), cacheTTL: 5 * time.Second, now: time.Now,
	}
}

func endpointPriceReaderFactory(client *http.Client, endpoints exchange.Endpoints) PriceReaderFactory {
	return func(account MarketAccount) (PriceReader, error) {
		switch account.Provider {
		case domain.ProviderBinance:
			return binance.New(binance.Options{Client: client, FuturesURL: endpoints.BinanceFutures, SpotURL: endpoints.BinanceSpot}), nil
		case domain.ProviderBybit:
			return bybit.New(bybit.Options{Client: client, BaseURL: endpoints.Bybit}), nil
		default:
			return nil, fmt.Errorf("unsupported strategy provider %q", account.Provider)
		}
	}
}

func NewStrategyRunnerWithFactory(store StrategyStore, factory PriceReaderFactory) *StrategyRunner {
	return &StrategyRunner{store: store, paperFactory: factory, shadowFactory: factory, priceCache: make(map[string]cachedPrice), chartCache: make(map[string]cachedChart), candleCache: make(map[string]cachedCandles), derivativesCache: make(map[string]cachedDerivatives), keyLocks: make(map[string]*sync.Mutex), cacheTTL: 5 * time.Second, now: time.Now}
}

func (r *StrategyRunner) lockFor(key string) *sync.Mutex {
	r.keyLocksMu.Lock()
	defer r.keyLocksMu.Unlock()
	if r.keyLocks == nil {
		r.keyLocks = make(map[string]*sync.Mutex)
	}
	if lock := r.keyLocks[key]; lock != nil {
		return lock
	}
	lock := &sync.Mutex{}
	r.keyLocks[key] = lock
	return lock
}

func (r *StrategyRunner) Tick(ctx context.Context, instance Instance) (Decision, error) {
	if instance.Type == "AUTONOMOUS" && strings.TrimSpace(instance.StrategyFamily) == "" {
		family, err := r.store.LoadBotStrategyFamily(ctx, instance.ID)
		if err != nil {
			return Decision{}, err
		}
		instance.StrategyFamily = family
	}
	account, err := r.store.LoadBotMarketAccount(ctx, instance.UserID, instance.ExchangeAccountID, instance.Mode)
	if err != nil {
		return Decision{}, err
	}
	factory := r.paperFactory
	if instance.Mode == "SHADOW" {
		factory = r.shadowFactory
	}
	markPrice, err := r.getMarkPrice(ctx, factory, account, instance.Mode, instance.Symbol)
	if err != nil {
		return Decision{}, err
	}
	referencePrice, err := r.store.LoadLatestBotDecisionPrice(ctx, instance.ID)
	if err != nil {
		return Decision{}, err
	}
	if manual, ok := manualBotEntryDecision(instance, string(markPrice), referencePrice); ok {
		return manual, nil
	}
	if _, controlled := instance.Configuration["manualPositionControl"].(map[string]any); controlled {
		return Decision{Kind: "HOLD", Summary: "Manuel bot pozisyonu kapanana kadar otomatik yeni girişler bekletiliyor.", MarkPrice: string(markPrice), ReferencePrice: referencePrice,
			Metrics: map[string]any{"manualPositionControl": true}}, nil
	}
	if instance.Type == "AUTONOMOUS" {
		snapshot := MarketSnapshot{Candles: make(map[string][]domain.MarketCandle)}
		for _, request := range []struct {
			interval string
			limit    int
		}{{"15m", 193}, {"1h", 49}} {
			candles, marketErr := r.getRecentCandles(ctx, factory, account, instance.Mode, instance.Symbol, request.interval, request.limit)
			if marketErr != nil {
				return Decision{}, fmt.Errorf("load autonomous %s market context: %w", request.interval, marketErr)
			}
			snapshot.Candles[request.interval] = candles
		}
		derivatives, marketErr := r.getDerivativesContext(ctx, factory, account, instance.Mode, instance.Symbol)
		if marketErr != nil {
			// A demo/public symbol may expose valid candles but no OI history.
			// Missing evidence blocks the entry instead of crashing the bot.
			snapshot.DerivativesUnavailable = true
		} else {
			snapshot.Derivatives = derivatives
		}
		news, newsErr := r.store.LoadRecentNewsContext(ctx, instance.Symbol, r.now().UTC())
		if newsErr == nil {
			snapshot.News = news
		}
		if r.liquidationReader != nil {
			liquidations, liquidationErr := r.liquidationReader.LiquidationContext(ctx, instance.Symbol, r.now().UTC())
			if liquidationErr == nil {
				snapshot.Liquidations = liquidations
			}
		}
		return EvaluateStrategyWithMarket(instance, string(markPrice), referencePrice, snapshot)
	}
	return EvaluateStrategy(instance, string(markPrice), referencePrice)
}

func manualBotEntryDecision(instance Instance, markPrice, referencePrice string) (Decision, bool) {
	instruction, ok := instance.Configuration["manualBotEntry"].(map[string]any)
	if !ok || instance.Type != "AUTONOMOUS" || instance.Mode != "DEMO" {
		return Decision{}, false
	}
	id, idOK := instruction["id"].(string)
	campaignID, campaignOK := instruction["campaignId"].(string)
	side, sideOK := instruction["side"].(string)
	margin, marginOK := numberConfig(instruction, "initialMarginUsdt")
	leverageValue, leverageOK := numberConfig(instruction, "leverage")
	stopBps, stopOK := numberConfig(instruction, "stopLossBps")
	takeBps, takeOK := numberConfig(instruction, "takeProfitBps")
	mark, markOK := decimalRat(markPrice)
	leverage := int(leverageValue)
	if !idOK || !campaignOK || !sideOK || !marginOK || !leverageOK || !stopOK || !takeOK || !markOK ||
		id == "" || campaignID == "" || (side != "BUY" && side != "SELL") || margin <= 0 || leverage < 5 || leverage > 20 || stopBps <= 0 || takeBps <= 0 || mark.Sign() <= 0 {
		return Decision{Kind: "HOLD", Summary: "Manuel bot talimatı geçersiz; güvenli biçimde emir üretilmedi.", MarkPrice: markPrice, ReferencePrice: referencePrice,
			Metrics: map[string]any{"manualBotInstruction": true, "manualCampaignItemId": id, "manualCampaignId": campaignID, "manualInstructionInvalid": true}}, true
	}
	marginRat, _ := new(big.Rat).SetString(strconv.FormatFloat(margin, 'f', 8, 64))
	notional := new(big.Rat).Mul(marginRat, big.NewRat(int64(leverage), 1))
	quantity := new(big.Rat).Quo(notional, mark).FloatString(18)
	stop, take, protectionErr := protectionPrices(markPrice, side, stopBps, takeBps)
	if protectionErr != nil {
		return Decision{Kind: "HOLD", Summary: "Manuel bot koruma fiyatları hesaplanamadı.", MarkPrice: markPrice, ReferencePrice: referencePrice,
			Metrics: map[string]any{"manualBotInstruction": true, "manualCampaignItemId": id, "manualCampaignId": campaignID, "manualInstructionInvalid": true}}, true
	}
	return Decision{
		Kind: side, Summary: "Admin tarafından verilen tek seferlik manuel bot yön talimatı.", MarkPrice: markPrice, ReferencePrice: referencePrice,
		Metrics: map[string]any{"manualBotInstruction": true, "manualCampaignItemId": id, "manualCampaignId": campaignID, "manualDirection": true},
		HypotheticalOrder: map[string]any{
			"symbol": instance.Symbol, "side": side, "quantity": quantity, "leverage": leverage, "price": markPrice,
			"stopLoss": stop, "takeProfit": take, "stopLossBps": stopBps, "takeProfitBps": takeBps,
			"marginMode": "ISOLATED", "manualDirection": true, "manualInitialMarginUsdt": margin,
			"manualCampaignItemId": id, "manualCampaignId": campaignID, "submittedToExchange": false,
		},
	}, true
}

func (r *StrategyRunner) getRecentCandles(ctx context.Context, factory PriceReaderFactory, account MarketAccount, mode, symbol, interval string, limit int) ([]domain.MarketCandle, error) {
	key := mode + ":" + string(account.Provider) + ":" + string(account.Environment) + ":" + symbol + ":candles:" + interval
	now := r.now()
	r.cacheMu.RLock()
	if cached, ok := r.candleCache[key]; ok && now.Sub(cached.at) < r.cacheTTL {
		r.cacheMu.RUnlock()
		return append([]domain.MarketCandle(nil), cached.values...), nil
	}
	r.cacheMu.RUnlock()
	keyLock := r.lockFor(key)
	keyLock.Lock()
	defer keyLock.Unlock()
	now = r.now()
	r.cacheMu.RLock()
	if cached, ok := r.candleCache[key]; ok && now.Sub(cached.at) < r.cacheTTL {
		r.cacheMu.RUnlock()
		return append([]domain.MarketCandle(nil), cached.values...), nil
	}
	r.cacheMu.RUnlock()
	reader, err := factory(account)
	if err != nil {
		return nil, err
	}
	marketReader, ok := reader.(MarketContextReader)
	if !ok {
		return nil, errors.New("market reader does not support multi-timeframe candles")
	}
	values, err := marketReader.GetRecentCandles(ctx, symbol, interval, limit)
	if err != nil {
		return nil, err
	}
	r.cacheMu.Lock()
	if r.candleCache == nil {
		r.candleCache = make(map[string]cachedCandles)
	}
	r.candleCache[key] = cachedCandles{values: append([]domain.MarketCandle(nil), values...), at: now}
	r.cacheMu.Unlock()
	return values, nil
}

func (r *StrategyRunner) getDerivativesContext(ctx context.Context, factory PriceReaderFactory, account MarketAccount, mode, symbol string) (domain.DerivativesContext, error) {
	key := mode + ":" + string(account.Provider) + ":" + string(account.Environment) + ":" + symbol + ":derivatives"
	now := r.now()
	r.cacheMu.RLock()
	if cached, ok := r.derivativesCache[key]; ok && now.Sub(cached.at) < r.cacheTTL {
		r.cacheMu.RUnlock()
		return cached.value, nil
	}
	r.cacheMu.RUnlock()
	keyLock := r.lockFor(key)
	keyLock.Lock()
	defer keyLock.Unlock()
	now = r.now()
	r.cacheMu.RLock()
	if cached, ok := r.derivativesCache[key]; ok && now.Sub(cached.at) < r.cacheTTL {
		r.cacheMu.RUnlock()
		return cached.value, nil
	}
	r.cacheMu.RUnlock()
	reader, err := factory(account)
	if err != nil {
		return domain.DerivativesContext{}, err
	}
	marketReader, ok := reader.(MarketContextReader)
	if !ok {
		return domain.DerivativesContext{}, errors.New("market reader does not support derivatives context")
	}
	value, err := marketReader.GetDerivativesContext(ctx, symbol)
	if err != nil {
		return domain.DerivativesContext{}, err
	}
	r.cacheMu.Lock()
	if r.derivativesCache == nil {
		r.derivativesCache = make(map[string]cachedDerivatives)
	}
	r.derivativesCache[key] = cachedDerivatives{value: value, at: now}
	r.cacheMu.Unlock()
	return value, nil
}

func (r *StrategyRunner) getRecentCloses(ctx context.Context, factory PriceReaderFactory, account MarketAccount, mode, symbol, interval string, limit int) ([]domain.Decimal, error) {
	if r.cacheTTL <= 0 {
		r.cacheTTL = 5 * time.Second
	}
	if r.now == nil {
		r.now = time.Now
	}
	key := mode + ":" + string(account.Provider) + ":" + string(account.Environment) + ":" + symbol + ":" + interval
	now := r.now()
	r.cacheMu.RLock()
	if cached, ok := r.chartCache[key]; ok && now.Sub(cached.at) < r.cacheTTL {
		r.cacheMu.RUnlock()
		return append([]domain.Decimal(nil), cached.values...), nil
	}
	r.cacheMu.RUnlock()
	keyLock := r.lockFor(key)
	keyLock.Lock()
	defer keyLock.Unlock()
	now = r.now()
	r.cacheMu.RLock()
	if cached, ok := r.chartCache[key]; ok && now.Sub(cached.at) < r.cacheTTL {
		r.cacheMu.RUnlock()
		return append([]domain.Decimal(nil), cached.values...), nil
	}
	r.cacheMu.RUnlock()
	reader, err := factory(account)
	if err != nil {
		return nil, err
	}
	chartReader, ok := reader.(ChartReader)
	if !ok {
		return nil, errors.New("market reader does not support chart data")
	}
	values, err := chartReader.GetRecentCloses(ctx, symbol, interval, limit)
	if err != nil {
		return nil, err
	}
	r.cacheMu.Lock()
	if r.chartCache == nil {
		r.chartCache = make(map[string]cachedChart)
	}
	r.chartCache[key] = cachedChart{values: append([]domain.Decimal(nil), values...), at: now}
	r.cacheMu.Unlock()
	return values, nil
}

func (r *StrategyRunner) getMarkPrice(ctx context.Context, factory PriceReaderFactory, account MarketAccount, mode, symbol string) (domain.Decimal, error) {
	if r.cacheTTL <= 0 {
		r.cacheTTL = 5 * time.Second
	}
	if r.now == nil {
		r.now = time.Now
	}
	key := mode + ":" + string(account.Provider) + ":" + string(account.Environment) + ":" + symbol
	now := r.now()
	r.cacheMu.RLock()
	if cached, ok := r.priceCache[key]; ok && now.Sub(cached.at) < r.cacheTTL {
		r.cacheMu.RUnlock()
		return cached.value, nil
	}
	r.cacheMu.RUnlock()
	keyLock := r.lockFor(key)
	keyLock.Lock()
	defer keyLock.Unlock()
	now = r.now()
	r.cacheMu.RLock()
	if cached, ok := r.priceCache[key]; ok && now.Sub(cached.at) < r.cacheTTL {
		r.cacheMu.RUnlock()
		return cached.value, nil
	}
	r.cacheMu.RUnlock()
	reader, err := factory(account)
	if err != nil {
		return "", err
	}
	markPrice, err := reader.GetMarkPrice(ctx, symbol)
	if err != nil {
		return "", err
	}
	r.cacheMu.Lock()
	if r.priceCache == nil {
		r.priceCache = make(map[string]cachedPrice)
	}
	r.priceCache[key] = cachedPrice{value: markPrice, at: now}
	r.cacheMu.Unlock()
	return markPrice, nil
}
