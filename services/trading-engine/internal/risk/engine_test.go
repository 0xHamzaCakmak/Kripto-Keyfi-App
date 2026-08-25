package risk

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

var riskTestTime = time.Date(2026, 8, 2, 14, 0, 0, 0, time.UTC)

type fakeStore struct {
	profile   Profile
	usage     Usage
	loadErr   error
	decisions []Decision
}

func (s *fakeStore) LoadProfile(context.Context, string, string) (Profile, error) {
	return s.profile, s.loadErr
}
func (s *fakeStore) LoadUsage(context.Context, string, time.Time) (Usage, error) {
	return s.usage, s.loadErr
}
func (s *fakeStore) RecordDecision(_ context.Context, _ account.Resolved, _ OrderInput, decision Decision, _ time.Time) error {
	s.decisions = append(s.decisions, decision)
	return nil
}

type fakeMarket struct {
	mark                                   domain.Decimal
	balances                               []domain.Balance
	positions                              []domain.Position
	markCalls, balanceCalls, positionCalls int
	err                                    error
}

func (m *fakeMarket) GetMarkPrice(context.Context, string) (domain.Decimal, error) {
	m.markCalls++
	return m.mark, m.err
}
func (m *fakeMarket) GetBalances(context.Context) ([]domain.Balance, error) {
	m.balanceCalls++
	return m.balances, m.err
}
func (m *fakeMarket) GetPositions(context.Context) ([]domain.Position, error) {
	m.positionCalls++
	return m.positions, m.err
}

func TestEngineApprovesOrderWithinAllLimits(t *testing.T) {
	store := &fakeStore{profile: safeProfile(), usage: Usage{OrdersLastMinute: 1, OrdersToday: 4}}
	market := safeMarket()
	engine := New(store)
	engine.now = func() time.Time { return riskTestTime }
	decision, err := engine.Evaluate(t.Context(), testAccount(), testOrder(), market)
	if err != nil || decision.Status != "APPROVED" || decision.Code != "RISK_APPROVED" || len(store.decisions) != 1 {
		t.Fatalf("unexpected approval: %#v err=%v", decision, err)
	}
	if market.markCalls != 1 || market.positionCalls != 1 || market.balanceCalls != 1 {
		t.Fatalf("risk snapshot was incomplete: %#v", market)
	}
}

func TestEngineBlocksGlobalKillSwitchBeforeMarketRead(t *testing.T) {
	profile := safeProfile()
	profile.GlobalKillSwitch = true
	store := &fakeStore{profile: profile}
	market := safeMarket()
	decision, err := New(store).Evaluate(t.Context(), testAccount(), testOrder(), market)
	if err != nil || decision.Status != "SYSTEM_BLOCKED" || decision.Code != "GLOBAL_KILL_SWITCH_ACTIVE" {
		t.Fatalf("kill switch did not block: %#v err=%v", decision, err)
	}
	if market.markCalls+market.positionCalls+market.balanceCalls != 0 {
		t.Fatal("kill switch performed unnecessary exchange reads")
	}
}

func TestEngineRejectsLeverageBeforeExchangeRead(t *testing.T) {
	store := &fakeStore{profile: safeProfile()}
	market := safeMarket()
	order := testOrder()
	order.Leverage = 10
	decision, err := New(store).Evaluate(t.Context(), testAccount(), order, market)
	if err != nil || decision.Code != "RISK_MAX_LEVERAGE_EXCEEDED" || decision.Status != "REJECTED" {
		t.Fatalf("leverage was not rejected: %#v err=%v", decision, err)
	}
	if market.markCalls != 0 {
		t.Fatal("rejected leverage reached market lookup")
	}
}

func TestEngineRejectsLeverageBelowAdminMinimum(t *testing.T) {
	profile := safeProfile()
	profile.MinLeverage = 5
	store := &fakeStore{profile: profile}
	decision, err := New(store).Evaluate(t.Context(), testAccount(), testOrder(), safeMarket())
	if err != nil || decision.Code != "RISK_MIN_LEVERAGE_NOT_MET" || decision.Status != "REJECTED" {
		t.Fatalf("minimum leverage was not enforced: %#v err=%v", decision, err)
	}
}

func TestEngineAllowsReduceOnlyExitDuringKillSwitch(t *testing.T) {
	profile := safeProfile()
	profile.GlobalKillSwitch = true
	store := &fakeStore{profile: profile}
	market := safeMarket()
	order := testOrder()
	order.ReduceOnly = true
	decision, err := New(store).Evaluate(t.Context(), testAccount(), order, market)
	if err != nil || decision.Status != "APPROVED" || decision.Code != "RISK_REDUCING_EXIT" {
		t.Fatalf("risk-reducing exit was blocked: %#v err=%v", decision, err)
	}
	if market.markCalls+market.positionCalls+market.balanceCalls != 0 {
		t.Fatal("reduce-only exit performed unnecessary market reads")
	}
}

func TestEngineFailsClosedWhenSnapshotUnavailable(t *testing.T) {
	store := &fakeStore{profile: safeProfile()}
	market := safeMarket()
	market.err = errors.New("exchange unavailable")
	decision, err := New(store).Evaluate(t.Context(), testAccount(), testOrder(), market)
	if err == nil || decision.Status != "SYSTEM_BLOCKED" || decision.Code != "RISK_MARK_PRICE_UNAVAILABLE" {
		t.Fatalf("snapshot failure did not fail closed: %#v err=%v", decision, err)
	}
}

func TestEngineEnforcesBalanceReserveAndOrderRate(t *testing.T) {
	store := &fakeStore{profile: safeProfile()}
	market := safeMarket()
	market.balances[0].AvailableBalance = "25"
	decision, err := New(store).Evaluate(t.Context(), testAccount(), testOrder(), market)
	if err != nil || decision.Code != "RISK_MIN_BALANCE_RESERVE" {
		t.Fatalf("reserve was not enforced: %#v err=%v", decision, err)
	}

	store = &fakeStore{profile: safeProfile(), usage: Usage{OrdersLastMinute: 11}}
	market = safeMarket()
	decision, err = New(store).Evaluate(t.Context(), testAccount(), testOrder(), market)
	if err != nil || decision.Code != "RISK_ORDER_RATE_EXCEEDED" {
		t.Fatalf("rate was not enforced: %#v err=%v", decision, err)
	}
}

func TestEngineCountsUSDCOnlyWhenBinanceMarksItAsMarginAvailable(t *testing.T) {
	store := &fakeStore{profile: safeProfile()}
	market := safeMarket()
	market.balances[0].AvailableBalance = "25"
	market.balances = append(market.balances, domain.Balance{WalletType: domain.WalletUSDMFutures, Asset: "USDC", AvailableBalance: "50", PriceUSDT: "1", MarginAvailable: true})
	decision, err := New(store).Evaluate(t.Context(), testAccount(), testOrder(), market)
	if err != nil || decision.Code != "RISK_APPROVED" {
		t.Fatalf("margin-eligible USDC was not counted: %#v err=%v", decision, err)
	}

	market.balances[1].MarginAvailable = false
	decision, err = New(&fakeStore{profile: safeProfile()}).Evaluate(t.Context(), testAccount(), testOrder(), market)
	if err != nil || decision.Code != "RISK_MIN_BALANCE_RESERVE" {
		t.Fatalf("non-collateral USDC was incorrectly counted: %#v err=%v", decision, err)
	}
}

func safeProfile() Profile {
	return Profile{Enabled: true, MaxOrderNotional: "100", MaxInitialMargin: "50", MaxAccountOpenNotional: "500",
		MaxOpenPositions: 5, MaxSymbolPositions: 1, MaxLeverage: 5, MinAvailableBalance: "20",
		MaxOrdersPerMinute: 10, MaxDailyOrders: 100}
}

func safeMarket() *fakeMarket {
	return &fakeMarket{mark: "50000", balances: []domain.Balance{{WalletType: domain.WalletUSDMFutures, Asset: "USDT", AvailableBalance: "100"}}}
}

func testAccount() account.Resolved {
	return account.Resolved{Reference: domain.ExchangeAccountRef{ID: "account-1", UserID: "user-1", Provider: domain.ProviderBinance}, Engine: "GO", ConnectionStatus: "CONNECTED"}
}

func testOrder() OrderInput {
	return OrderInput{ID: "order-1", UserID: "user-1", ExchangeAccountID: "account-1", Symbol: "BTCUSDT", Source: "MANUAL", Quantity: "0.001", Leverage: 2}
}
