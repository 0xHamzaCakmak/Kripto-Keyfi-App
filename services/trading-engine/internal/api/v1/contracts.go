package tradingv1

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

const (
	BasePath           = "/internal/v1"
	SymbolsPath        = BasePath + "/symbols"
	BalancesPath       = BasePath + "/balances"
	OrdersPath         = BasePath + "/orders"
	PositionsPath      = BasePath + "/positions"
	ReconciliationPath = BasePath + "/reconciliation"
	contractVersion    = "v1"
)

var commandIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

type Meta struct {
	Version   string    `json:"version"`
	RequestID string    `json:"requestId"`
	Timestamp time.Time `json:"timestamp"`
}

func NewMeta(requestID string, timestamp time.Time) Meta {
	return Meta{Version: contractVersion, RequestID: requestID, Timestamp: timestamp.UTC()}
}

// CommandMeta is mandatory for every exchange-mutating command. ClientOrderID
// identifies the exchange operation; IdempotencyKey identifies the user intent.
type CommandMeta struct {
	RequestID      string    `json:"requestId"`
	ActorUserID    string    `json:"actorUserId"`
	IdempotencyKey string    `json:"idempotencyKey"`
	ClientOrderID  string    `json:"clientOrderId"`
	RequestedAt    time.Time `json:"requestedAt"`
}

func (meta CommandMeta) Validate() error {
	if strings.TrimSpace(meta.RequestID) == "" || strings.TrimSpace(meta.ActorUserID) == "" {
		return errors.New("requestId and actorUserId are required")
	}
	if length := len(meta.IdempotencyKey); length < 16 || length > 80 || !commandIDPattern.MatchString(meta.IdempotencyKey) {
		return errors.New("idempotencyKey must be 16-80 URL-safe characters")
	}
	if length := len(meta.ClientOrderID); length < 1 || length > 36 || !commandIDPattern.MatchString(meta.ClientOrderID) {
		return errors.New("clientOrderId must be 1-36 URL-safe characters")
	}
	if meta.RequestedAt.IsZero() {
		return errors.New("requestedAt is required")
	}
	return nil
}

type AccountQuery struct {
	Account domain.ExchangeAccountRef `json:"account"`
}

type SymbolsResponse struct {
	Meta    Meta                `json:"meta"`
	Symbols []domain.SymbolRule `json:"symbols"`
}

type BalancesResponse struct {
	Meta     Meta             `json:"meta"`
	Balances []domain.Balance `json:"balances"`
}

type OrdersResponse struct {
	Meta   Meta           `json:"meta"`
	Orders []domain.Order `json:"orders"`
}

type PositionsResponse struct {
	Meta      Meta              `json:"meta"`
	Positions []domain.Position `json:"positions"`
}

type PlaceOrderCommand struct {
	Meta           CommandMeta               `json:"meta"`
	TradingOrderID string                    `json:"tradingOrderId"`
	Account        domain.ExchangeAccountRef `json:"account"`
	Symbol         string                    `json:"symbol"`
	Side           domain.OrderSide          `json:"side"`
	Type           domain.OrderType          `json:"type"`
	Quantity       domain.Decimal            `json:"quantity"`
	Price          domain.Decimal            `json:"price,omitempty"`
	StopPrice      domain.Decimal            `json:"stopPrice,omitempty"`
	Leverage       int                       `json:"leverage"`
	MarginMode     domain.MarginMode         `json:"marginMode"`
	ReduceOnly     bool                      `json:"reduceOnly"`
}

type PreviewOrderRequest struct {
	Account    domain.ExchangeAccountRef `json:"account"`
	Symbol     string                    `json:"symbol"`
	Side       domain.OrderSide          `json:"side"`
	Type       domain.OrderType          `json:"type"`
	Quantity   domain.Decimal            `json:"quantity"`
	Price      domain.Decimal            `json:"price,omitempty"`
	StopPrice  domain.Decimal            `json:"stopPrice,omitempty"`
	Leverage   int                       `json:"leverage"`
	MarginMode domain.MarginMode         `json:"marginMode"`
	ReduceOnly bool                      `json:"reduceOnly"`
}

type PreviewOrderResponse struct {
	Meta              Meta                `json:"meta"`
	Request           PreviewOrderRequest `json:"request"`
	Rule              domain.SymbolRule   `json:"rule"`
	MarkPrice         domain.Decimal      `json:"markPrice"`
	EstimatedNotional domain.Decimal      `json:"estimatedNotional"`
}

type CancelOrderCommand struct {
	Meta            CommandMeta               `json:"meta"`
	Account         domain.ExchangeAccountRef `json:"account"`
	Symbol          string                    `json:"symbol"`
	ExchangeOrderID string                    `json:"exchangeOrderId"`
}

type ClosePositionCommand struct {
	Meta        CommandMeta               `json:"meta"`
	Account     domain.ExchangeAccountRef `json:"account"`
	PositionKey string                    `json:"positionKey"`
	Quantity    domain.Decimal            `json:"quantity"`
}

type ErrorResponse struct {
	Meta  Meta                 `json:"meta"`
	Error domain.ExchangeError `json:"error"`
}
