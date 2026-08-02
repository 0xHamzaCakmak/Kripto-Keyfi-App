package account

import (
	"context"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

type Resolved struct {
	Reference        domain.ExchangeAccountRef
	Credentials      exchange.Credentials
	Engine           string
	ConnectionStatus string
}

type Store interface {
	Resolve(context.Context, string, string) (Resolved, error)
}
