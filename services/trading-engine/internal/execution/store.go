package execution

import (
	"context"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type StoredOrder struct {
	ID                string
	UserID            string
	ExchangeAccountID string
	IdempotencyKey    string
	ClientOrderID     string
	ExchangeOrderID   string
	Symbol            string
	Side              domain.OrderSide
	PositionSide      domain.PositionSide
	Type              domain.OrderType
	Quantity          domain.Decimal
	Price             domain.Decimal
	StopPrice         domain.Decimal
	Leverage          int
	MarginMode        domain.MarginMode
	ReduceOnly        bool
	Source            string
	Status            domain.OrderStatus
}

type ClaimResult string

const (
	ClaimAcquired               ClaimResult = "ACQUIRED"
	ClaimCompletedReplay        ClaimResult = "COMPLETED_REPLAY"
	ClaimReconciliationRequired ClaimResult = "RECONCILIATION_REQUIRED"
)

type OrderStore interface {
	Claim(context.Context, string, string, string, string, string, time.Time) (StoredOrder, ClaimResult, error)
	Complete(context.Context, StoredOrder, domain.Order, time.Time) error
	Fail(context.Context, StoredOrder, domain.ExchangeError, time.Time) error
	ClaimCancel(context.Context, string, string, string, string, string, time.Time) (StoredOrder, ClaimResult, error)
	CompleteCancel(context.Context, StoredOrder, time.Time) error
	FailCancel(context.Context, StoredOrder, domain.ExchangeError, time.Time) error
}
