package autonomousexecution

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	tradingv1 "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/api/v1"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/execution"
	mysqlstore "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/storage/mysql"
)

type Store interface {
	CreateAutonomousOrder(context.Context, bot.Instance, mysqlstore.AutonomousOrderInput, time.Time) error
	MarkAutonomousExecution(context.Context, int64, bool, string) error
	MarkAutonomousExecutionFailure(context.Context, int64, string) error
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
	store     Store
	execution ExecutionService
}

func New(store Store, service *execution.Service) *Executor {
	return &Executor{store: store, execution: service}
}

// RecordFailure persists a scheduler-visible execution outcome. Without this,
// a rejected TESTNET submission only existed in process logs and the UI looked
// like the decision silently stopped before execution.
func (e *Executor) RecordFailure(ctx context.Context, decisionID int64, cause error) error {
	detail := "unknown TESTNET execution failure"
	if cause != nil {
		detail = cause.Error()
	}
	return e.store.MarkAutonomousExecutionFailure(ctx, decisionID, detail)
}

func (e *Executor) Execute(ctx context.Context, instance bot.Instance, decision bot.Decision, decisionID int64, now time.Time) error {
	if instance.Type != "AUTONOMOUS" || instance.Mode != "DEMO" || e.execution == nil {
		return errors.New("autonomous TESTNET executor is disabled")
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
		if positions[index].Symbol == instance.Symbol && decimalSign(string(positions[index].Quantity)) != 0 {
			current = &positions[index]
			break
		}
	}
	if current != nil {
		if !positionProtectionComplete(*current, openOrders, botClientPrefix(instance.ID)) {
			return e.ensurePositionProtection(ctx, instance, decisionID, *current, openOrders, reference, now)
		}
		if instance.Configuration["pyramidingEnabled"] != true || !samePositionDirection(*current, side) {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "existing TESTNET position is already protected; no additional entry allowed")
		}
		if !allocationOK || allocation <= 0 {
			return e.store.MarkAutonomousExecution(ctx, decisionID, false, "existing TESTNET position is already protected; pyramiding allocation is unavailable")
		}
		remaining, remainingErr := remainingAllocation(allocation, *current, sizingMark)
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
		// Binance does not permit changing leverage while an isolated position is
		// open. Preserve the exchange position's leverage for same-side additions;
		// the configured 5-20x leverage remains applicable to fresh positions.
		positionLeverage, parseErr := strconv.Atoi(string(current.Leverage))
		if parseErr != nil || positionLeverage < 1 {
			return errors.New("open TESTNET position leverage could not be verified")
		}
		return e.pyramidPosition(ctx, instance, decisionID, side, quantityText, positionLeverage, *current, openOrders, reference, order, now)
	}
	if allocationOK && allocation > 0 {
		quantityText, err = alignApprovedQuantity(quantityText, allocation, sizingRule, sizingMark)
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
	if err := e.store.MarkAutonomousExecution(ctx, decisionID, true, "entry plus reduce-only stop and take-profit submitted to Binance TESTNET"); err != nil {
		return err
	}
	return nil
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
		if positions[index].Symbol == instance.Symbol && decimalSign(string(positions[index].Quantity)) != 0 {
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
		if !decimalEqual(string(order.Quantity), string(position.Quantity)) {
			mismatched = true
		}
		hasStop = hasStop || (order.Type == domain.OrderStopMarket && !mismatched)
		hasTake = hasTake || (order.Type == domain.OrderTakeProfitMarket && !mismatched)
	}
	if hasStop && hasTake && relevant == 2 && !mismatched {
		return nil
	}
	stop, take, err := testnetProtectionPrices(instance.Configuration, position)
	if err != nil {
		return err
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

func positionProtectionComplete(position domain.Position, orders []domain.Order, prefix string) bool {
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
			stop++
		} else {
			take++
		}
	}
	return relevant == 2 && stop == 1 && take == 1
}

func samePositionDirection(position domain.Position, side domain.OrderSide) bool {
	return (position.Side == domain.PositionLong && side == domain.SideBuy) || (position.Side == domain.PositionShort && side == domain.SideSell)
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
	input := mysqlstore.AutonomousOrderInput{ID: localID, IdempotencyKey: idempotency, ClientOrderID: client, Side: side, Type: orderType, Quantity: quantity, StopPrice: stop, ReduceOnly: reduceOnly, Leverage: leverage}
	command := tradingv1.PlaceOrderCommand{Meta: tradingv1.CommandMeta{RequestID: localID, ActorUserID: instance.UserID, IdempotencyKey: idempotency, ClientOrderID: client, RequestedAt: now}, TradingOrderID: localID, Account: account, Symbol: instance.Symbol, Side: side, Type: orderType, Quantity: quantity, StopPrice: stop, Leverage: leverage, MarginMode: domain.MarginIsolated, ReduceOnly: reduceOnly}
	return input, command
}

func botClientPrefix(botID string) string {
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(botID)))[:8]
	return "ka" + hash
}

var _ bot.TestnetExecutor = (*Executor)(nil)
