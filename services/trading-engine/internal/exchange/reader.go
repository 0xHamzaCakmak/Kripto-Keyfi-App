package exchange

import (
	"context"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type Credentials struct {
	APIKey     string
	APISecret  string
	Passphrase string
}

// Reader is the complete exchange capability available during shadow mode.
// It intentionally contains no method that can mutate exchange state.
type Reader interface {
	GetBalances(context.Context) ([]domain.Balance, error)
	GetSymbols(context.Context) ([]domain.SymbolRule, error)
	GetOpenOrders(context.Context) ([]domain.Order, error)
	GetPositions(context.Context) ([]domain.Position, error)
	GetMarkPrice(context.Context, string) (domain.Decimal, error)
}

type PlaceOrderInput struct {
	Symbol        string
	Side          domain.OrderSide
	Type          domain.OrderType
	Quantity      domain.Decimal
	Price         domain.Decimal
	StopPrice     domain.Decimal
	ReduceOnly    bool
	ClientOrderID string
	PositionIndex *int
}

type Writer interface {
	Reader
	ConfigurePosition(context.Context, string, int, domain.MarginMode) error
	PlaceOrder(context.Context, PlaceOrderInput) (domain.Order, error)
	CancelOrder(context.Context, string, string) (domain.Order, error)
}

type Endpoints struct {
	BinanceFutures   string
	BinanceFuturesWS string
	BinanceSpot      string
	Bybit            string
}

func DemoEndpoints() Endpoints {
	return Endpoints{
		BinanceFutures:   "https://demo-fapi.binance.com",
		BinanceFuturesWS: "wss://fstream.binancefuture.com",
		BinanceSpot:      "https://demo-api.binance.com",
		Bybit:            "https://api-demo.bybit.com",
	}
}

// PublicMarketEndpoints exposes only public exchange market-data hosts. It is
// consumed through PriceReader, whose interface has no mutating method.
func PublicMarketEndpoints() Endpoints {
	return Endpoints{
		BinanceFutures:   "https://fapi.binance.com",
		BinanceFuturesWS: "wss://fstream.binance.com",
		BinanceSpot:      "https://api.binance.com",
		Bybit:            "https://api.bybit.com",
	}
}
