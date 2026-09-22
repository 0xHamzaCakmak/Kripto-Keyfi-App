package shadow

import (
	"context"
	"errors"
	"testing"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

type orderAccount struct{ calls int }

func (s *orderAccount) Resolve(context.Context, string, string) (account.Resolved, error) {
	return account.Resolved{}, errors.New("write resolution should not be used")
}
func (s *orderAccount) ResolveReadOnly(_ context.Context, user, id string) (account.Resolved, error) {
	s.calls++
	if user != "owner" || id != "account" {
		return account.Resolved{}, errors.New("not owned")
	}
	return account.Resolved{}, nil
}

type ordersOnlyReader struct{ exchange.Reader }

func (ordersOnlyReader) GetOpenOrders(context.Context) ([]domain.Order, error) {
	return []domain.Order{{Symbol: "BTCUSDT", Type: domain.OrderTakeProfitMarket}}, nil
}
func TestOrderReadIsOwnedAndIndependentOfBalancesAndSymbols(t *testing.T) {
	store := &orderAccount{}
	service := NewWithFactory(store, func(account.Resolved) (exchange.Reader, error) { return ordersOnlyReader{}, nil })
	rows, err := service.OpenOrders(t.Context(), "owner", "account")
	if err != nil || len(rows) != 1 || rows[0].Type != domain.OrderTakeProfitMarket {
		t.Fatalf("orders=%v err=%v", rows, err)
	}
	if _, err := service.OpenOrders(t.Context(), "other", "account"); err == nil {
		t.Fatal("cross-user read allowed")
	}
	if store.calls != 2 {
		t.Fatal("ownership must be resolved on each read")
	}
}
