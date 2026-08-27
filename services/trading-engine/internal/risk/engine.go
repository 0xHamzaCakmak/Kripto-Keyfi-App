package risk

import (
	"context"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type Profile struct {
	Enabled, GlobalKillSwitch, AccountKillSwitch                   bool
	MaxOrderNotional, MaxInitialMargin, MaxAccountOpenNotional     domain.Decimal
	MaxOpenPositions, MaxSymbolPositions, MinLeverage, MaxLeverage int
	MinAvailableBalance                                            domain.Decimal
	MaxOrdersPerMinute, MaxDailyOrders                             int
	AllowedSymbols, BlockedSymbols                                 []string
}

type Usage struct{ OrdersLastMinute, OrdersToday int }

type OrderInput struct {
	ID, UserID, ExchangeAccountID, Symbol, Source string
	Quantity, Price                               domain.Decimal
	Leverage                                      int
	ReduceOnly                                    bool
}

type Decision struct {
	Status, Code, Message string
	Metrics               map[string]any
}

type Store interface {
	LoadProfile(context.Context, string, string) (Profile, error)
	LoadUsage(context.Context, string, string, time.Time) (Usage, error)
	RecordDecision(context.Context, account.Resolved, OrderInput, Decision, time.Time) error
}

type MarketReader interface {
	GetBalances(context.Context) ([]domain.Balance, error)
	GetPositions(context.Context) ([]domain.Position, error)
	GetMarkPrice(context.Context, string) (domain.Decimal, error)
}

type Evaluator interface {
	Evaluate(context.Context, account.Resolved, OrderInput, MarketReader) (Decision, error)
}

type Engine struct {
	store Store
	now   func() time.Time
}

func New(store Store) *Engine { return &Engine{store: store, now: time.Now} }

func (e *Engine) Evaluate(ctx context.Context, resolved account.Resolved, order OrderInput, market MarketReader) (Decision, error) {
	if order.ReduceOnly {
		decision := approved("RISK_REDUCING_EXIT", "Reduce-only risk azaltıcı emir onaylandı.", nil)
		_ = e.store.RecordDecision(ctx, resolved, order, decision, e.now())
		return decision, nil
	}
	profile, err := e.store.LoadProfile(ctx, order.UserID, order.ExchangeAccountID)
	if err != nil {
		return e.block(ctx, resolved, order, "RISK_PROFILE_UNAVAILABLE", "Risk profili doğrulanamadı.", nil, err)
	}
	if profile.GlobalKillSwitch {
		return e.block(ctx, resolved, order, "GLOBAL_KILL_SWITCH_ACTIVE", "Global acil durdurma aktif.", nil, nil)
	}
	if !profile.Enabled {
		return e.block(ctx, resolved, order, "RISK_PROFILE_DISABLED", "Hesap risk profili etkin değil.", nil, nil)
	}
	if profile.AccountKillSwitch {
		return e.riskBlock(ctx, resolved, order, "ACCOUNT_KILL_SWITCH_ACTIVE", "Hesap acil durdurması aktif.", nil)
	}
	if contains(profile.BlockedSymbols, order.Symbol) {
		return e.reject(ctx, resolved, order, "SYMBOL_BLOCKED", "Parite risk profili tarafından engellendi.", nil)
	}
	if len(profile.AllowedSymbols) > 0 && !containsTradingSymbol(profile.AllowedSymbols, order.Symbol) {
		return e.reject(ctx, resolved, order, "SYMBOL_NOT_ALLOWED", "Parite izin verilen risk listesinin dışında.", nil)
	}
	if order.Leverage < maxInt(profile.MinLeverage, 1) {
		return e.reject(ctx, resolved, order, "RISK_MIN_LEVERAGE_NOT_MET", "Seçilen kaldıraç hesap asgari kaldıraç sınırının altında.", map[string]any{"requestedLeverage": order.Leverage, "minLeverage": maxInt(profile.MinLeverage, 1)})
	}
	if order.Leverage > profile.MaxLeverage {
		return e.reject(ctx, resolved, order, "RISK_MAX_LEVERAGE_EXCEEDED", "Seçilen kaldıraç hesap risk limitini aşıyor.", map[string]any{"requestedLeverage": order.Leverage, "maxLeverage": profile.MaxLeverage})
	}

	price := order.Price
	if price == "" {
		price, err = market.GetMarkPrice(ctx, order.Symbol)
		if err != nil {
			return e.block(ctx, resolved, order, "RISK_MARK_PRICE_UNAVAILABLE", "Mark fiyatı doğrulanamadı.", nil, err)
		}
	}
	notional, ok := multiply(order.Quantity, price)
	if !ok {
		return e.block(ctx, resolved, order, "RISK_INVALID_NOTIONAL", "Emir büyüklüğü hesaplanamadı.", nil, errors.New("invalid decimal"))
	}
	initialMargin, ok := divide(notional, order.Leverage)
	if !ok {
		return e.block(ctx, resolved, order, "RISK_INVALID_MARGIN", "Başlangıç teminatı hesaplanamadı.", nil, errors.New("invalid leverage"))
	}
	metrics := map[string]any{"orderNotional": notional, "initialMargin": initialMargin, "leverage": order.Leverage}
	manualOrder := strings.EqualFold(strings.TrimSpace(order.Source), "MANUAL")
	metrics["manualOrder"] = manualOrder
	if !manualOrder && greater(notional, profile.MaxOrderNotional) {
		return e.reject(ctx, resolved, order, "RISK_MAX_ORDER_NOTIONAL_EXCEEDED", "Emir büyüklüğü işlem başı risk limitini aşıyor.", metrics)
	}
	if !manualOrder && greater(initialMargin, profile.MaxInitialMargin) {
		return e.reject(ctx, resolved, order, "RISK_MAX_INITIAL_MARGIN_EXCEEDED", "Emir teminatı işlem başı risk limitini aşıyor.", metrics)
	}
	if manualOrder {
		metrics["manualPerOrderLimitsBypassed"] = true
	}

	positions, err := market.GetPositions(ctx)
	if err != nil {
		return e.block(ctx, resolved, order, "RISK_POSITIONS_UNAVAILABLE", "Açık pozisyonlar doğrulanamadı.", metrics, err)
	}
	openNotional := domain.Decimal("0")
	symbolPositions := 0
	for _, position := range positions {
		value, valid := multiply(position.Quantity, position.MarkPrice)
		if !valid {
			return e.block(ctx, resolved, order, "RISK_POSITION_VALUE_INVALID", "Açık pozisyon değeri hesaplanamadı.", metrics, errors.New("invalid position decimal"))
		}
		openNotional, _ = add(openNotional, value)
		if position.Symbol == order.Symbol {
			symbolPositions++
		}
	}
	projectedNotional, _ := add(openNotional, notional)
	metrics["openPositionCount"] = len(positions)
	metrics["symbolPositionCount"] = symbolPositions
	metrics["projectedOpenNotional"] = projectedNotional
	if len(positions) >= profile.MaxOpenPositions && symbolPositions == 0 {
		return e.reject(ctx, resolved, order, "RISK_MAX_OPEN_POSITIONS_REACHED", "Maksimum açık pozisyon sayısına ulaşıldı.", metrics)
	}
	projectedSymbolPositions := symbolPositions
	if projectedSymbolPositions == 0 {
		projectedSymbolPositions = 1
	}
	metrics["projectedSymbolPositionCount"] = projectedSymbolPositions
	if projectedSymbolPositions > profile.MaxSymbolPositions {
		return e.reject(ctx, resolved, order, "RISK_MAX_SYMBOL_POSITIONS_REACHED", "Parite başına açık pozisyon limitine ulaşıldı.", metrics)
	}
	if greater(projectedNotional, profile.MaxAccountOpenNotional) {
		return e.reject(ctx, resolved, order, "RISK_MAX_ACCOUNT_NOTIONAL_EXCEEDED", "Hesap toplam açık pozisyon limiti aşılır.", metrics)
	}

	balances, err := market.GetBalances(ctx)
	if err != nil {
		return e.block(ctx, resolved, order, "RISK_BALANCE_UNAVAILABLE", "Vadeli bakiye doğrulanamadı.", metrics, err)
	}
	available := domain.Decimal("0")
	usdcContract := strings.HasSuffix(order.Symbol, "USDC")
	for _, balance := range balances {
		if balance.WalletType == domain.WalletUSDMFutures && balance.Asset == "USDT" && (!usdcContract || balance.MarginAvailable) {
			available, _ = add(available, balance.AvailableBalance)
		}
		if balance.WalletType == domain.WalletUSDMFutures && balance.Asset == "USDC" && (balance.MarginAvailable || usdcContract) {
			price := balance.PriceUSDT
			if price == "" {
				price = "1"
			}
			value, valid := multiply(balance.AvailableBalance, price)
			if !valid {
				return e.block(ctx, resolved, order, "RISK_BALANCE_INVALID", "USDC teminat değeri hesaplanamadı.", metrics, errors.New("invalid USDC collateral value"))
			}
			available, _ = add(available, value)
		}
	}
	remaining, ok := subtract(available, initialMargin)
	if !ok {
		return e.block(ctx, resolved, order, "RISK_BALANCE_INVALID", "Kullanılabilir bakiye hesaplanamadı.", metrics, errors.New("invalid balance decimal"))
	}
	metrics["availableBalance"] = available
	metrics["remainingBalance"] = remaining
	if less(remaining, profile.MinAvailableBalance) {
		return e.reject(ctx, resolved, order, "RISK_MIN_BALANCE_RESERVE", "Emir minimum bakiye rezervini ihlal eder.", metrics)
	}

	usage, err := e.store.LoadUsage(ctx, order.ExchangeAccountID, order.Source, e.now())
	if err != nil {
		return e.block(ctx, resolved, order, "RISK_USAGE_UNAVAILABLE", "Emir sıklığı doğrulanamadı.", metrics, err)
	}
	metrics["ordersLastMinute"] = usage.OrdersLastMinute
	metrics["ordersToday"] = usage.OrdersToday
	if usage.OrdersLastMinute > profile.MaxOrdersPerMinute {
		return e.reject(ctx, resolved, order, "RISK_ORDER_RATE_EXCEEDED", "Dakikalık emir sıklığı limiti aşıldı.", metrics)
	}
	if usage.OrdersToday > profile.MaxDailyOrders {
		return e.reject(ctx, resolved, order, "RISK_DAILY_ORDER_LIMIT_EXCEEDED", "Günlük emir sayısı limiti aşıldı.", metrics)
	}

	decision := approved("RISK_APPROVED", "Emir merkezi risk kontrolünden geçti.", metrics)
	if err := e.store.RecordDecision(ctx, resolved, order, decision, e.now()); err != nil {
		return Decision{}, err
	}
	return decision, nil
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func (e *Engine) reject(ctx context.Context, resolved account.Resolved, order OrderInput, code, message string, metrics map[string]any) (Decision, error) {
	decision := Decision{Status: "REJECTED", Code: code, Message: message, Metrics: metrics}
	if err := e.store.RecordDecision(ctx, resolved, order, decision, e.now()); err != nil {
		return Decision{}, err
	}
	return decision, nil
}

func (e *Engine) block(ctx context.Context, resolved account.Resolved, order OrderInput, code, message string, metrics map[string]any, cause error) (Decision, error) {
	decision := Decision{Status: "SYSTEM_BLOCKED", Code: code, Message: message, Metrics: metrics}
	if err := e.store.RecordDecision(ctx, resolved, order, decision, e.now()); err != nil && cause == nil {
		cause = err
	}
	return decision, cause
}

func (e *Engine) riskBlock(ctx context.Context, resolved account.Resolved, order OrderInput, code, message string, metrics map[string]any) (Decision, error) {
	decision := Decision{Status: "RISK_BLOCKED", Code: code, Message: message, Metrics: metrics}
	if err := e.store.RecordDecision(ctx, resolved, order, decision, e.now()); err != nil {
		return Decision{}, err
	}
	return decision, nil
}

func approved(code, message string, metrics map[string]any) Decision {
	return Decision{Status: "APPROVED", Code: code, Message: message, Metrics: metrics}
}
func contains(values []string, value string) bool {
	for _, item := range values {
		if strings.EqualFold(item, value) {
			return true
		}
	}
	return false
}

func containsTradingSymbol(values []string, value string) bool {
	if contains(values, value) {
		return true
	}
	if strings.HasSuffix(value, "USDC") {
		return contains(values, strings.TrimSuffix(value, "USDC")+"USDT")
	}
	return false
}
func rational(value domain.Decimal) (*big.Rat, bool) {
	result, ok := new(big.Rat).SetString(string(value))
	return result, ok
}
func decimal(value *big.Rat) domain.Decimal {
	return domain.Decimal(strings.TrimRight(strings.TrimRight(value.FloatString(18), "0"), "."))
}
func multiply(left, right domain.Decimal) (domain.Decimal, bool) {
	l, lok := rational(left)
	r, rok := rational(right)
	if !lok || !rok {
		return "", false
	}
	return decimal(new(big.Rat).Mul(l, r)), true
}
func divide(value domain.Decimal, divisor int) (domain.Decimal, bool) {
	v, ok := rational(value)
	if !ok || divisor <= 0 {
		return "", false
	}
	return decimal(new(big.Rat).Quo(v, big.NewRat(int64(divisor), 1))), true
}
func add(left, right domain.Decimal) (domain.Decimal, bool) {
	l, lok := rational(left)
	r, rok := rational(right)
	if !lok || !rok {
		return "", false
	}
	return decimal(new(big.Rat).Add(l, r)), true
}
func subtract(left, right domain.Decimal) (domain.Decimal, bool) {
	l, lok := rational(left)
	r, rok := rational(right)
	if !lok || !rok {
		return "", false
	}
	return decimal(new(big.Rat).Sub(l, r)), true
}
func greater(left, right domain.Decimal) bool {
	l, lok := rational(left)
	r, rok := rational(right)
	return lok && rok && l.Cmp(r) > 0
}
func less(left, right domain.Decimal) bool {
	l, lok := rational(left)
	r, rok := rational(right)
	return lok && rok && l.Cmp(r) < 0
}
