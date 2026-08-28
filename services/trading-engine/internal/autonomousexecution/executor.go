package autonomousexecution

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"sync"
	"time"

	tradingv1 "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/api/v1"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/execution"
	mysqlstore "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/storage/mysql"
)

type Store interface {
	CreateAutonomousOrder(context.Context, bot.Instance, mysqlstore.AutonomousOrderInput, time.Time) error
	MarkAutonomousExecution(context.Context, int64, bool, string) error
	MarkAutonomousExecutionFailure(context.Context, int64, string, string, string) error
	MarkAutonomousReentryGuard(context.Context, bot.Instance, int64, string, time.Time) error
}

type ExecutionService interface {
	Positions(context.Context, domain.ExchangeAccountRef) ([]domain.Position, error)
	OpenOrders(context.Context, domain.ExchangeAccountRef) ([]domain.Order, error)
	MarketRule(context.Context, domain.ExchangeAccountRef, string) (domain.SymbolRule, domain.Decimal, error)
	Preview(context.Context, tradingv1.PreviewOrderRequest) (tradingv1.PreviewOrderResponse, error)
	Place(context.Context, tradingv1.PlaceOrderCommand) (domain.Order, bool, error)
	Cancel(context.Context, tradingv1.CancelOrderCommand) (domain.Order, bool, error)
}

type Executor struct {
	store           Store
	execution       ExecutionService
	locksMu         sync.Mutex
	locks           map[string]*sync.Mutex
	positionMu      sync.Mutex
	positionWasOpen map[string]bool
}

func New(store Store, service *execution.Service) *Executor {
	return &Executor{store: store, execution: service, locks: make(map[string]*sync.Mutex), positionWasOpen: make(map[string]bool)}
}

// RecordFailure persists a scheduler-visible execution outcome. Without this,
// a rejected TESTNET submission only existed in process logs and the UI looked
// like the decision silently stopped before execution.
func (e *Executor) RecordFailure(ctx context.Context, decisionID int64, cause error) error {
	status, code, detail := executionFailure(cause)
	return e.store.MarkAutonomousExecutionFailure(ctx, decisionID, status, code, detail)
}

// MaintainPosition runs even for HOLD/rejected entry decisions, so an open
// position never loses deterministic TP/SL handling when no new entry exists.
func (e *Executor) MaintainPosition(ctx context.Context, instance bot.Instance, decisionID int64, now time.Time) error {
	if instance.Type != "AUTONOMOUS" || instance.Mode != "DEMO" || e.execution == nil {
		return errors.New("autonomous TESTNET executor is disabled")
	}
	if instance.Configuration["entryPaused"] == true {
		return nil
	}
	reference := domain.ExchangeAccountRef{ID: instance.ExchangeAccountID, UserID: instance.UserID, Provider: domain.ProviderBinance, Environment: domain.EnvironmentTestnet, AccountType: domain.AccountTypeUSDTM}
	positions, err := e.execution.Positions(ctx, reference)
	if err != nil {
		return fmt.Errorf("POSITION_SYNC_FAILED: read TESTNET positions: %w", err)
	}
	orders, err := e.execution.OpenOrders(ctx, reference)
	if err != nil {
		return fmt.Errorf("ORDER_SYNC_FAILED: read TESTNET open orders: %w", err)
	}
	prefix := botClientPrefix(instance.ID)
	hedgeMode := instance.Configuration["hedgeModeEnabled"] == true
	for index := range positions {
		position := positions[index]
		if position.Symbol != instance.Symbol || decimalSign(string(position.Quantity)) == 0 {
			continue
		}
		if hedgeMode && !hasBotProtectionForSide(orders, instance.Symbol, prefix, position.Side) {
			continue
		}
		key := instance.ExchangeAccountID + ":" + instance.Symbol
		if hedgeMode {
			key += ":" + string(position.Side)
		}
		lock := e.lockFor(key)
		lock.Lock()
		handled, maintainErr := e.closeReachedProtection(ctx, instance, decisionID, position, orders, reference, now)
		if maintainErr == nil && !handled && !positionProtectionComplete(position, orders, prefix, instance.Configuration) {
			maintainErr = e.ensurePositionProtection(ctx, instance, decisionID, position, orders, reference, now)
		}
		if handled {
			e.setPositionClosed(key)
		}
		lock.Unlock()
		if maintainErr != nil {
			return maintainErr
		}
	}
	return nil
}

func (e *Executor) Execute(ctx context.Context, instance bot.Instance, decision bot.Decision, decisionID int64, now time.Time) error {
	if instance.Type != "AUTONOMOUS" || instance.Mode != "DEMO" || e.execution == nil {
		return errors.New("autonomous TESTNET executor is disabled")
	}
	if instance.Configuration["entryPaused"] == true {
		// A paused bot must leave both flat and open exchange state untouched.
		// Existing exchange-side orders remain in place and can still be filled,
		// but this executor does not create, cancel, replace or close anything.
		return e.store.MarkAutonomousExecution(ctx, decisionID, false, "autonomous TESTNET execution is paused; existing positions and orders are untouched")
	}
	order := decision.HypotheticalOrder
	sideText, sideOK := order["side"].(string)
	quantityText, quantityOK := order["quantity"].(string)
	stopText, stopOK := order["stopLoss"].(string)
	takeText, takeOK := order["takeProfit"].(string)
	leverage, leverageOK := order["leverage"].(int)
	if !sideOK || !quantityOK || !stopOK || !takeOK || !leverageOK || stopText == "" || takeText == "" || leverage < 5 || leverage > 20 {
		return errors.New("autonomous TESTNET intent is incomplete or unsafe")
	}
	side := domain.OrderSide(strings.ToUpper(sideText))
	if side != domain.SideBuy && side != domain.SideSell {
		return errors.New("invalid autonomous side")
	}
	if costBps, ok := numericConfiguration(instance.Configuration["estimatedRoundTripCostBps"]); ok {
		adjusted, adjustErr := addCostBufferToTake(takeText, side, costBps)
		if adjustErr != nil {
			return adjustErr
		}
		takeText = adjusted
	}
	desiredPositionSide := positionSideForOrder(side, false)
	hedgeMode := instance.Configuration["hedgeModeEnabled"] == true
	executionKey := instance.ExchangeAccountID + ":" + instance.Symbol
	if hedgeMode {
		executionKey += ":" + string(desiredPositionSide)
	}
	executionLock := e.lockFor(executionKey)
	executionLock.Lock()
	defer executionLock.Unlock()
	reference := domain.ExchangeAccountRef{ID: instance.ExchangeAccountID, UserID: instance.UserID, Provider: domain.ProviderBinance, Environment: domain.EnvironmentTestnet, AccountType: domain.AccountTypeUSDTM}
	allocation, allocationOK := numericConfiguration(instance.Configuration["allocationUsdt"])
	var sizingRule domain.SymbolRule
	var sizingMark domain.Decimal
	if allocationOK && allocation > 0 {
		rule, mark, marketErr := e.execution.MarketRule(ctx, reference, instance.Symbol)
		if marketErr != nil {
			return fmt.Errorf("load TESTNET sizing rule: %w", marketErr)
		}
		sizingRule, sizingMark = rule, mark
	}
	positions, err := e.execution.Positions(ctx, reference)
	if err != nil {
		return fmt.Errorf("read TESTNET position before execution: %w", err)
	}
	openOrders, err := e.execution.OpenOrders(ctx, reference)
	if err != nil {
		return fmt.Errorf("read TESTNET open orders before execution: %w", err)
	}
	var current *domain.Position
	for index := range positions {
		if positions[index].Symbol == instance.Symbol && (!hedgeMode || positions[index].Side == desiredPositionSide || positions[index].Side == "") && decimalSign(string(positions[index].Quantity)) != 0 {
			current = &positions[index]
			break
		}
	}
	// Refresh state without suppressing a valid signal for the rest of the 15m
	// candle. The mutex, idempotency key and short scheduler interval remain the
	// duplicate/exchange-race protection.
	e.observePosition(executionKey, current != nil)
	if current != nil {
		if instance.Configuration["hedgeModeEnabled"] == true && !hasBotProtection(openOrders, instance.Symbol, botClientPrefix(instance.ID)) {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "the existing hedge leg is owned by another bot or manual trade; same-side merge rejected")
		}
		handled, protectionErr := e.closeReachedProtection(ctx, instance, decisionID, *current, openOrders, reference, now)
		if protectionErr != nil {
			return protectionErr
		}
		if handled {
			return nil
		}
		if !positionProtectionComplete(*current, openOrders, botClientPrefix(instance.ID), instance.Configuration) {
			return e.ensurePositionProtection(ctx, instance, decisionID, *current, openOrders, reference, now)
		}
		if manualLimitClosePending(openOrders, instance.Symbol) {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "manual reduce-only LIMIT close is open; autonomous additions are suspended")
		}
		if instance.Configuration["pyramidingEnabled"] != true || !samePositionDirection(*current, side) {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "existing TESTNET position is already protected; no additional entry allowed")
		}
		if instance.Configuration["testnetTrendGridEnabled"] == true {
			stepBps, stepOK := numericConfiguration(instance.Configuration["testnetGridStepBps"])
			if !stepOK || stepBps < 10 || stepBps > 500 {
				return errors.New("TESTNET trend-grid step is invalid")
			}
			if !favorableTrendGridStepReached(*current, sizingMark, stepBps) {
				return e.store.MarkAutonomousExecution(ctx, decisionID, false, "TESTNET trend-grid is waiting for the next favorable price level")
			}
		}
		if !allocationOK || allocation <= 0 {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "existing TESTNET position is already protected; pyramiding allocation is unavailable")
		}
		// The TESTNET allocation is cash/initial-margin capital. Binance position
		// exposure is leveraged notional, so compare the open position against
		// allocation x the exchange position's actual leverage.
		positionLeverage, parseErr := strconv.Atoi(string(current.Leverage))
		if parseErr != nil || positionLeverage < 1 {
			return errors.New("open TESTNET position leverage could not be verified")
		}
		positionAllocation := allocation
		if instance.Configuration["testnetMarginAllocationMode"] == true {
			positionAllocation *= float64(positionLeverage)
		}
		remaining, remainingErr := remainingAllocation(positionAllocation, *current, sizingMark)
		if remainingErr != nil {
			return remainingErr
		}
		if remaining <= 0 {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "existing TESTNET position reached its approved allocation")
		}
		quantityText, err = alignApprovedQuantity(quantityText, remaining, sizingRule, sizingMark)
		if errors.Is(err, errAllocationExhausted) {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "remaining TESTNET allocation is below the exchange minimum quantity")
		}
		if err != nil {
			return err
		}
		quantityText, err = enforceConfiguredMinimumMargin(quantityText, remaining, positionLeverage, instance.Configuration, sizingRule, sizingMark)
		if errors.Is(err, errAllocationExhausted) {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "remaining TESTNET allocation is below the configured minimum initial margin")
		}
		if err != nil {
			return err
		}
		// Binance does not permit changing leverage while an isolated position is
		// open. Preserve the exchange position's leverage for same-side additions.
		return e.pyramidPosition(ctx, instance, decisionID, side, quantityText, positionLeverage, *current, openOrders, reference, order, now)
	}
	if allocationOK && allocation > 0 {
		positionAllocation := allocation
		if instance.Configuration["testnetMarginAllocationMode"] == true {
			positionAllocation *= float64(leverage)
		}
		quantityText, err = alignApprovedQuantity(quantityText, positionAllocation, sizingRule, sizingMark)
		if err != nil {
			return err
		}
		quantityText, err = enforceConfiguredMinimumMargin(quantityText, positionAllocation, leverage, instance.Configuration, sizingRule, sizingMark)
		if err != nil {
			return err
		}
	}
	if err := e.cancelStaleProtectives(ctx, instance, decisionID, openOrders, reference, now); err != nil {
		return err
	}
	entryPreview, err := e.execution.Preview(ctx, tradingv1.PreviewOrderRequest{Account: reference, Symbol: instance.Symbol, Side: side, Type: domain.OrderMarket, Quantity: domain.Decimal(quantityText), Leverage: leverage, MarginMode: domain.MarginIsolated})
	if err != nil {
		return fmt.Errorf("autonomous TESTNET entry preview rejected: %w", err)
	}
	exitSide := domain.SideSell
	if side == domain.SideSell {
		exitSide = domain.SideBuy
	}
	stopPrice, err := alignStopPrice(stopText, string(entryPreview.Rule.TickSize), exitSide)
	if err != nil {
		return fmt.Errorf("align protective stop: %w", err)
	}
	if _, err := e.execution.Preview(ctx, tradingv1.PreviewOrderRequest{Account: reference, Symbol: instance.Symbol, Side: exitSide, Type: domain.OrderStopMarket, Quantity: domain.Decimal(quantityText), StopPrice: domain.Decimal(stopPrice), Leverage: leverage, MarginMode: domain.MarginIsolated, ReduceOnly: true}); err != nil {
		return fmt.Errorf("autonomous TESTNET protective stop preview rejected: %w", err)
	}
	takePrice, err := alignStopPrice(takeText, string(entryPreview.Rule.TickSize), exitSide)
	if err != nil {
		return fmt.Errorf("align take profit: %w", err)
	}
	if _, err := e.execution.Preview(ctx, tradingv1.PreviewOrderRequest{Account: reference, Symbol: instance.Symbol, Side: exitSide, Type: domain.OrderTakeProfitMarket, Quantity: domain.Decimal(quantityText), StopPrice: domain.Decimal(takePrice), Leverage: leverage, MarginMode: domain.MarginIsolated, ReduceOnly: true}); err != nil {
		return fmt.Errorf("autonomous TESTNET take-profit preview rejected: %w", err)
	}
	entry, command := build(instance, decisionID, "entry", side, domain.OrderMarket, domain.Decimal(quantityText), "", false, leverage, now, reference)
	if err := e.store.CreateAutonomousOrder(ctx, instance, entry, now); err != nil {
		return err
	}
	placed, _, err := e.execution.Place(ctx, command)
	if err != nil {
		return fmt.Errorf("place autonomous TESTNET entry: %w", err)
	}
	if placed.Status != domain.OrderFilled && placed.Status != domain.OrderPartiallyFilled {
		return errors.New("autonomous TESTNET market entry was not filled")
	}
	e.setPositionOpen(executionKey)
	stopNow := time.Now().UTC()
	stop, stopCommand := build(instance, decisionID, "stop", exitSide, domain.OrderStopMarket, domain.Decimal(quantityText), domain.Decimal(stopPrice), true, leverage, stopNow, reference)
	if err := e.store.CreateAutonomousOrder(ctx, instance, stop, stopNow); err != nil {
		return fmt.Errorf("persist protective stop: %w", err)
	}
	if _, _, err := e.execution.Place(ctx, stopCommand); err != nil {
		closeNow := time.Now().UTC()
		closeOrder, closeCommand := build(instance, decisionID, "emergency", exitSide, domain.OrderMarket, domain.Decimal(quantityText), "", true, leverage, closeNow, reference)
		if persistErr := e.store.CreateAutonomousOrder(ctx, instance, closeOrder, closeNow); persistErr != nil {
			return errors.Join(fmt.Errorf("protective stop submission failed: %w", err), fmt.Errorf("emergency close persistence failed: %w", persistErr))
		}
		if _, _, closeErr := e.execution.Place(ctx, closeCommand); closeErr != nil {
			_ = e.store.MarkAutonomousExecution(ctx, decisionID, true, "protective stop and emergency close failed")
			return errors.Join(fmt.Errorf("protective stop submission failed: %w", err), fmt.Errorf("emergency close failed: %w", closeErr))
		}
		_ = e.store.MarkAutonomousExecution(ctx, decisionID, true, "entry submitted; protective stop failed; emergency close completed")
		return fmt.Errorf("protective stop submission failed; emergency reduce-only close completed: %w", err)
	}
	takeNow := time.Now().UTC()
	take, takeCommand := build(instance, decisionID, "take", exitSide, domain.OrderTakeProfitMarket, domain.Decimal(quantityText), domain.Decimal(takePrice), true, leverage, takeNow, reference)
	if err := e.store.CreateAutonomousOrder(ctx, instance, take, takeNow); err != nil {
		return fmt.Errorf("persist take profit: %w", err)
	}
	if _, _, err := e.execution.Place(ctx, takeCommand); err != nil {
		_ = e.store.MarkAutonomousExecution(ctx, decisionID, true, "entry and stop submitted; take-profit submission failed")
		return fmt.Errorf("take-profit submission failed; reduce-only stop remains active: %w", err)
	}
	if err := e.verifyOpenedPosition(ctx, reference, instance.Symbol, desiredPositionSide, hedgeMode); err != nil {
		return err
	}
	if err := e.store.MarkAutonomousExecution(ctx, decisionID, true, "entry plus reduce-only stop and take-profit submitted to Binance TESTNET"); err != nil {
		return err
	}
	return nil
}

// Binance conditional orders are the primary protection mechanism. This
// read-only comparison is a fail-safe for delayed/missed TESTNET triggers: it
// sends one idempotent reduce-only close only after the configured boundary is
// already crossed, then removes the stale conditional orders.
func (e *Executor) closeReachedProtection(ctx context.Context, instance bot.Instance, decisionID int64, position domain.Position, orders []domain.Order, reference domain.ExchangeAccountRef, now time.Time) (bool, error) {
	stop, take, err := testnetProtectionPrices(instance.Configuration, position)
	if err != nil {
		return false, err
	}
	reason, reached := reachedProtection(position, stop, take)
	if !reached {
		return false, nil
	}
	exitSide := domain.SideBuy
	if position.Side == domain.PositionLong {
		exitSide = domain.SideSell
	}
	leverage := 1
	if parsed, parseErr := strconv.Atoi(string(position.Leverage)); parseErr == nil && parsed > 0 {
		leverage = parsed
	}
	closeOrder, closeCommand := build(instance, decisionID, "exit", exitSide, domain.OrderMarket, position.Quantity, "", true, leverage, now, reference)
	if err := e.store.CreateAutonomousOrder(ctx, instance, closeOrder, now); err != nil {
		return false, fmt.Errorf("persist reached TESTNET protection exit: %w", err)
	}
	placed, _, err := e.execution.Place(ctx, closeCommand)
	if err != nil {
		return false, fmt.Errorf("close reached TESTNET protection: %w", err)
	}
	if placed.Status != domain.OrderFilled && placed.Status != domain.OrderPartiallyFilled {
		return false, errors.New("reached TESTNET protection exit was not filled")
	}
	if err := e.cancelStaleProtectives(ctx, instance, decisionID, orders, reference, now.Add(time.Millisecond)); err != nil {
		return false, fmt.Errorf("position closed at %s but stale protection cleanup failed: %w", reason, err)
	}
	if err := e.store.MarkAutonomousExecution(ctx, decisionID, true, "existing TESTNET position closed because "+reason+" was already reached"); err != nil {
		return false, err
	}
	return true, nil
}

func (e *Executor) lockFor(key string) *sync.Mutex {
	e.locksMu.Lock()
	defer e.locksMu.Unlock()
	if e.locks == nil {
		e.locks = make(map[string]*sync.Mutex)
	}
	if existing := e.locks[key]; existing != nil {
		return existing
	}
	created := &sync.Mutex{}
	e.locks[key] = created
	return created
}

func (e *Executor) observePosition(key string, open bool) bool {
	e.positionMu.Lock()
	defer e.positionMu.Unlock()
	if e.positionWasOpen == nil {
		e.positionWasOpen = make(map[string]bool)
	}
	wasOpen := e.positionWasOpen[key]
	e.positionWasOpen[key] = open
	return wasOpen && !open
}

func (e *Executor) setPositionOpen(key string) {
	e.positionMu.Lock()
	defer e.positionMu.Unlock()
	if e.positionWasOpen == nil {
		e.positionWasOpen = make(map[string]bool)
	}
	e.positionWasOpen[key] = true
}

func (e *Executor) setPositionClosed(key string) {
	e.positionMu.Lock()
	defer e.positionMu.Unlock()
	if e.positionWasOpen == nil {
		e.positionWasOpen = make(map[string]bool)
	}
	e.positionWasOpen[key] = false
}

func (e *Executor) verifyOpenedPosition(ctx context.Context, reference domain.ExchangeAccountRef, symbol string, side domain.PositionSide, hedgeMode bool) error {
	for attempt := 0; attempt < 3; attempt++ {
		positions, err := e.execution.Positions(ctx, reference)
		if err == nil {
			for _, position := range positions {
				if position.Symbol == symbol && decimalSign(string(position.Quantity)) != 0 && (!hedgeMode || position.Side == side || position.Side == "") {
					return nil
				}
			}
		}
		if attempt < 2 {
			timer := time.NewTimer(time.Duration(attempt+1) * 100 * time.Millisecond)
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
	}
	return exchange.NewError(domain.ErrorUnavailable, "ENTRY_POSITION_NOT_CONFIRMED", "", true, true)
}

func executionFailure(cause error) (status, code, detail string) {
	status, code, detail = "REJECTED", "EXECUTION_REJECTED", "unknown TESTNET execution failure"
	if cause == nil {
		return
	}
	detail = cause.Error()
	var normalized *exchange.Error
	if errors.As(cause, &normalized) {
		code = normalized.Normalized.Code
		if code == "INSUFFICIENT_BALANCE" || code == "RISK_MIN_BALANCE_RESERVE" {
			status = "INSUFFICIENT_BALANCE"
		} else if code == "RISK_ORDER_RATE_EXCEEDED" || code == "EXCHANGE_RATE_LIMITED" {
			status = "RETRYING"
		} else if normalized.Normalized.Retryable {
			status = "RETRYING"
		}
		return
	}
	upper := strings.ToUpper(detail)
	if strings.Contains(upper, "BALANCE") || strings.Contains(upper, "MARGIN") || strings.Contains(upper, "ALLOCATION") {
		status, code = "INSUFFICIENT_BALANCE", "INSUFFICIENT_BALANCE"
	} else if strings.Contains(upper, "UNAVAILABLE") || strings.Contains(upper, "TIMEOUT") || strings.Contains(upper, "SYNC_FAILED") {
		status, code = "RETRYING", "TEMPORARY_EXECUTION_ERROR"
	}
	return
}

func metricInt64(metrics map[string]any, key string) int64 {
	if metrics == nil {
		return 0
	}
	switch value := metrics[key].(type) {
	case int64:
		return value
	case int:
		return int64(value)
	case float64:
		return int64(value)
	default:
		return 0
	}
}

func manualLimitClosePending(orders []domain.Order, symbol string) bool {
	for _, order := range orders {
		if order.Symbol == symbol && order.ReduceOnly && order.Type == domain.OrderLimit && strings.HasPrefix(order.ClientOrderID, "kk_") {
			return true
		}
	}
	return false
}

func (e *Executor) pyramidPosition(ctx context.Context, instance bot.Instance, decisionID int64, side domain.OrderSide, quantityText string, leverage int, previous domain.Position, oldOrders []domain.Order, reference domain.ExchangeAccountRef, plan map[string]any, now time.Time) error {
	preview, err := e.execution.Preview(ctx, tradingv1.PreviewOrderRequest{Account: reference, Symbol: instance.Symbol, Side: side, Type: domain.OrderMarket, Quantity: domain.Decimal(quantityText), Leverage: leverage, MarginMode: domain.MarginIsolated})
	if err != nil {
		return fmt.Errorf("autonomous TESTNET pyramid preview rejected: %w", err)
	}
	entry, command := build(instance, decisionID, "entry", side, domain.OrderMarket, domain.Decimal(quantityText), "", false, leverage, now, reference)
	command.PositionConfigurationVerified = true
	if err := e.store.CreateAutonomousOrder(ctx, instance, entry, now); err != nil {
		return err
	}
	placed, _, err := e.execution.Place(ctx, command)
	if err != nil {
		return fmt.Errorf("place autonomous TESTNET pyramid entry: %w", err)
	}
	if placed.Status != domain.OrderFilled && placed.Status != domain.OrderPartiallyFilled {
		return errors.New("autonomous TESTNET pyramid entry was not filled")
	}
	positions, err := e.execution.Positions(ctx, reference)
	if err != nil {
		return e.rollbackPyramidAddition(ctx, instance, decisionID, side, domain.Decimal(quantityText), leverage, reference, fmt.Errorf("refresh TESTNET position after pyramid entry: %w", err))
	}
	var updated *domain.Position
	for index := range positions {
		// In Hedge Mode Binance can return both LONG and SHORT legs for the same
		// symbol. Refresh the leg that this bot just increased; selecting the
		// first symbol match could mistake the opposite leg for the pyramid fill
		// and unnecessarily roll the addition back.
		if positions[index].Symbol == instance.Symbol && positions[index].Side == previous.Side && decimalSign(string(positions[index].Quantity)) != 0 {
			updated = &positions[index]
			break
		}
	}
	if updated == nil || updated.Side != previous.Side {
		return e.rollbackPyramidAddition(ctx, instance, decisionID, side, domain.Decimal(quantityText), leverage, reference, errors.New("TESTNET position could not be verified after pyramid entry"))
	}
	stop, take, err := testnetProtectionPricesWithPlan(instance.Configuration, plan, *updated)
	if err != nil {
		return e.rollbackPyramidAddition(ctx, instance, decisionID, side, domain.Decimal(quantityText), leverage, reference, err)
	}
	if _, reached := reachedProtection(*updated, stop, take); reached {
		return e.ensurePositionProtection(ctx, instance, decisionID, *updated, oldOrders, reference, time.Now().UTC())
	}
	exitSide := domain.SideBuy
	if updated.Side == domain.PositionLong {
		exitSide = domain.SideSell
	}
	stopPrice, err := alignStopPrice(stop, string(preview.Rule.TickSize), exitSide)
	if err != nil {
		return e.rollbackPyramidAddition(ctx, instance, decisionID, side, domain.Decimal(quantityText), leverage, reference, err)
	}
	takePrice, err := alignStopPrice(take, string(preview.Rule.TickSize), exitSide)
	if err != nil {
		return e.rollbackPyramidAddition(ctx, instance, decisionID, side, domain.Decimal(quantityText), leverage, reference, err)
	}
	if _, err := e.execution.Preview(ctx, tradingv1.PreviewOrderRequest{Account: reference, Symbol: instance.Symbol, Side: exitSide, Type: domain.OrderStopMarket, Quantity: updated.Quantity, StopPrice: domain.Decimal(stopPrice), Leverage: leverage, MarginMode: domain.MarginIsolated, ReduceOnly: true}); err != nil {
		return e.rollbackPyramidAddition(ctx, instance, decisionID, side, domain.Decimal(quantityText), leverage, reference, fmt.Errorf("pyramided TESTNET stop preview rejected: %w", err))
	}
	if _, err := e.execution.Preview(ctx, tradingv1.PreviewOrderRequest{Account: reference, Symbol: instance.Symbol, Side: exitSide, Type: domain.OrderTakeProfitMarket, Quantity: updated.Quantity, StopPrice: domain.Decimal(takePrice), Leverage: leverage, MarginMode: domain.MarginIsolated, ReduceOnly: true}); err != nil {
		return e.rollbackPyramidAddition(ctx, instance, decisionID, side, domain.Decimal(quantityText), leverage, reference, fmt.Errorf("pyramided TESTNET take preview rejected: %w", err))
	}
	if err := e.cancelStaleProtectives(ctx, instance, decisionID, oldOrders, reference, time.Now().UTC()); err != nil {
		return e.rollbackPyramidAddition(ctx, instance, decisionID, side, domain.Decimal(quantityText), leverage, reference, err)
	}
	protectNow := time.Now().UTC()
	if err := e.placeProtection(ctx, instance, decisionID, "stop", domain.OrderStopMarket, exitSide, updated.Quantity, domain.Decimal(stopPrice), leverage, reference, protectNow); err != nil {
		closeNow := time.Now().UTC()
		closeOrder, closeCommand := build(instance, decisionID, "emergency", exitSide, domain.OrderMarket, updated.Quantity, "", true, leverage, closeNow, reference)
		if persistErr := e.store.CreateAutonomousOrder(ctx, instance, closeOrder, closeNow); persistErr != nil {
			return errors.Join(fmt.Errorf("pyramid protective stop failed: %w", err), fmt.Errorf("emergency close persistence failed: %w", persistErr))
		}
		if _, _, closeErr := e.execution.Place(ctx, closeCommand); closeErr != nil {
			return errors.Join(fmt.Errorf("pyramid protective stop failed: %w", err), fmt.Errorf("emergency close failed: %w", closeErr))
		}
		return fmt.Errorf("pyramid protective stop failed; full reduce-only emergency close completed: %w", err)
	}
	if err := e.placeProtection(ctx, instance, decisionID, "take", domain.OrderTakeProfitMarket, exitSide, updated.Quantity, domain.Decimal(takePrice), leverage, reference, protectNow.Add(time.Millisecond)); err != nil {
		return fmt.Errorf("pyramid take-profit failed; full-position stop remains active: %w", err)
	}
	return e.store.MarkAutonomousExecution(ctx, decisionID, true, "same-direction TESTNET pyramid fill plus resized full-position protection submitted")
}

func (e *Executor) rollbackPyramidAddition(ctx context.Context, instance bot.Instance, decisionID int64, entrySide domain.OrderSide, quantity domain.Decimal, leverage int, reference domain.ExchangeAccountRef, cause error) error {
	exitSide := domain.SideSell
	if entrySide == domain.SideSell {
		exitSide = domain.SideBuy
	}
	now := time.Now().UTC()
	stored, command := build(instance, decisionID, "rollback", exitSide, domain.OrderMarket, quantity, "", true, leverage, now, reference)
	if err := e.store.CreateAutonomousOrder(ctx, instance, stored, now); err != nil {
		return errors.Join(cause, fmt.Errorf("persist pyramid rollback: %w", err))
	}
	placed, _, err := e.execution.Place(ctx, command)
	if err != nil {
		return errors.Join(cause, fmt.Errorf("pyramid rollback failed: %w", err))
	}
	if placed.Status != domain.OrderFilled && placed.Status != domain.OrderPartiallyFilled {
		return errors.Join(cause, errors.New("pyramid rollback was not filled"))
	}
	_ = e.store.MarkAutonomousExecution(ctx, decisionID, true, "pyramid addition rolled back because full-position protection could not be verified")
	return fmt.Errorf("pyramid addition safely rolled back: %w", cause)
}

func (e *Executor) ensurePositionProtection(ctx context.Context, instance bot.Instance, decisionID int64, position domain.Position, orders []domain.Order, reference domain.ExchangeAccountRef, now time.Time) error {
	stop, take, err := testnetProtectionPrices(instance.Configuration, position)
	if err != nil {
		return err
	}
	hasStop, hasTake := false, false
	relevant, mismatched := 0, false
	prefix := botClientPrefix(instance.ID)
	for _, order := range orders {
		if order.Symbol != instance.Symbol || !strings.HasPrefix(order.ClientOrderID, prefix) {
			continue
		}
		if order.Type != domain.OrderStopMarket && order.Type != domain.OrderTakeProfitMarket {
			continue
		}
		relevant++
		expectedTrigger := stop
		if order.Type == domain.OrderTakeProfitMarket {
			expectedTrigger = take
		}
		orderMatches := decimalEqual(string(order.Quantity), string(position.Quantity)) &&
			(order.StopPrice == "" || protectionTriggerMatches(string(order.StopPrice), expectedTrigger, string(position.EntryPrice)))
		if !orderMatches {
			mismatched = true
		}
		hasStop = hasStop || (order.Type == domain.OrderStopMarket && orderMatches)
		hasTake = hasTake || (order.Type == domain.OrderTakeProfitMarket && orderMatches)
	}
	if hasStop && hasTake && relevant == 2 && !mismatched {
		return nil
	}
	exitSide := domain.SideBuy
	if position.Side == domain.PositionLong {
		exitSide = domain.SideSell
	}
	leverage := 1
	if parsed, parseErr := strconv.Atoi(string(position.Leverage)); parseErr == nil && parsed > 0 {
		leverage = parsed
	}
	if reason, reached := reachedProtection(position, stop, take); reached {
		closeOrder, closeCommand := build(instance, decisionID, "exit", exitSide, domain.OrderMarket, position.Quantity, "", true, leverage, now, reference)
		if err := e.store.CreateAutonomousOrder(ctx, instance, closeOrder, now); err != nil {
			return fmt.Errorf("persist reached TESTNET protection exit: %w", err)
		}
		placed, _, err := e.execution.Place(ctx, closeCommand)
		if err != nil {
			return fmt.Errorf("close reached TESTNET protection: %w", err)
		}
		if placed.Status != domain.OrderFilled && placed.Status != domain.OrderPartiallyFilled {
			return errors.New("reached TESTNET protection exit was not filled")
		}
		if err := e.cancelStaleProtectives(ctx, instance, decisionID, orders, reference, now.Add(time.Millisecond)); err != nil {
			return fmt.Errorf("position closed at %s but stale protection cleanup failed: %w", reason, err)
		}
		return e.store.MarkAutonomousExecution(ctx, decisionID, true, "existing TESTNET position closed because "+reason+" was already reached")
	}
	if mismatched || relevant > 2 {
		if err := e.cancelStaleProtectives(ctx, instance, decisionID, orders, reference, now); err != nil {
			return err
		}
		hasStop, hasTake = false, false
	}
	entryPreview, err := e.execution.Preview(ctx, tradingv1.PreviewOrderRequest{Account: reference, Symbol: instance.Symbol, Side: exitSide, Type: domain.OrderMarket, Quantity: position.Quantity, Leverage: leverage, MarginMode: domain.MarginIsolated, ReduceOnly: true})
	if err != nil {
		return fmt.Errorf("repair protection preview rejected: %w", err)
	}
	if !hasStop {
		price, alignErr := alignStopPrice(stop, string(entryPreview.Rule.TickSize), exitSide)
		if alignErr != nil {
			return alignErr
		}
		if err := e.placeProtection(ctx, instance, decisionID, "stop", domain.OrderStopMarket, exitSide, position.Quantity, domain.Decimal(price), leverage, reference, now); err != nil {
			return err
		}
	}
	if !hasTake {
		price, alignErr := alignStopPrice(take, string(entryPreview.Rule.TickSize), exitSide)
		if alignErr != nil {
			return alignErr
		}
		if err := e.placeProtection(ctx, instance, decisionID, "take", domain.OrderTakeProfitMarket, exitSide, position.Quantity, domain.Decimal(price), leverage, reference, now.Add(time.Millisecond)); err != nil {
			return err
		}
	}
	return e.store.MarkAutonomousExecution(ctx, decisionID, true, "missing TESTNET position protection repaired")
}

func positionProtectionComplete(position domain.Position, orders []domain.Order, prefix string, configuration map[string]any) bool {
	stopPrice, takePrice, err := testnetProtectionPrices(configuration, position)
	if err != nil {
		return false
	}
	stop, take, relevant := 0, 0, 0
	for _, order := range orders {
		if order.Symbol != position.Symbol || !strings.HasPrefix(order.ClientOrderID, prefix) || (order.Type != domain.OrderStopMarket && order.Type != domain.OrderTakeProfitMarket) {
			continue
		}
		relevant++
		if !decimalEqual(string(order.Quantity), string(position.Quantity)) {
			return false
		}
		if order.Type == domain.OrderStopMarket {
			if order.StopPrice != "" && !protectionTriggerMatches(string(order.StopPrice), stopPrice, string(position.EntryPrice)) {
				return false
			}
			stop++
		} else {
			if order.StopPrice != "" && !protectionTriggerMatches(string(order.StopPrice), takePrice, string(position.EntryPrice)) {
				return false
			}
			take++
		}
	}
	return relevant == 2 && stop == 1 && take == 1
}

// One basis point tolerance absorbs exchange tick-size rounding without
// treating an old protection target as current configuration.
func protectionTriggerMatches(actualText, expectedText, entryText string) bool {
	actual, actualOK := new(big.Rat).SetString(actualText)
	expected, expectedOK := new(big.Rat).SetString(expectedText)
	entry, entryOK := new(big.Rat).SetString(entryText)
	if !actualOK || !expectedOK || !entryOK || entry.Sign() <= 0 {
		return false
	}
	difference := new(big.Rat).Sub(actual, expected)
	if difference.Sign() < 0 {
		difference.Neg(difference)
	}
	return new(big.Rat).Mul(difference, big.NewRat(10_000, 1)).Cmp(entry) <= 0
}

func samePositionDirection(position domain.Position, side domain.OrderSide) bool {
	return (position.Side == domain.PositionLong && side == domain.SideBuy) || (position.Side == domain.PositionShort && side == domain.SideSell)
}

func favorableTrendGridStepReached(position domain.Position, markText domain.Decimal, stepBps float64) bool {
	entry, entryOK := new(big.Rat).SetString(string(position.EntryPrice))
	mark, markOK := new(big.Rat).SetString(string(markText))
	step, stepOK := new(big.Rat).SetString(strconv.FormatFloat(stepBps/10_000, 'f', 8, 64))
	if !entryOK || !markOK || !stepOK || entry.Sign() <= 0 || mark.Sign() <= 0 || step.Sign() <= 0 {
		return false
	}
	one := big.NewRat(1, 1)
	if position.Side == domain.PositionLong {
		return mark.Cmp(new(big.Rat).Mul(entry, new(big.Rat).Add(one, step))) >= 0
	}
	if position.Side == domain.PositionShort {
		return mark.Cmp(new(big.Rat).Mul(entry, new(big.Rat).Sub(one, step))) <= 0
	}
	return false
}

func (e *Executor) placeProtection(ctx context.Context, instance bot.Instance, decisionID int64, suffix string, orderType domain.OrderType, side domain.OrderSide, quantity, trigger domain.Decimal, leverage int, reference domain.ExchangeAccountRef, now time.Time) error {
	if _, err := e.execution.Preview(ctx, tradingv1.PreviewOrderRequest{Account: reference, Symbol: instance.Symbol, Side: side, Type: orderType, Quantity: quantity, StopPrice: trigger, Leverage: leverage, MarginMode: domain.MarginIsolated, ReduceOnly: true}); err != nil {
		return err
	}
	stored, command := build(instance, decisionID, suffix, side, orderType, quantity, trigger, true, leverage, now, reference)
	if err := e.store.CreateAutonomousOrder(ctx, instance, stored, now); err != nil {
		return err
	}
	_, _, err := e.execution.Place(ctx, command)
	return err
}

func (e *Executor) cancelStaleProtectives(ctx context.Context, instance bot.Instance, decisionID int64, orders []domain.Order, reference domain.ExchangeAccountRef, now time.Time) error {
	prefix := botClientPrefix(instance.ID)
	index := 0
	for _, order := range orders {
		if order.Symbol != instance.Symbol || !strings.HasPrefix(order.ClientOrderID, prefix) || (order.Type != domain.OrderStopMarket && order.Type != domain.OrderTakeProfitMarket) {
			continue
		}
		index++
		client := fmt.Sprintf("%sc%d", prefix, index)
		if len(client) > 36 {
			client = client[:36]
		}
		meta := tradingv1.CommandMeta{RequestID: fmt.Sprintf("auto-cancel-%d-%d", decisionID, index), ActorUserID: instance.UserID,
			IdempotencyKey: fmt.Sprintf("autonomous_cancel_%s_%d_%d", instance.ID, decisionID, index), ClientOrderID: client, RequestedAt: now}
		if _, _, err := e.execution.Cancel(ctx, tradingv1.CancelOrderCommand{Meta: meta, Account: reference, Symbol: instance.Symbol, ExchangeOrderID: order.ExchangeOrderID}); err != nil {
			return fmt.Errorf("cancel stale TESTNET protection: %w", err)
		}
	}
	return nil
}

func testnetProtectionPrices(configuration map[string]any, position domain.Position) (string, string, error) {
	return testnetProtectionPricesWithPlan(configuration, nil, position)
}

func testnetProtectionPricesWithPlan(configuration, plan map[string]any, position domain.Position) (string, string, error) {
	entry, entryOK := new(big.Rat).SetString(string(position.EntryPrice))
	stopBps, stopOK := numericConfiguration(configuration["stopLossBps"])
	takeBps, takeOK := numericConfiguration(configuration["takeProfitBps"])
	if plan != nil {
		if planned, ok := numericConfiguration(plan["stopLossBps"]); ok {
			stopBps, stopOK = planned, true
		}
		if planned, ok := numericConfiguration(plan["takeProfitBps"]); ok {
			takeBps, takeOK = planned, true
		}
	}
	if !entryOK || !stopOK || !takeOK || entry.Sign() <= 0 || stopBps <= 0 || takeBps <= 0 {
		return "", "", errors.New("TESTNET protection configuration is invalid")
	}
	// The UI expresses take-profit as a net target. Add a conservative
	// round-trip commission/slippage allowance before placing the exchange
	// trigger, so a 1% target is not consumed by entry and exit costs.
	if costBps, ok := numericConfiguration(configuration["estimatedRoundTripCostBps"]); ok && costBps >= 0 && costBps <= 100 {
		takeBps += costBps
	}
	stopRate, _ := new(big.Rat).SetString(strconv.FormatFloat(stopBps/10_000, 'f', 8, 64))
	takeRate, _ := new(big.Rat).SetString(strconv.FormatFloat(takeBps/10_000, 'f', 8, 64))
	one := big.NewRat(1, 1)
	if position.Side == domain.PositionLong {
		return new(big.Rat).Mul(entry, new(big.Rat).Sub(one, stopRate)).FloatString(18), new(big.Rat).Mul(entry, new(big.Rat).Add(one, takeRate)).FloatString(18), nil
	}
	return new(big.Rat).Mul(entry, new(big.Rat).Add(one, stopRate)).FloatString(18), new(big.Rat).Mul(entry, new(big.Rat).Sub(one, takeRate)).FloatString(18), nil
}

func reachedProtection(position domain.Position, stopText, takeText string) (string, bool) {
	mark, markOK := new(big.Rat).SetString(string(position.MarkPrice))
	stop, stopOK := new(big.Rat).SetString(stopText)
	take, takeOK := new(big.Rat).SetString(takeText)
	if !markOK || !stopOK || !takeOK || mark.Sign() <= 0 {
		return "", false
	}
	if position.Side == domain.PositionLong {
		if mark.Cmp(stop) <= 0 {
			return "stop-loss", true
		}
		if mark.Cmp(take) >= 0 {
			return "take-profit", true
		}
		return "", false
	}
	if mark.Cmp(stop) >= 0 {
		return "stop-loss", true
	}
	if mark.Cmp(take) <= 0 {
		return "take-profit", true
	}
	return "", false
}

func numericConfiguration(value any) (float64, bool) {
	switch number := value.(type) {
	case float64:
		return number, true
	case int:
		return float64(number), true
	default:
		return 0, false
	}
}

func addCostBufferToTake(value string, entrySide domain.OrderSide, costBps float64) (string, error) {
	price, priceOK := new(big.Rat).SetString(value)
	if !priceOK || price.Sign() <= 0 || costBps < 0 || costBps > 100 || (entrySide != domain.SideBuy && entrySide != domain.SideSell) {
		return "", errors.New("TESTNET net take-profit cost buffer is invalid")
	}
	rate := bpsRat(costBps)
	one := big.NewRat(1, 1)
	if entrySide == domain.SideBuy {
		return new(big.Rat).Mul(price, new(big.Rat).Add(one, rate)).FloatString(18), nil
	}
	return new(big.Rat).Mul(price, new(big.Rat).Sub(one, rate)).FloatString(18), nil
}

func bpsRat(value float64) *big.Rat {
	parsed, _ := new(big.Rat).SetString(strconv.FormatFloat(value/10_000, 'f', 8, 64))
	return parsed
}

var errAllocationExhausted = errors.New("bot TESTNET allocation is fully deployed")

// alignApprovedQuantity preserves the strategy/risk-engine quantity and only
// rounds it down to exchange precision or caps it to remaining bot allocation.
// It never increases an approved quantity to satisfy an exchange minimum,
// because doing so would silently exceed the fixed-risk trade plan.
func alignApprovedQuantity(approvedText string, maximumNotional float64, rule domain.SymbolRule, markValue domain.Decimal) (string, error) {
	approved, approvedOK := new(big.Rat).SetString(strings.TrimSpace(approvedText))
	mark, markOK := new(big.Rat).SetString(string(markValue))
	step, stepOK := new(big.Rat).SetString(string(rule.StepSize))
	minimum, minimumOK := new(big.Rat).SetString(string(rule.MinQuantity))
	minimumNotional, notionalOK := new(big.Rat).SetString(string(rule.MinNotional))
	maximum, maximumOK := new(big.Rat).SetString(strconv.FormatFloat(maximumNotional, 'f', 8, 64))
	if !approvedOK || !markOK || !stepOK || !minimumOK || !notionalOK || !maximumOK || approved.Sign() <= 0 || mark.Sign() <= 0 || step.Sign() <= 0 || maximum.Sign() <= 0 {
		return "", errors.New("TESTNET approved quantity alignment is invalid")
	}
	maximumQuantity := new(big.Rat).Quo(maximum, mark)
	if approved.Cmp(maximumQuantity) > 0 {
		approved = maximumQuantity
	}
	quantity := floorRatStep(approved, step)
	if quantity.Cmp(minimum) < 0 || new(big.Rat).Mul(quantity, mark).Cmp(minimumNotional) < 0 {
		return "", errAllocationExhausted
	}
	decimals := 0
	if text := string(rule.StepSize); strings.Contains(text, ".") {
		decimals = len(strings.TrimRight(strings.SplitN(text, ".", 2)[1], "0"))
	}
	return quantity.FloatString(decimals), nil
}

func enforceConfiguredMinimumMargin(quantityText string, maximumNotional float64, leverage int, configuration map[string]any, rule domain.SymbolRule, markValue domain.Decimal) (string, error) {
	if configuration["testnetMarginAllocationMode"] != true {
		return quantityText, nil
	}
	minimumMargin, ok := numericConfiguration(configuration["minimumInitialMarginUsdt"])
	if !ok || minimumMargin <= 0 || leverage < 1 {
		return "", errors.New("TESTNET minimum initial margin configuration is invalid")
	}
	quantity, quantityOK := new(big.Rat).SetString(quantityText)
	mark, markOK := new(big.Rat).SetString(string(markValue))
	minimumNotional := minimumMargin * float64(leverage)
	target, targetOK := new(big.Rat).SetString(strconv.FormatFloat(minimumNotional, 'f', 8, 64))
	if !quantityOK || !markOK || !targetOK {
		return "", errors.New("TESTNET minimum initial margin sizing is invalid")
	}
	if new(big.Rat).Mul(quantity, mark).Cmp(target) >= 0 {
		return quantityText, nil
	}
	return allocatedQuantityForNotional(minimumNotional, maximumNotional, rule, markValue)
}

func allocatedQuantity(allocation, positionPct float64, rule domain.SymbolRule, markValue domain.Decimal) (string, error) {
	if allocation <= 0 || positionPct <= 0 || positionPct > 1 {
		return "", errors.New("TESTNET allocation sizing is invalid")
	}
	return allocatedQuantityForNotional(allocation*positionPct, allocation, rule, markValue)
}

func allocatedQuantityForNotional(targetNotional, maximumNotional float64, rule domain.SymbolRule, markValue domain.Decimal) (string, error) {
	if targetNotional <= 0 || maximumNotional <= 0 {
		return "", errAllocationExhausted
	}
	mark, markOK := new(big.Rat).SetString(string(markValue))
	step, stepOK := new(big.Rat).SetString(string(rule.StepSize))
	minimum, minimumOK := new(big.Rat).SetString(string(rule.MinQuantity))
	minimumNotional, notionalOK := new(big.Rat).SetString(string(rule.MinNotional))
	target, _ := new(big.Rat).SetString(strconv.FormatFloat(targetNotional, 'f', 8, 64))
	maximum, _ := new(big.Rat).SetString(strconv.FormatFloat(maximumNotional, 'f', 8, 64))
	if !markOK || !stepOK || !minimumOK || !notionalOK || mark.Sign() <= 0 || step.Sign() <= 0 {
		return "", errors.New("TESTNET market sizing rule is invalid")
	}
	if target.Cmp(minimumNotional) < 0 {
		target.Set(minimumNotional)
	}
	quantity := ceilRatStep(new(big.Rat).Quo(target, mark), step)
	if quantity.Cmp(minimum) < 0 {
		quantity.Set(minimum)
	}
	if new(big.Rat).Mul(quantity, mark).Cmp(maximum) > 0 {
		return "", errAllocationExhausted
	}
	decimals := 0
	if text := string(rule.StepSize); strings.Contains(text, ".") {
		decimals = len(strings.TrimRight(strings.SplitN(text, ".", 2)[1], "0"))
	}
	return quantity.FloatString(decimals), nil
}

func floorRatStep(value, step *big.Rat) *big.Rat {
	ratio := new(big.Rat).Quo(value, step)
	units := new(big.Int).Quo(ratio.Num(), ratio.Denom())
	return new(big.Rat).Mul(new(big.Rat).SetInt(units), step)
}

func remainingAllocation(allocation float64, position domain.Position, markValue domain.Decimal) (float64, error) {
	quantity, quantityOK := new(big.Rat).SetString(string(position.Quantity))
	mark, markOK := new(big.Rat).SetString(string(markValue))
	allocationValue, allocationOK := new(big.Rat).SetString(strconv.FormatFloat(allocation, 'f', 8, 64))
	if !quantityOK || !markOK || !allocationOK || mark.Sign() <= 0 {
		return 0, errors.New("TESTNET position allocation is invalid")
	}
	quantity.Abs(quantity)
	remaining := new(big.Rat).Sub(allocationValue, new(big.Rat).Mul(quantity, mark))
	if remaining.Sign() <= 0 {
		return 0, nil
	}
	value, _ := remaining.Float64()
	return value, nil
}

func decimalSign(value string) int {
	parsed, ok := new(big.Rat).SetString(value)
	if !ok {
		return 0
	}
	return parsed.Sign()
}

func decimalEqual(left, right string) bool {
	l, leftOK := new(big.Rat).SetString(left)
	r, rightOK := new(big.Rat).SetString(right)
	return leftOK && rightOK && l.Cmp(r) == 0
}

func ceilRatStep(value, step *big.Rat) *big.Rat {
	ratio := new(big.Rat).Quo(value, step)
	units := new(big.Int).Quo(ratio.Num(), ratio.Denom())
	if !ratio.IsInt() {
		units.Add(units, big.NewInt(1))
	}
	return new(big.Rat).Mul(new(big.Rat).SetInt(units), step)
}

func alignStopPrice(value, step string, side domain.OrderSide) (string, error) {
	price, priceOK := new(big.Rat).SetString(value)
	tick, tickOK := new(big.Rat).SetString(step)
	if !priceOK || !tickOK || price.Sign() <= 0 || tick.Sign() <= 0 {
		return "", errors.New("invalid stop price or tick size")
	}
	quotient := new(big.Rat).Quo(price, tick)
	units := new(big.Int).Quo(quotient.Num(), quotient.Denom())
	if side == domain.SideBuy && !quotient.IsInt() {
		units.Add(units, big.NewInt(1))
	}
	aligned := new(big.Rat).Mul(new(big.Rat).SetInt(units), tick)
	decimals := 0
	if dot := strings.IndexByte(step, '.'); dot >= 0 {
		decimals = len(strings.TrimRight(step[dot+1:], "0"))
	}
	return aligned.FloatString(decimals), nil
}

func build(instance bot.Instance, decisionID int64, suffix string, side domain.OrderSide, orderType domain.OrderType, quantity, stop domain.Decimal, reduceOnly bool, leverage int, now time.Time, account domain.ExchangeAccountRef) (mysqlstore.AutonomousOrderInput, tradingv1.PlaceOrderCommand) {
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(instance.ID)))[:8]
	sequence := strconv.FormatInt(decisionID, 36)
	code := map[string]string{"entry": "e", "stop": "s", "take": "t", "emergency": "x", "exit": "z"}[suffix]
	if code == "" {
		code = "u"
	}
	client := "ka" + hash + sequence + code
	if len(client) > 36 {
		client = client[:36]
	}
	idempotency := "autonomous_" + hash + "_" + sequence + "_" + suffix
	localID := "auto_" + hash + "_" + sequence + "_" + suffix
	positionSide := domain.PositionSide("")
	if instance.Configuration["hedgeModeEnabled"] == true {
		positionSide = positionSideForOrder(side, reduceOnly)
	}
	input := mysqlstore.AutonomousOrderInput{ID: localID, DecisionID: decisionID, IdempotencyKey: idempotency, ClientOrderID: client, Side: side, PositionSide: positionSide, Type: orderType, Quantity: quantity, StopPrice: stop, ReduceOnly: reduceOnly, Leverage: leverage}
	command := tradingv1.PlaceOrderCommand{Meta: tradingv1.CommandMeta{RequestID: localID, ActorUserID: instance.UserID, IdempotencyKey: idempotency, ClientOrderID: client, RequestedAt: now}, TradingOrderID: localID, Account: account, Symbol: instance.Symbol, Side: side, PositionSide: positionSide, Type: orderType, Quantity: quantity, StopPrice: stop, Leverage: leverage, MarginMode: domain.MarginIsolated, ReduceOnly: reduceOnly}
	return input, command
}

func positionSideForOrder(side domain.OrderSide, reduceOnly bool) domain.PositionSide {
	if (side == domain.SideBuy && !reduceOnly) || (side == domain.SideSell && reduceOnly) {
		return domain.PositionLong
	}
	return domain.PositionShort
}

func botClientPrefix(botID string) string {
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(botID)))[:8]
	return "ka" + hash
}

func hasBotProtection(orders []domain.Order, symbol, prefix string) bool {
	for _, order := range orders {
		if order.Symbol == symbol && strings.HasPrefix(order.ClientOrderID, prefix) &&
			(order.ReduceOnly || order.Type == domain.OrderStopMarket || order.Type == domain.OrderTakeProfitMarket) {
			return true
		}
	}
	return false
}

func hasBotProtectionForSide(orders []domain.Order, symbol, prefix string, side domain.PositionSide) bool {
	for _, order := range orders {
		if order.Symbol == symbol && order.PositionSide == side && strings.HasPrefix(order.ClientOrderID, prefix) &&
			(order.ReduceOnly || order.Type == domain.OrderStopMarket || order.Type == domain.OrderTakeProfitMarket) {
			return true
		}
	}
	return false
}

var _ bot.TestnetExecutor = (*Executor)(nil)
