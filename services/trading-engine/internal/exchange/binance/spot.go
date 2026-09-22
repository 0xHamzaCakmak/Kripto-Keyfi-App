package binance

import (
	"context"
	"net/http"
	"net/url"
	"strconv"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

// Spot uses demo spot endpoints exclusively. It never routes through Futures.
type Spot struct{ reader *Reader }

func NewSpot(options Options) *Spot {
	r := New(options)
	r.futuresURL = r.spotURL // signedRequest shares signing only; callers below always use /api/v3 paths.
	return &Spot{reader: r}
}
func (s *Spot) GetBalances(ctx context.Context) ([]domain.Balance, error) {
	var data spotAccount
	if err := s.reader.signedGet(ctx, s.reader.spotURL, "/api/v3/account", nil, &data); err != nil {
		return nil, err
	}
	result := []domain.Balance{}
	for _, b := range data.Balances {
		result = append(result, domain.Balance{WalletType: domain.WalletSpot, Asset: b.Asset, WalletBalance: domain.Decimal(exchange.AddDecimal(b.Free, b.Locked)), AvailableBalance: domain.Decimal(b.Free), LockedBalance: domain.Decimal(b.Locked), UnrealizedPnL: "0"})
	}
	return result, nil
}
func (s *Spot) GetSymbols(ctx context.Context) ([]domain.SymbolRule, error) {
	var info struct {
		Symbols []struct {
			Symbol, Status, BaseAsset, QuoteAsset string
			Filters                               []struct{ FilterType, TickSize, StepSize, MinQty, MaxQty, MinNotional string }
		}
	}
	if err := s.reader.publicGet(ctx, s.reader.spotURL, "/api/v3/exchangeInfo", nil, &info); err != nil {
		return nil, err
	}
	result := []domain.SymbolRule{}
	for _, item := range info.Symbols {
		if item.Status != "TRADING" || item.QuoteAsset != "USDT" {
			continue
		}
		rule := domain.SymbolRule{Symbol: item.Symbol, BaseAsset: item.BaseAsset, QuoteAsset: item.QuoteAsset, Status: "TRADING", MaxLeverage: 1}
		for _, f := range item.Filters {
			switch f.FilterType {
			case "PRICE_FILTER":
				rule.TickSize = domain.Decimal(f.TickSize)
			case "LOT_SIZE":
				rule.StepSize = domain.Decimal(f.StepSize)
				rule.MinQuantity = domain.Decimal(f.MinQty)
				rule.MaxQuantity = domain.Decimal(f.MaxQty)
			case "MIN_NOTIONAL", "NOTIONAL":
				rule.MinNotional = domain.Decimal(f.MinNotional)
			}
		}
		if rule.TickSize != "" && rule.StepSize != "" && rule.MinNotional != "" {
			result = append(result, rule)
		}
	}
	return result, nil
}
func (s *Spot) GetMarkPrice(ctx context.Context, symbol string) (domain.Decimal, error) {
	var value ticker
	if err := s.reader.publicGet(ctx, s.reader.spotURL, "/api/v3/ticker/price", url.Values{"symbol": {symbol}}, &value); err != nil {
		return "", err
	}
	if value.Symbol != symbol || value.Price == "" {
		return "", exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
	}
	return domain.Decimal(value.Price), nil
}
func (s *Spot) GetPositions(context.Context) ([]domain.Position, error) {
	return []domain.Position{}, nil
}
func (s *Spot) ConfigurePosition(_ context.Context, _ string, leverage int, _ domain.MarginMode) error {
	if leverage != 1 {
		return exchange.NewError(domain.ErrorValidation, "SPOT_LEVERAGE_NOT_SUPPORTED", "", false, false)
	}
	return nil
}
func (s *Spot) GetOpenOrders(ctx context.Context) ([]domain.Order, error) {
	var rows []order
	if err := s.reader.signedGet(ctx, s.reader.spotURL, "/api/v3/openOrders", nil, &rows); err != nil {
		return nil, err
	}
	result := []domain.Order{}
	for _, row := range rows {
		result = append(result, mapOrder(row))
	}
	return result, nil
}
func (s *Spot) PlaceOrder(ctx context.Context, input exchange.PlaceOrderInput) (domain.Order, error) {
	if (input.Type != domain.OrderLimit && input.Type != domain.OrderMarket) || input.PositionSide != "" || (input.ReduceOnly && input.Side != domain.SideSell) {
		return domain.Order{}, exchange.NewError(domain.ErrorValidation, "SPOT_ORDER_UNSUPPORTED", "", false, false)
	}
	params := url.Values{"symbol": {input.Symbol}, "side": {string(input.Side)}, "type": {string(input.Type)}, "quantity": {string(input.Quantity)}, "newClientOrderId": {input.ClientOrderID}, "newOrderRespType": {"FULL"}}
	if input.Type == domain.OrderLimit {
		params.Set("price", string(input.Price))
		params.Set("timeInForce", "GTC")
	}
	if input.PostOnly {
		params.Set("type", "LIMIT_MAKER")
		params.Del("timeInForce")
	}
	var result order
	if err := s.reader.signedRequest(ctx, http.MethodPost, "/api/v3/order", params, &result, nil); err != nil {
		return domain.Order{}, markWriteUncertain(err)
	}
	return mapOrder(result), nil
}
func (s *Spot) CancelOrder(ctx context.Context, symbol, id string) (domain.Order, error) {
	var row order
	if err := s.reader.signedRequest(ctx, http.MethodDelete, "/api/v3/order", url.Values{"symbol": {symbol}, "orderId": {id}}, &row, nil); err != nil {
		return domain.Order{}, markWriteUncertain(err)
	}
	if strconv.FormatInt(row.OrderID, 10) != id {
		return domain.Order{}, exchange.NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, true)
	}
	return mapOrder(row), nil
}
func (s *Spot) GetOrderByClientID(ctx context.Context, symbol, id string) (domain.Order, error) {
	var row order
	if err := s.reader.signedGet(ctx, s.reader.spotURL, "/api/v3/order", url.Values{"symbol": {symbol}, "origClientOrderId": {id}}, &row); err != nil {
		return domain.Order{}, err
	}
	return mapOrder(row), nil
}
