package domain

import "time"

// Decimal is deliberately a string. Financial values must never cross the
// internal API boundary as IEEE-754 floating point numbers.
type Decimal string

type MarketCandle struct {
	Open, High, Low, Close, Volume Decimal
	OpenTimeMS                     int64
}

type DerivativesContext struct {
	FundingRate, OpenInterest, PreviousOpenInterest Decimal
}

type ExchangeProvider string

const (
	ProviderBinance ExchangeProvider = "BINANCE"
	ProviderBybit   ExchangeProvider = "BYBIT"
)

type ExchangeEnvironment string

const (
	EnvironmentTestnet ExchangeEnvironment = "TESTNET"
	EnvironmentDemo    ExchangeEnvironment = "DEMO"
)

type ExchangeAccountType string

const (
	AccountTypeUSDTM   ExchangeAccountType = "USDT_M"
	AccountTypeUnified ExchangeAccountType = "UNIFIED"
)

type ExchangeAccountRef struct {
	ID          string              `json:"id"`
	UserID      string              `json:"userId"`
	Provider    ExchangeProvider    `json:"provider"`
	Environment ExchangeEnvironment `json:"environment"`
	AccountType ExchangeAccountType `json:"accountType"`
}

type WalletType string

const (
	WalletSpot        WalletType = "SPOT"
	WalletUSDMFutures WalletType = "USD_M_FUTURES"
	WalletUnified     WalletType = "UNIFIED"
)

type Balance struct {
	WalletType       WalletType `json:"walletType"`
	Asset            string     `json:"asset"`
	WalletBalance    Decimal    `json:"walletBalance"`
	AvailableBalance Decimal    `json:"availableBalance"`
	LockedBalance    Decimal    `json:"lockedBalance,omitempty"`
	UnrealizedPnL    Decimal    `json:"unrealizedPnl"`
	MarginAvailable  bool       `json:"marginAvailable,omitempty"`
	PriceUSDT        Decimal    `json:"priceUsdt,omitempty"`
	ValueUSDT        Decimal    `json:"valueUsdt,omitempty"`
}

type SymbolRule struct {
	Symbol      string  `json:"symbol"`
	BaseAsset   string  `json:"baseAsset"`
	QuoteAsset  string  `json:"quoteAsset"`
	Status      string  `json:"status"`
	TickSize    Decimal `json:"tickSize"`
	StepSize    Decimal `json:"stepSize"`
	MinQuantity Decimal `json:"minQuantity"`
	MaxQuantity Decimal `json:"maxQuantity"`
	MinNotional Decimal `json:"minNotional"`
	MaxLeverage int     `json:"maxLeverage"`
}

type OrderSide string

const (
	SideBuy  OrderSide = "BUY"
	SideSell OrderSide = "SELL"
)

type OrderType string

const (
	OrderMarket           OrderType = "MARKET"
	OrderLimit            OrderType = "LIMIT"
	OrderStopMarket       OrderType = "STOP_MARKET"
	OrderStopLimit        OrderType = "STOP_LIMIT"
	OrderTakeProfitMarket OrderType = "TAKE_PROFIT_MARKET"
)

type MarginMode string

const (
	MarginIsolated MarginMode = "ISOLATED"
	MarginCross    MarginMode = "CROSS"
)

type Order struct {
	ID                string       `json:"id,omitempty"`
	ExchangeAccountID string       `json:"exchangeAccountId"`
	ExchangeOrderID   string       `json:"exchangeOrderId,omitempty"`
	ClientOrderID     string       `json:"clientOrderId"`
	IdempotencyKey    string       `json:"idempotencyKey"`
	Symbol            string       `json:"symbol"`
	Side              OrderSide    `json:"side"`
	PositionSide      PositionSide `json:"positionSide,omitempty"`
	Type              OrderType    `json:"type"`
	Status            OrderStatus  `json:"status"`
	Quantity          Decimal      `json:"quantity"`
	ExecutedQuantity  Decimal      `json:"executedQuantity"`
	Price             Decimal      `json:"price,omitempty"`
	StopPrice         Decimal      `json:"stopPrice,omitempty"`
	Leverage          int          `json:"leverage"`
	MarginMode        MarginMode   `json:"marginMode"`
	ReduceOnly        bool         `json:"reduceOnly"`
	CreatedAt         time.Time    `json:"createdAt"`
	UpdatedAt         time.Time    `json:"updatedAt"`
}

type PositionSide string

const (
	PositionBoth  PositionSide = "BOTH"
	PositionLong  PositionSide = "LONG"
	PositionShort PositionSide = "SHORT"
)

type Position struct {
	PositionKey       string       `json:"positionKey"`
	ExchangeAccountID string       `json:"exchangeAccountId"`
	Symbol            string       `json:"symbol"`
	Side              PositionSide `json:"side"`
	Quantity          Decimal      `json:"quantity"`
	EntryPrice        Decimal      `json:"entryPrice"`
	MarkPrice         Decimal      `json:"markPrice"`
	LiquidationPrice  Decimal      `json:"liquidationPrice,omitempty"`
	UnrealizedPnL     Decimal      `json:"unrealizedPnl"`
	Leverage          Decimal      `json:"leverage"`
	MarginMode        MarginMode   `json:"marginMode"`
	PositionIndex     *int         `json:"positionIndex,omitempty"`
}

type ErrorCategory string

const (
	ErrorValidation     ErrorCategory = "VALIDATION"
	ErrorAuthentication ErrorCategory = "AUTHENTICATION"
	ErrorPermission     ErrorCategory = "PERMISSION"
	ErrorRateLimit      ErrorCategory = "RATE_LIMIT"
	ErrorRejected       ErrorCategory = "REJECTED"
	ErrorTimeout        ErrorCategory = "TIMEOUT"
	ErrorUnavailable    ErrorCategory = "UNAVAILABLE"
	ErrorInternal       ErrorCategory = "INTERNAL"
)

type ExchangeError struct {
	Category       ErrorCategory     `json:"category"`
	Code           string            `json:"code"`
	Message        string            `json:"message"`
	ExchangeCode   string            `json:"exchangeCode,omitempty"`
	Retryable      bool              `json:"retryable"`
	Reconciliation bool              `json:"reconciliationRequired"`
	Details        map[string]string `json:"details,omitempty"`
}

type OutboxEvent struct {
	UserID            string
	ExchangeAccountID string
	Provider          ExchangeProvider
	Topic             string
	EventType         string
	AggregateType     string
	AggregateID       string
	DeduplicationKey  string
	Payload           any
	OccurredAt        time.Time
}
