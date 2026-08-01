package bybit

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

const receiveWindow = "5000"

type Reader struct {
	credentials exchange.Credentials
	client      *http.Client
	baseURL     string
	now         func() time.Time
}

type Options struct {
	Credentials exchange.Credentials
	Client      *http.Client
	BaseURL     string
	Now         func() time.Time
}

func New(options Options) *Reader {
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
		baseURL: first(options.BaseURL, exchange.DemoEndpoints().Bybit), now: now,
	}
}

type response[T any] struct {
	RetCode int    `json:"retCode"`
	RetMsg  string `json:"retMsg"`
	Result  T      `json:"result"`
}

func (r *Reader) GetBalances(ctx context.Context) ([]domain.Balance, error) {
	type walletResult struct {
		List []struct {
			Coins []struct {
				Coin          string `json:"coin"`
				WalletBalance string `json:"walletBalance"`
				Equity        string `json:"equity"`
				UnrealizedPnL string `json:"unrealisedPnl"`
			} `json:"coin"`
		} `json:"list"`
	}
	var body response[walletResult]
	if err := r.signedGet(ctx, "/v5/account/wallet-balance", "accountType=UNIFIED", &body); err != nil {
		return nil, err
	}
	if err := assertResponse(body.RetCode); err != nil {
		return nil, err
	}
	if len(body.Result.List) == 0 {
		return []domain.Balance{}, nil
	}
	result := make([]domain.Balance, 0, len(body.Result.List[0].Coins))
	for _, coin := range body.Result.List[0].Coins {
		if !exchange.IsNonZero(coin.WalletBalance) && !exchange.IsNonZero(coin.UnrealizedPnL) {
			continue
		}
		result = append(result, domain.Balance{
			WalletType: domain.WalletUnified, Asset: coin.Coin,
			WalletBalance: domain.Decimal(coin.WalletBalance), AvailableBalance: domain.Decimal(coin.Equity),
			UnrealizedPnL: domain.Decimal(coin.UnrealizedPnL),
		})
	}
	return result, nil
}

type instrument struct {
	Symbol         string `json:"symbol"`
	Status         string `json:"status"`
	BaseCoin       string `json:"baseCoin"`
	QuoteCoin      string `json:"quoteCoin"`
	LeverageFilter struct {
		MaxLeverage string `json:"maxLeverage"`
	} `json:"leverageFilter"`
	PriceFilter struct {
		TickSize string `json:"tickSize"`
	} `json:"priceFilter"`
	LotSizeFilter struct {
		MinOrderQty  string `json:"minOrderQty"`
		MaxOrderQty  string `json:"maxOrderQty"`
		MaxMarketQty string `json:"maxMktOrderQty"`
		QuantityStep string `json:"qtyStep"`
		MinNotional  string `json:"minNotionalValue"`
	} `json:"lotSizeFilter"`
}

func (r *Reader) GetSymbols(ctx context.Context) ([]domain.SymbolRule, error) {
	result := make([]domain.SymbolRule, 0, 1000)
	cursor := ""
	for {
		query := url.Values{"category": {"linear"}, "limit": {"1000"}}
		if cursor != "" {
			query.Set("cursor", cursor)
		}
		var body response[struct {
			List       []instrument `json:"list"`
			NextCursor string       `json:"nextPageCursor"`
		}]
		if err := r.publicGet(ctx, "/v5/market/instruments-info", query.Encode(), &body); err != nil {
			return nil, err
		}
		if err := assertResponse(body.RetCode); err != nil {
			return nil, err
		}
		for _, item := range body.Result.List {
			leverageValue, err := strconv.ParseFloat(item.LeverageFilter.MaxLeverage, 64)
			leverage := int(leverageValue)
			lot := item.LotSizeFilter
			if err != nil || leverageValue != math.Trunc(leverageValue) || leverage < 1 || item.Status != "Trading" || item.QuoteCoin != "USDT" || item.Symbol == "" ||
				lot.QuantityStep == "" || lot.MinOrderQty == "" || lot.MinNotional == "" || item.PriceFilter.TickSize == "" {
				continue
			}
			maximum := lot.MaxMarketQty
			if maximum == "" {
				maximum = lot.MaxOrderQty
			}
			result = append(result, domain.SymbolRule{
				Symbol: item.Symbol, BaseAsset: item.BaseCoin, QuoteAsset: "USDT", Status: "TRADING",
				TickSize: domain.Decimal(item.PriceFilter.TickSize), StepSize: domain.Decimal(lot.QuantityStep),
				MinQuantity: domain.Decimal(lot.MinOrderQty), MaxQuantity: domain.Decimal(maximum),
				MinNotional: domain.Decimal(lot.MinNotional), MaxLeverage: leverage,
			})
		}
		cursor = body.Result.NextCursor
		if cursor == "" {
			return result, nil
		}
	}
}

type order struct {
	OrderID      string `json:"orderId"`
	OrderLinkID  string `json:"orderLinkId"`
	Symbol       string `json:"symbol"`
	Side         string `json:"side"`
	OrderType    string `json:"orderType"`
	OrderStatus  string `json:"orderStatus"`
	Quantity     string `json:"qty"`
	ExecutedQty  string `json:"cumExecQty"`
	Price        string `json:"price"`
	TriggerPrice string `json:"triggerPrice"`
	ReduceOnly   bool   `json:"reduceOnly"`
	CreatedTime  string `json:"createdTime"`
}

func (r *Reader) GetOpenOrders(ctx context.Context) ([]domain.Order, error) {
	var body response[struct {
		List []order `json:"list"`
	}]
	if err := r.signedGet(ctx, "/v5/order/realtime", "category=linear&settleCoin=USDT&openOnly=0&limit=50", &body); err != nil {
		return nil, err
	}
	if err := assertResponse(body.RetCode); err != nil {
		return nil, err
	}
	result := make([]domain.Order, 0, len(body.Result.List))
	for _, item := range body.Result.List {
		if item.OrderID == "" || item.Symbol == "" {
			return nil, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
		}
		result = append(result, mapOrder(item))
	}
	return result, nil
}

type position struct {
	Symbol        string `json:"symbol"`
	Side          string `json:"side"`
	Size          string `json:"size"`
	AveragePrice  string `json:"avgPrice"`
	MarkPrice     string `json:"markPrice"`
	Liquidation   string `json:"liqPrice"`
	UnrealizedPnL string `json:"unrealisedPnl"`
	Leverage      string `json:"leverage"`
	TradeMode     int    `json:"tradeMode"`
	PositionIndex int    `json:"positionIdx"`
}

func (r *Reader) GetPositions(ctx context.Context) ([]domain.Position, error) {
	var body response[struct {
		List []position `json:"list"`
	}]
	if err := r.signedGet(ctx, "/v5/position/list", "category=linear&settleCoin=USDT&limit=200", &body); err != nil {
		return nil, err
	}
	if err := assertResponse(body.RetCode); err != nil {
		return nil, err
	}
	result := make([]domain.Position, 0, len(body.Result.List))
	for _, item := range body.Result.List {
		if item.Symbol == "" || !exchange.IsNonZero(item.Size) {
			continue
		}
		side := domain.PositionLong
		if item.Side == "Sell" {
			side = domain.PositionShort
		}
		margin := domain.MarginCross
		if item.TradeMode == 1 {
			margin = domain.MarginIsolated
		}
		positionIndex := item.PositionIndex
		mapped := domain.Position{
			PositionKey: item.Symbol + ":" + strconv.Itoa(item.PositionIndex), Symbol: item.Symbol, Side: side,
			Quantity: domain.Decimal(item.Size), EntryPrice: domain.Decimal(item.AveragePrice), MarkPrice: domain.Decimal(item.MarkPrice),
			UnrealizedPnL: domain.Decimal(item.UnrealizedPnL), Leverage: domain.Decimal(first(item.Leverage, "1")),
			MarginMode: margin, PositionIndex: &positionIndex,
		}
		if exchange.IsNonZero(item.Liquidation) {
			mapped.LiquidationPrice = domain.Decimal(item.Liquidation)
		}
		result = append(result, mapped)
	}
	return result, nil
}

func (r *Reader) GetMarkPrice(ctx context.Context, symbol string) (domain.Decimal, error) {
	query := url.Values{"category": {"linear"}, "symbol": {symbol}}
	var body response[struct {
		List []struct {
			MarkPrice string `json:"markPrice"`
		} `json:"list"`
	}]
	if err := r.publicGet(ctx, "/v5/market/tickers", query.Encode(), &body); err != nil {
		return "", err
	}
	if err := assertResponse(body.RetCode); err != nil {
		return "", err
	}
	if len(body.Result.List) == 0 || body.Result.List[0].MarkPrice == "" {
		return "", exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
	}
	return domain.Decimal(body.Result.List[0].MarkPrice), nil
}

func (r *Reader) ConfigurePosition(ctx context.Context, symbol string, leverage int, marginMode domain.MarginMode) error {
	mode := "REGULAR_MARGIN"
	if marginMode == domain.MarginIsolated {
		mode = "ISOLATED_MARGIN"
	}
	if err := r.signedPost(ctx, "/v5/account/set-margin-mode", map[string]any{"setMarginMode": mode}, map[int]struct{}{110026: {}}, nil); err != nil {
		return err
	}
	leverageText := strconv.Itoa(leverage)
	return r.signedPost(ctx, "/v5/position/set-leverage", map[string]any{
		"category": "linear", "symbol": symbol, "buyLeverage": leverageText, "sellLeverage": leverageText,
	}, map[int]struct{}{110043: {}}, nil)
}

func (r *Reader) PlaceOrder(ctx context.Context, input exchange.PlaceOrderInput) (domain.Order, error) {
	orderType := "Market"
	if input.Type == domain.OrderLimit || input.Type == domain.OrderStopLimit {
		orderType = "Limit"
	}
	side := "Buy"
	if input.Side == domain.SideSell {
		side = "Sell"
	}
	payload := map[string]any{
		"category": "linear", "symbol": input.Symbol, "side": side, "orderType": orderType,
		"qty": string(input.Quantity), "reduceOnly": input.ReduceOnly, "orderLinkId": input.ClientOrderID,
	}
	if input.Price != "" {
		payload["price"] = string(input.Price)
	}
	if input.PositionIndex != nil {
		payload["positionIdx"] = *input.PositionIndex
	}
	if (input.Type == domain.OrderStopMarket || input.Type == domain.OrderStopLimit) && input.StopPrice != "" {
		markPrice, err := r.GetMarkPrice(ctx, input.Symbol)
		if err != nil {
			return domain.Order{}, err
		}
		payload["triggerPrice"] = string(input.StopPrice)
		payload["triggerDirection"] = decimalCompare(string(input.StopPrice), string(markPrice))
		payload["triggerBy"] = "MarkPrice"
	}
	var body response[struct {
		OrderID     string `json:"orderId"`
		OrderLinkID string `json:"orderLinkId"`
	}]
	if err := r.signedPost(ctx, "/v5/order/create", payload, nil, &body); err != nil {
		return domain.Order{}, markWriteUncertain(err)
	}
	if body.Result.OrderID == "" {
		return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, true)
	}
	return domain.Order{
		ExchangeOrderID: body.Result.OrderID, ClientOrderID: first(body.Result.OrderLinkID, input.ClientOrderID),
		Symbol: input.Symbol, Side: input.Side, Type: input.Type, Status: domain.OrderOpen,
		Quantity: input.Quantity, ExecutedQuantity: "0", Price: input.Price, StopPrice: input.StopPrice, ReduceOnly: input.ReduceOnly,
	}, nil
}

func (r *Reader) CancelOrder(ctx context.Context, symbol, exchangeOrderID string) (domain.Order, error) {
	var body response[struct {
		OrderID     string `json:"orderId"`
		OrderLinkID string `json:"orderLinkId"`
	}]
	err := r.signedPost(ctx, "/v5/order/cancel", map[string]any{
		"category": "linear", "symbol": symbol, "orderId": exchangeOrderID,
	}, nil, &body)
	if err != nil {
		return domain.Order{}, markWriteUncertain(err)
	}
	if body.Result.OrderID == "" {
		return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, true)
	}
	return domain.Order{ExchangeOrderID: body.Result.OrderID, ClientOrderID: body.Result.OrderLinkID, Symbol: symbol, Status: domain.OrderCanceled}, nil
}

func (r *Reader) signedGet(ctx context.Context, path, query string, target any) error {
	timestamp := strconv.FormatInt(r.now().UnixMilli(), 10)
	mac := hmac.New(sha256.New, []byte(r.credentials.APISecret))
	_, _ = mac.Write([]byte(timestamp + r.credentials.APIKey + receiveWindow + query))
	headers := map[string]string{
		"X-BAPI-API-KEY": r.credentials.APIKey, "X-BAPI-TIMESTAMP": timestamp,
		"X-BAPI-RECV-WINDOW": receiveWindow, "X-BAPI-SIGN": hex.EncodeToString(mac.Sum(nil)),
	}
	return r.get(ctx, path, query, headers, target)
}

func (r *Reader) signedPost(ctx context.Context, path string, payload map[string]any, acceptedCodes map[int]struct{}, target any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	timestamp := strconv.FormatInt(r.now().UnixMilli(), 10)
	mac := hmac.New(sha256.New, []byte(r.credentials.APISecret))
	_, _ = mac.Write([]byte(timestamp + r.credentials.APIKey + receiveWindow + string(body)))
	headers := map[string]string{
		"X-BAPI-API-KEY": r.credentials.APIKey, "X-BAPI-TIMESTAMP": timestamp,
		"X-BAPI-RECV-WINDOW": receiveWindow, "X-BAPI-SIGN": hex.EncodeToString(mac.Sum(nil)), "Content-Type": "application/json",
	}
	var generic response[json.RawMessage]
	destination := target
	if destination == nil {
		destination = &generic
	}
	_, err = exchange.RequestJSON(ctx, r.client, http.MethodPost, strings.TrimRight(r.baseURL, "/")+path, headers, body, destination, nil)
	if err != nil {
		return err
	}
	retCode := generic.RetCode
	if target != nil {
		encoded, marshalErr := json.Marshal(target)
		if marshalErr == nil {
			var envelope struct {
				RetCode int `json:"retCode"`
			}
			_ = json.Unmarshal(encoded, &envelope)
			retCode = envelope.RetCode
		}
	}
	if retCode != 0 {
		if _, accepted := acceptedCodes[retCode]; !accepted {
			return assertResponse(retCode)
		}
	}
	return nil
}

func (r *Reader) publicGet(ctx context.Context, path, query string, target any) error {
	return r.get(ctx, path, query, nil, target)
}

func (r *Reader) get(ctx context.Context, path, query string, headers map[string]string, target any) error {
	requestURL := strings.TrimRight(r.baseURL, "/") + path
	if query != "" {
		requestURL += "?" + query
	}
	_, err := exchange.GetJSON(ctx, r.client, requestURL, headers, target)
	if err != nil {
		return err
	}
	return nil
}

func assertResponse(code int) error {
	switch code {
	case 0:
		return nil
	case 10003:
		return exchange.NewError(domain.ErrorPermission, "EXCHANGE_PERMISSION_DENIED", strconv.Itoa(code), false, false)
	case 10006:
		return exchange.NewError(domain.ErrorRateLimit, "EXCHANGE_RATE_LIMITED", strconv.Itoa(code), true, false)
	default:
		return exchange.NewError(domain.ErrorRejected, "EXCHANGE_REJECTED", strconv.Itoa(code), false, false)
	}
}

func mapOrder(item order) domain.Order {
	conditional := exchange.IsNonZero(item.TriggerPrice)
	orderType := domain.OrderMarket
	if item.OrderType == "Limit" {
		orderType = domain.OrderLimit
	}
	if conditional {
		if item.OrderType == "Limit" {
			orderType = domain.OrderStopLimit
		} else {
			orderType = domain.OrderStopMarket
		}
	}
	side := domain.SideBuy
	if item.Side == "Sell" {
		side = domain.SideSell
	}
	createdAt := time.Time{}
	if timestamp, err := strconv.ParseInt(item.CreatedTime, 10, 64); err == nil && timestamp > 0 {
		createdAt = time.UnixMilli(timestamp).UTC()
	}
	mapped := domain.Order{
		ExchangeOrderID: item.OrderID, ClientOrderID: item.OrderLinkID, Symbol: item.Symbol,
		Side: side, Type: orderType, Status: mapStatus(item.OrderStatus),
		Quantity: domain.Decimal(item.Quantity), ExecutedQuantity: domain.Decimal(item.ExecutedQty),
		ReduceOnly: item.ReduceOnly, CreatedAt: createdAt,
	}
	if exchange.IsNonZero(item.Price) {
		mapped.Price = domain.Decimal(item.Price)
	}
	if conditional {
		mapped.StopPrice = domain.Decimal(item.TriggerPrice)
	}
	return mapped
}

func mapStatus(status string) domain.OrderStatus {
	switch status {
	case "New", "Untriggered", "Triggered", "Active":
		return domain.OrderOpen
	case "PartiallyFilled":
		return domain.OrderPartiallyFilled
	case "Filled":
		return domain.OrderFilled
	case "Cancelled", "Deactivated", "Rejected":
		return domain.OrderCanceled
	case "PendingCancel":
		return domain.OrderCanceling
	default:
		return domain.OrderReconciliationRequired
	}
}

func first(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}

var _ exchange.Reader = (*Reader)(nil)
var _ exchange.Writer = (*Reader)(nil)

func decimalCompare(left, right string) int {
	leftValue, leftOK := new(big.Rat).SetString(left)
	rightValue, rightOK := new(big.Rat).SetString(right)
	if !leftOK || !rightOK {
		return 0
	}
	if leftValue.Cmp(rightValue) > 0 {
		return 1
	}
	return 2
}

func markWriteUncertain(err error) error {
	exchangeError, ok := err.(*exchange.Error)
	if ok && (exchangeError.Normalized.Category == domain.ErrorTimeout || exchangeError.Normalized.Category == domain.ErrorUnavailable) {
		exchangeError.Normalized.Reconciliation = true
	}
	return err
}
