package binance

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

type Reader struct {
	credentials exchange.Credentials
	client      *http.Client
	futuresURL  string
	spotURL     string
	now         func() time.Time
}

type Options struct {
	Credentials exchange.Credentials
	Client      *http.Client
	FuturesURL  string
	SpotURL     string
	Now         func() time.Time
}

func New(options Options) *Reader {
	endpoints := exchange.DemoEndpoints()
	client := options.Client
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	now := options.Now
	if now == nil {
		now = time.Now
	}
	return &Reader{
		credentials: options.Credentials, client: client,
		futuresURL: first(options.FuturesURL, endpoints.BinanceFutures),
		spotURL:    first(options.SpotURL, endpoints.BinanceSpot), now: now,
	}
}

type futuresAccount struct {
	Assets []struct {
		Asset            string `json:"asset"`
		WalletBalance    string `json:"walletBalance"`
		AvailableBalance string `json:"availableBalance"`
		UnrealizedProfit string `json:"unrealizedProfit"`
		MarginAvailable  bool   `json:"marginAvailable"`
	} `json:"assets"`
	Code int `json:"code"`
}

type spotAccount struct {
	Balances []struct {
		Asset  string `json:"asset"`
		Free   string `json:"free"`
		Locked string `json:"locked"`
	} `json:"balances"`
	Code int `json:"code"`
}

type ticker struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
}

func (r *Reader) GetBalances(ctx context.Context) ([]domain.Balance, error) {
	var spot spotAccount
	if err := r.signedGet(ctx, r.spotURL, "/api/v3/account", nil, &spot); err != nil {
		return nil, err
	}
	var futures futuresAccount
	if err := r.signedGet(ctx, r.futuresURL, "/fapi/v3/account", nil, &futures); err != nil {
		return nil, err
	}
	prices := r.spotPrices(ctx)
	balances := make([]domain.Balance, 0, len(spot.Balances)+len(futures.Assets))
	for _, item := range spot.Balances {
		if !exchange.IsNonZero(item.Free) && !exchange.IsNonZero(item.Locked) {
			continue
		}
		walletBalance := exchange.AddDecimal(item.Free, item.Locked)
		balance := domain.Balance{
			WalletType: domain.WalletSpot, Asset: item.Asset, WalletBalance: domain.Decimal(walletBalance),
			AvailableBalance: domain.Decimal(item.Free), LockedBalance: domain.Decimal(item.Locked), UnrealizedPnL: "0",
		}
		if price := usdtPrice(item.Asset, prices); price != "" {
			balance.PriceUSDT = domain.Decimal(price)
			balance.ValueUSDT = domain.Decimal(exchange.MultiplyDecimal(walletBalance, price, 8))
		}
		balances = append(balances, balance)
	}
	sort.Slice(balances, func(i, j int) bool { return balances[i].Asset < balances[j].Asset })
	for _, item := range futures.Assets {
		if !exchange.IsNonZero(item.WalletBalance) && !exchange.IsNonZero(item.UnrealizedProfit) {
			continue
		}
		balance := domain.Balance{
			WalletType: domain.WalletUSDMFutures, Asset: item.Asset,
			WalletBalance: domain.Decimal(item.WalletBalance), AvailableBalance: domain.Decimal(item.AvailableBalance),
			UnrealizedPnL: domain.Decimal(item.UnrealizedProfit), MarginAvailable: item.MarginAvailable,
		}
		if price := usdtPrice(item.Asset, prices); price != "" {
			balance.PriceUSDT = domain.Decimal(price)
			balance.ValueUSDT = domain.Decimal(exchange.MultiplyDecimal(item.WalletBalance, price, 8))
		}
		balances = append(balances, balance)
	}
	return balances, nil
}

type exchangeInfo struct {
	Symbols []struct {
		Symbol       string `json:"symbol"`
		Status       string `json:"status"`
		BaseAsset    string `json:"baseAsset"`
		QuoteAsset   string `json:"quoteAsset"`
		ContractType string `json:"contractType"`
		Filters      []struct {
			FilterType string `json:"filterType"`
			TickSize   string `json:"tickSize"`
			StepSize   string `json:"stepSize"`
			MinQty     string `json:"minQty"`
			MaxQty     string `json:"maxQty"`
			Notional   string `json:"notional"`
		} `json:"filters"`
	} `json:"symbols"`
}

type leverageBracket struct {
	Symbol   string `json:"symbol"`
	Brackets []struct {
		InitialLeverage int `json:"initialLeverage"`
	} `json:"brackets"`
	Code int `json:"code"`
}

func (r *Reader) GetSymbols(ctx context.Context) ([]domain.SymbolRule, error) {
	var info exchangeInfo
	if err := r.publicGet(ctx, r.futuresURL, "/fapi/v1/exchangeInfo", nil, &info); err != nil {
		return nil, err
	}
	var brackets []leverageBracket
	if err := r.signedGet(ctx, r.futuresURL, "/fapi/v1/leverageBracket", nil, &brackets); err != nil {
		return nil, err
	}
	leverage := make(map[string]int, len(brackets))
	for _, item := range brackets {
		if len(item.Brackets) > 0 {
			leverage[item.Symbol] = item.Brackets[0].InitialLeverage
		}
	}
	rules := make([]domain.SymbolRule, 0, len(info.Symbols))
	for _, symbol := range info.Symbols {
		if symbol.Status != "TRADING" || symbol.QuoteAsset != "USDT" || symbol.ContractType != "PERPETUAL" {
			continue
		}
		filters := make(map[string]struct{ TickSize, StepSize, MinQty, MaxQty, Notional string })
		for _, item := range symbol.Filters {
			filters[item.FilterType] = struct{ TickSize, StepSize, MinQty, MaxQty, Notional string }{
				item.TickSize, item.StepSize, item.MinQty, item.MaxQty, item.Notional,
			}
		}
		price, lot, marketLot, notional := filters["PRICE_FILTER"], filters["LOT_SIZE"], filters["MARKET_LOT_SIZE"], filters["MIN_NOTIONAL"]
		maxLeverage := leverage[symbol.Symbol]
		if symbol.Symbol == "" || price.TickSize == "" || lot.StepSize == "" || lot.MinQty == "" || lot.MaxQty == "" || notional.Notional == "" || maxLeverage == 0 {
			continue
		}
		maxQuantity := marketLot.MaxQty
		if maxQuantity == "" {
			maxQuantity = lot.MaxQty
		}
		rules = append(rules, domain.SymbolRule{
			Symbol: symbol.Symbol, BaseAsset: symbol.BaseAsset, QuoteAsset: "USDT", Status: "TRADING",
			TickSize: domain.Decimal(price.TickSize), StepSize: domain.Decimal(lot.StepSize),
			MinQuantity: domain.Decimal(lot.MinQty), MaxQuantity: domain.Decimal(maxQuantity),
			MinNotional: domain.Decimal(notional.Notional), MaxLeverage: maxLeverage,
		})
	}
	return rules, nil
}

type order struct {
	OrderID     int64  `json:"orderId"`
	ClientID    string `json:"clientOrderId"`
	Symbol      string `json:"symbol"`
	Side        string `json:"side"`
	Type        string `json:"type"`
	Status      string `json:"status"`
	OriginalQty string `json:"origQty"`
	ExecutedQty string `json:"executedQty"`
	Price       string `json:"price"`
	StopPrice   string `json:"stopPrice"`
	ReduceOnly  bool   `json:"reduceOnly"`
	Time        int64  `json:"time"`
	UpdateTime  int64  `json:"updateTime"`
}

type algoOrder struct {
	AlgoID        int64  `json:"algoId"`
	ClientAlgoID  string `json:"clientAlgoId"`
	OrderType     string `json:"orderType"`
	Symbol        string `json:"symbol"`
	Side          string `json:"side"`
	Quantity      string `json:"quantity"`
	AlgoStatus    string `json:"algoStatus"`
	ActualOrderID string `json:"actualOrderId"`
	ActualPrice   string `json:"actualPrice"`
	TriggerPrice  string `json:"triggerPrice"`
	Price         string `json:"price"`
	ReduceOnly    bool   `json:"reduceOnly"`
	CreateTime    int64  `json:"createTime"`
	UpdateTime    int64  `json:"updateTime"`
}

func (r *Reader) GetOpenOrders(ctx context.Context) ([]domain.Order, error) {
	var source []order
	if err := r.signedGet(ctx, r.futuresURL, "/fapi/v1/openOrders", nil, &source); err != nil {
		return nil, err
	}
	result := make([]domain.Order, 0, len(source))
	for _, item := range source {
		if item.OrderID == 0 || item.Symbol == "" {
			return nil, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
		}
		result = append(result, mapOrder(item))
	}
	var algos []algoOrder
	if err := r.signedGet(ctx, r.futuresURL, "/fapi/v1/openAlgoOrders", url.Values{"algoType": {"CONDITIONAL"}}, &algos); err != nil {
		return nil, err
	}
	for _, item := range algos {
		if item.AlgoID == 0 || item.Symbol == "" || item.ClientAlgoID == "" {
			return nil, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
		}
		result = append(result, mapAlgoOrder(item))
	}
	return result, nil
}

// GetOrderByClientID is a read-only reconciliation lookup. It must be used
// after an uncertain write instead of submitting or canceling the order again.
func (r *Reader) GetOrderByClientID(ctx context.Context, symbol, clientOrderID string) (domain.Order, error) {
	var source order
	if err := r.signedGet(ctx, r.futuresURL, "/fapi/v1/order", url.Values{
		"symbol": {symbol}, "origClientOrderId": {clientOrderID},
	}, &source); err == nil {
		if source.OrderID == 0 || source.Symbol == "" || source.ClientID == "" {
			return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
		}
		return mapOrder(source), nil
	}

	// Binance stores conditional Futures orders in the Algo Order API. A
	// reconciliation lookup cannot know from its local record whether Binance
	// accepted the request as a regular or conditional order, so fall back to
	// the read-only algo lookup when the regular order is not found.
	var algo algoOrder
	if err := r.signedGet(ctx, r.futuresURL, "/fapi/v1/algoOrder", url.Values{
		"clientAlgoId": {clientOrderID},
	}, &algo); err != nil {
		return domain.Order{}, err
	}
	if algo.AlgoID == 0 || algo.Symbol == "" || algo.ClientAlgoID == "" {
		return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
	}
	return mapAlgoOrder(algo), nil
}

type position struct {
	Symbol           string `json:"symbol"`
	PositionAmount   string `json:"positionAmt"`
	EntryPrice       string `json:"entryPrice"`
	MarkPrice        string `json:"markPrice"`
	UnrealizedProfit string `json:"unRealizedProfit"`
	LiquidationPrice string `json:"liquidationPrice"`
	Leverage         string `json:"leverage"`
	MarginType       string `json:"marginType"`
	PositionSide     string `json:"positionSide"`
}

func (r *Reader) GetPositions(ctx context.Context) ([]domain.Position, error) {
	var source []position
	if err := r.signedGet(ctx, r.futuresURL, "/fapi/v2/positionRisk", nil, &source); err != nil {
		return nil, err
	}
	result := make([]domain.Position, 0, len(source))
	for _, item := range source {
		if item.Symbol == "" || !exchange.IsNonZero(item.PositionAmount) {
			continue
		}
		if item.Leverage == "" || (item.MarginType != "isolated" && item.MarginType != "cross") {
			return nil, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
		}
		side := domain.PositionLong
		if item.PositionSide == "SHORT" || (item.PositionSide != "LONG" && strings.HasPrefix(item.PositionAmount, "-")) {
			side = domain.PositionShort
		}
		margin := domain.MarginCross
		if item.MarginType == "isolated" {
			margin = domain.MarginIsolated
		}
		mapped := domain.Position{
			PositionKey: item.Symbol + ":" + first(item.PositionSide, "BOTH"), Symbol: item.Symbol, Side: side,
			Quantity: domain.Decimal(strings.TrimPrefix(item.PositionAmount, "-")), EntryPrice: domain.Decimal(item.EntryPrice),
			MarkPrice: domain.Decimal(item.MarkPrice), UnrealizedPnL: domain.Decimal(item.UnrealizedProfit),
			Leverage: domain.Decimal(item.Leverage), MarginMode: margin,
		}
		if exchange.IsNonZero(item.LiquidationPrice) {
			mapped.LiquidationPrice = domain.Decimal(item.LiquidationPrice)
		}
		result = append(result, mapped)
	}
	return result, nil
}

func (r *Reader) GetMarkPrice(ctx context.Context, symbol string) (domain.Decimal, error) {
	var body struct {
		Symbol    string `json:"symbol"`
		MarkPrice string `json:"markPrice"`
	}
	params := url.Values{"symbol": {symbol}}
	if err := r.publicGet(ctx, r.futuresURL, "/fapi/v1/premiumIndex", params, &body); err != nil {
		return "", err
	}
	if body.Symbol != symbol || body.MarkPrice == "" {
		return "", exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
	}
	return domain.Decimal(body.MarkPrice), nil
}

// GetRecentCloses returns completed/recent Futures candle closes for
// autonomous chart analysis. It is public, read-only market data.
func (r *Reader) GetRecentCloses(ctx context.Context, symbol, interval string, limit int) ([]domain.Decimal, error) {
	candles, err := r.GetRecentCandles(ctx, symbol, interval, limit)
	if err != nil {
		return nil, err
	}
	closes := make([]domain.Decimal, 0, len(candles))
	for _, candle := range candles {
		closes = append(closes, candle.Close)
	}
	return closes, nil
}

func (r *Reader) GetRecentCandles(ctx context.Context, symbol, interval string, limit int) ([]domain.MarketCandle, error) {
	if limit < 2 || limit > 500 || interval == "" {
		return nil, exchange.NewError(domain.ErrorValidation, "INVALID_CHART_QUERY", "", false, false)
	}
	var body [][]json.RawMessage
	if err := r.publicGet(ctx, r.futuresURL, "/fapi/v1/klines", url.Values{
		"symbol": {symbol}, "interval": {interval}, "limit": {strconv.Itoa(limit)},
	}, &body); err != nil {
		return nil, err
	}
	candles := make([]domain.MarketCandle, 0, len(body))
	for _, candle := range body {
		if len(candle) < 6 {
			return nil, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
		}
		var openTime int64
		var open, high, low, closeText, volume string
		if json.Unmarshal(candle[0], &openTime) != nil || json.Unmarshal(candle[1], &open) != nil || json.Unmarshal(candle[2], &high) != nil || json.Unmarshal(candle[3], &low) != nil || json.Unmarshal(candle[4], &closeText) != nil || json.Unmarshal(candle[5], &volume) != nil || openTime <= 0 || open == "" || high == "" || low == "" || closeText == "" || volume == "" {
			return nil, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
		}
		candles = append(candles, domain.MarketCandle{Open: domain.Decimal(open), High: domain.Decimal(high), Low: domain.Decimal(low), Close: domain.Decimal(closeText), Volume: domain.Decimal(volume), OpenTimeMS: openTime})
	}
	if len(candles) < 2 {
		return nil, exchange.NewError(domain.ErrorInternal, "INSUFFICIENT_CHART_DATA", "", false, false)
	}
	return candles, nil
}

func (r *Reader) GetDerivativesContext(ctx context.Context, symbol string) (domain.DerivativesContext, error) {
	var premium struct {
		Symbol          string `json:"symbol"`
		LastFundingRate string `json:"lastFundingRate"`
	}
	if err := r.publicGet(ctx, r.futuresURL, "/fapi/v1/premiumIndex", url.Values{"symbol": {symbol}}, &premium); err != nil {
		return domain.DerivativesContext{}, err
	}
	var history []struct {
		Symbol       string `json:"symbol"`
		OpenInterest string `json:"sumOpenInterest"`
	}
	if err := r.publicGet(ctx, r.futuresURL, "/futures/data/openInterestHist", url.Values{"symbol": {symbol}, "period": {"5m"}, "limit": {"2"}}, &history); err != nil {
		return domain.DerivativesContext{}, err
	}
	if premium.Symbol != symbol || premium.LastFundingRate == "" || len(history) != 2 ||
		history[0].Symbol != symbol || history[1].Symbol != symbol ||
		history[0].OpenInterest == "" || history[1].OpenInterest == "" {
		return domain.DerivativesContext{}, exchange.NewError(domain.ErrorInternal, "INVALID_DERIVATIVES_CONTEXT", "", false, false)
	}
	return domain.DerivativesContext{FundingRate: domain.Decimal(premium.LastFundingRate), PreviousOpenInterest: domain.Decimal(history[0].OpenInterest), OpenInterest: domain.Decimal(history[1].OpenInterest)}, nil
}

func (r *Reader) ConfigurePosition(ctx context.Context, symbol string, leverage int, marginMode domain.MarginMode) error {
	marginType := "ISOLATED"
	if marginMode == domain.MarginCross {
		marginType = "CROSSED"
	}
	var marginResult struct {
		Code int `json:"code"`
	}
	err := r.signedRequest(ctx, http.MethodPost, "/fapi/v1/marginType", url.Values{
		"symbol": {symbol}, "marginType": {marginType},
	}, &marginResult, map[string]struct{}{"-4046": {}, "-4048": {}})
	if err != nil {
		return err
	}
	if marginResult.Code == -4048 {
		positions, positionErr := r.GetPositions(ctx)
		if positionErr != nil {
			return positionErr
		}
		matched := false
		for _, position := range positions {
			if position.Symbol == symbol && position.MarginMode == marginMode {
				matched = true
				break
			}
		}
		if !matched {
			return exchange.NewError(domain.ErrorRejected, "MARGIN_MODE_CHANGE_BLOCKED", "-4048", false, false)
		}
	}
	return r.signedRequest(ctx, http.MethodPost, "/fapi/v1/leverage", url.Values{
		"symbol": {symbol}, "leverage": {strconv.Itoa(leverage)},
	}, &struct{}{}, nil)
}

func (r *Reader) PlaceOrder(ctx context.Context, input exchange.PlaceOrderInput) (domain.Order, error) {
	if input.Type == domain.OrderStopMarket || input.Type == domain.OrderStopLimit || input.Type == domain.OrderTakeProfitMarket {
		return r.placeConditionalOrder(ctx, input)
	}
	orderType := string(input.Type)
	if input.Type == domain.OrderStopLimit {
		orderType = "STOP"
	}
	params := url.Values{
		"symbol": {input.Symbol}, "side": {string(input.Side)}, "type": {orderType},
		"quantity": {string(input.Quantity)}, "reduceOnly": {strconv.FormatBool(input.ReduceOnly)},
		"newClientOrderId": {input.ClientOrderID}, "newOrderRespType": {"RESULT"},
	}
	if input.Type == domain.OrderLimit || input.Type == domain.OrderStopLimit {
		params.Set("timeInForce", "GTC")
	}
	if input.Price != "" {
		params.Set("price", string(input.Price))
	}
	if input.StopPrice != "" {
		params.Set("stopPrice", string(input.StopPrice))
	}
	var result order
	if err := r.signedRequest(ctx, http.MethodPost, "/fapi/v1/order", params, &result, nil); err != nil {
		return domain.Order{}, markWriteUncertain(err)
	}
	if result.OrderID == 0 || result.Symbol == "" {
		return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, true)
	}
	return mapOrder(result), nil
}

func (r *Reader) placeConditionalOrder(ctx context.Context, input exchange.PlaceOrderInput) (domain.Order, error) {
	orderType := string(input.Type)
	if input.Type == domain.OrderStopLimit {
		orderType = "STOP"
	}
	params := url.Values{
		"algoType": {"CONDITIONAL"}, "symbol": {input.Symbol}, "side": {string(input.Side)},
		"type": {orderType}, "quantity": {string(input.Quantity)},
		"reduceOnly": {strconv.FormatBool(input.ReduceOnly)}, "clientAlgoId": {input.ClientOrderID},
		"newOrderRespType": {"RESULT"}, "workingType": {"MARK_PRICE"},
	}
	if input.Type == domain.OrderStopLimit {
		params.Set("timeInForce", "GTC")
	}
	if input.Price != "" {
		params.Set("price", string(input.Price))
	}
	if input.StopPrice != "" {
		params.Set("triggerPrice", string(input.StopPrice))
	}
	var result algoOrder
	if err := r.signedRequest(ctx, http.MethodPost, "/fapi/v1/algoOrder", params, &result, nil); err != nil {
		return domain.Order{}, markWriteUncertain(err)
	}
	if result.AlgoID == 0 || result.Symbol == "" || result.ClientAlgoID == "" {
		return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, true)
	}
	return mapAlgoOrder(result), nil
}

func (r *Reader) CancelConditionalOrder(ctx context.Context, symbol, exchangeOrderID string) (domain.Order, error) {
	var result struct {
		AlgoID       int64  `json:"algoId"`
		ClientAlgoID string `json:"clientAlgoId"`
		Code         string `json:"code"`
	}
	if err := r.signedRequest(ctx, http.MethodDelete, "/fapi/v1/algoOrder", url.Values{"algoId": {exchangeOrderID}}, &result, nil); err != nil {
		return domain.Order{}, markWriteUncertain(err)
	}
	if result.AlgoID == 0 || strconv.FormatInt(result.AlgoID, 10) != exchangeOrderID {
		return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, true)
	}
	return domain.Order{ExchangeOrderID: exchangeOrderID, ClientOrderID: result.ClientAlgoID, Symbol: symbol, Status: domain.OrderCanceled}, nil
}

func (r *Reader) CancelOrder(ctx context.Context, symbol, exchangeOrderID string) (domain.Order, error) {
	var result order
	err := r.signedRequest(ctx, http.MethodDelete, "/fapi/v1/order", url.Values{
		"symbol": {symbol}, "orderId": {exchangeOrderID},
	}, &result, nil)
	if err != nil {
		return domain.Order{}, markWriteUncertain(err)
	}
	if result.OrderID == 0 || result.Symbol == "" {
		return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, true)
	}
	return mapOrder(result), nil
}

func (r *Reader) spotPrices(ctx context.Context) map[string]string {
	var source []ticker
	if err := r.publicGet(ctx, r.spotURL, "/api/v3/ticker/price", nil, &source); err != nil {
		return map[string]string{}
	}
	result := make(map[string]string, len(source))
	for _, item := range source {
		if item.Symbol != "" && item.Price != "" {
			result[item.Symbol] = item.Price
		}
	}
	return result
}

func (r *Reader) signedGet(ctx context.Context, baseURL, path string, params url.Values, target any) error {
	return r.signed(ctx, http.MethodGet, baseURL, path, params, target, nil)
}

func (r *Reader) signedRequest(ctx context.Context, method, path string, params url.Values, target any, acceptedCodes map[string]struct{}) error {
	return r.signed(ctx, method, r.futuresURL, path, params, target, acceptedCodes)
}

func (r *Reader) signed(ctx context.Context, method, baseURL, path string, params url.Values, target any, acceptedCodes map[string]struct{}) error {
	if params == nil {
		params = make(url.Values)
	}
	params.Set("recvWindow", "5000")
	params.Set("timestamp", strconv.FormatInt(r.now().UnixMilli(), 10))
	unsigned := params.Encode()
	mac := hmac.New(sha256.New, []byte(r.credentials.APISecret))
	_, _ = mac.Write([]byte(unsigned))
	params.Set("signature", hex.EncodeToString(mac.Sum(nil)))
	requestURL := strings.TrimRight(baseURL, "/") + path + "?" + params.Encode()
	_, err := exchange.RequestJSON(ctx, r.client, method, requestURL, map[string]string{"X-MBX-APIKEY": r.credentials.APIKey}, nil, target, acceptedCodes)
	return err
}

func (r *Reader) publicGet(ctx context.Context, baseURL, path string, params url.Values, target any) error {
	return r.get(ctx, baseURL, path, params, nil, target)
}

func (r *Reader) get(ctx context.Context, baseURL, path string, params url.Values, headers map[string]string, target any) error {
	requestURL := strings.TrimRight(baseURL, "/") + path
	if len(params) > 0 {
		requestURL += "?" + params.Encode()
	}
	_, err := exchange.GetJSON(ctx, r.client, requestURL, headers, target)
	if err != nil {
		return err
	}
	return nil
}

func mapOrder(item order) domain.Order {
	orderType := domain.OrderMarket
	switch item.Type {
	case "LIMIT":
		orderType = domain.OrderLimit
	case "STOP":
		orderType = domain.OrderStopLimit
	case "STOP_MARKET":
		orderType = domain.OrderStopMarket
	case "TAKE_PROFIT_MARKET":
		orderType = domain.OrderTakeProfitMarket
	}
	side := domain.SideBuy
	if item.Side == "SELL" {
		side = domain.SideSell
	}
	createdAt := time.Time{}
	timestamp := item.Time
	if timestamp == 0 {
		timestamp = item.UpdateTime
	}
	if timestamp > 0 {
		createdAt = time.UnixMilli(timestamp).UTC()
	}
	mapped := domain.Order{
		ExchangeOrderID: strconv.FormatInt(item.OrderID, 10), ClientOrderID: item.ClientID,
		Symbol: item.Symbol, Side: side, Type: orderType, Status: mapStatus(item.Status),
		Quantity: domain.Decimal(item.OriginalQty), ExecutedQuantity: domain.Decimal(item.ExecutedQty),
		ReduceOnly: item.ReduceOnly, CreatedAt: createdAt,
	}
	if item.UpdateTime > 0 {
		mapped.UpdatedAt = time.UnixMilli(item.UpdateTime).UTC()
	}
	if exchange.IsNonZero(item.Price) {
		mapped.Price = domain.Decimal(item.Price)
	}
	if exchange.IsNonZero(item.StopPrice) {
		mapped.StopPrice = domain.Decimal(item.StopPrice)
	}
	return mapped
}

func mapAlgoOrder(item algoOrder) domain.Order {
	orderType := domain.OrderStopMarket
	if item.OrderType == "STOP" {
		orderType = domain.OrderStopLimit
	} else if item.OrderType == "TAKE_PROFIT_MARKET" {
		orderType = domain.OrderTakeProfitMarket
	}
	side := domain.SideBuy
	if item.Side == "SELL" {
		side = domain.SideSell
	}
	mapped := domain.Order{
		ExchangeOrderID: strconv.FormatInt(item.AlgoID, 10), ClientOrderID: item.ClientAlgoID,
		Symbol: item.Symbol, Side: side, Type: orderType, Status: mapStatus(item.AlgoStatus),
		Quantity: domain.Decimal(item.Quantity), ExecutedQuantity: "0", ReduceOnly: item.ReduceOnly,
	}
	if item.CreateTime > 0 {
		mapped.CreatedAt = time.UnixMilli(item.CreateTime).UTC()
	}
	if item.UpdateTime > 0 {
		mapped.UpdatedAt = time.UnixMilli(item.UpdateTime).UTC()
	}
	if exchange.IsNonZero(item.Price) {
		mapped.Price = domain.Decimal(item.Price)
	}
	if exchange.IsNonZero(item.TriggerPrice) {
		mapped.StopPrice = domain.Decimal(item.TriggerPrice)
	}
	return mapped
}

func mapStatus(status string) domain.OrderStatus {
	switch status {
	case "NEW":
		return domain.OrderOpen
	case "PARTIALLY_FILLED":
		return domain.OrderPartiallyFilled
	case "FILLED":
		return domain.OrderFilled
	case "CANCELED", "EXPIRED", "EXPIRED_IN_MATCH":
		return domain.OrderCanceled
	case "REJECTED":
		return domain.OrderFailed
	case "PENDING_CANCEL":
		return domain.OrderCanceling
	default:
		return domain.OrderReconciliationRequired
	}
}

func usdtPrice(asset string, prices map[string]string) string {
	if asset == "USDT" {
		return "1"
	}
	if price := prices[asset+"USDT"]; price != "" {
		return price
	}
	if asset == "USDC" {
		return first(prices["USDCUSDT"], "1")
	}
	if price := prices[asset+"USDC"]; price != "" {
		return exchange.MultiplyDecimal(price, first(prices["USDCUSDT"], "1"), 8)
	}
	return ""
}

func first(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}

var _ exchange.Reader = (*Reader)(nil)
var _ exchange.Writer = (*Reader)(nil)

func markWriteUncertain(err error) error {
	exchangeError, ok := err.(*exchange.Error)
	if ok && (exchangeError.Normalized.Category == domain.ErrorTimeout || exchangeError.Normalized.Category == domain.ErrorUnavailable) {
		exchangeError.Normalized.Reconciliation = true
	}
	return err
}
