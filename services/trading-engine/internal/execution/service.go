package execution

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	tradingv1 "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/api/v1"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/binance"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/bybit"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/risk"
)

type WriterFactory func(account.Resolved) (exchange.Writer, error)

type Service struct {
	accounts account.Store
	orders   OrderStore
	factory  WriterFactory
	risk     risk.Evaluator
	now      func() time.Time
}

func New(accounts account.Store, orders OrderStore, riskStore risk.Store, client *http.Client, endpoints exchange.Endpoints) *Service {
	return &Service{accounts: accounts, orders: orders, risk: risk.New(riskStore), now: time.Now, factory: func(resolved account.Resolved) (exchange.Writer, error) {
		switch resolved.Reference.Provider {
		case domain.ProviderBinance:
			return binance.New(binance.Options{Credentials: resolved.Credentials, Client: client, FuturesURL: endpoints.BinanceFutures, SpotURL: endpoints.BinanceSpot}), nil
		case domain.ProviderBybit:
			return bybit.New(bybit.Options{Credentials: resolved.Credentials, Client: client, BaseURL: endpoints.Bybit}), nil
		default:
			return nil, fmt.Errorf("unsupported exchange provider %q", resolved.Reference.Provider)
		}
	}}
}

func NewWithFactory(accounts account.Store, orders OrderStore, evaluator risk.Evaluator, factory WriterFactory, now func() time.Time) *Service {
	return &Service{accounts: accounts, orders: orders, risk: evaluator, factory: factory, now: now}
}

func (s *Service) Preview(ctx context.Context, request tradingv1.PreviewOrderRequest) (tradingv1.PreviewOrderResponse, error) {
	resolved, writer, err := s.resolveWriter(ctx, request.Account)
	if err != nil {
		return tradingv1.PreviewOrderResponse{}, err
	}
	rules, err := writer.GetSymbols(ctx)
	if err != nil {
		return tradingv1.PreviewOrderResponse{}, err
	}
	var rule *domain.SymbolRule
	for index := range rules {
		if rules[index].Symbol == request.Symbol {
			rule = &rules[index]
			break
		}
	}
	if rule == nil {
		return tradingv1.PreviewOrderResponse{}, validationError("TRADING_SYMBOL_NOT_FOUND")
	}
	if request.Leverage < 1 || request.Leverage > rule.MaxLeverage {
		return tradingv1.PreviewOrderResponse{}, validationError("LEVERAGE_LIMIT_EXCEEDED")
	}
	if !positive(string(request.Quantity)) || compare(string(request.Quantity), string(rule.MinQuantity)) < 0 || compare(string(request.Quantity), string(rule.MaxQuantity)) > 0 {
		return tradingv1.PreviewOrderResponse{}, validationError("QUANTITY_OUT_OF_RANGE")
	}
	if !stepAligned(string(request.Quantity), string(rule.StepSize)) {
		return tradingv1.PreviewOrderResponse{}, validationError("QUANTITY_STEP_MISMATCH")
	}
	if (request.Type == domain.OrderLimit || request.Type == domain.OrderStopLimit) && (!positive(string(request.Price)) || !stepAligned(string(request.Price), string(rule.TickSize))) {
		return tradingv1.PreviewOrderResponse{}, validationError("PRICE_TICK_MISMATCH")
	}
	if (request.Type == domain.OrderStopMarket || request.Type == domain.OrderStopLimit) && (!positive(string(request.StopPrice)) || !stepAligned(string(request.StopPrice), string(rule.TickSize))) {
		return tradingv1.PreviewOrderResponse{}, validationError("STOP_PRICE_TICK_MISMATCH")
	}
	markPrice, err := writer.GetMarkPrice(ctx, request.Symbol)
	if err != nil {
		return tradingv1.PreviewOrderResponse{}, err
	}
	notionalPrice := markPrice
	if request.Price != "" {
		notionalPrice = request.Price
	}
	notional := multiply(string(request.Quantity), string(notionalPrice), 18)
	if compare(notional, string(rule.MinNotional)) < 0 {
		return tradingv1.PreviewOrderResponse{}, validationError("MIN_NOTIONAL_NOT_MET")
	}
	request.Account = resolved.Reference
	return tradingv1.PreviewOrderResponse{
		Meta: tradingv1.NewMeta("preview", s.now()), Request: request, Rule: *rule,
		MarkPrice: markPrice, EstimatedNotional: domain.Decimal(notional),
	}, nil
}

func (s *Service) Place(ctx context.Context, command tradingv1.PlaceOrderCommand) (domain.Order, bool, error) {
	if err := command.Meta.Validate(); err != nil || strings.TrimSpace(command.TradingOrderID) == "" {
		return domain.Order{}, false, validationError("INVALID_COMMAND")
	}
	if command.Account.UserID != command.Meta.ActorUserID {
		return domain.Order{}, false, validationError("ACCOUNT_ACTOR_MISMATCH")
	}
	resolved, writer, err := s.resolveWriter(ctx, command.Account)
	if err != nil {
		return domain.Order{}, false, err
	}
	stored, claim, err := s.orders.Claim(ctx, command.Meta.ActorUserID, command.Account.ID, command.TradingOrderID, command.Meta.IdempotencyKey, command.Meta.ClientOrderID, s.now())
	if err != nil {
		return domain.Order{}, false, err
	}
	if claim == ClaimCompletedReplay {
		return storedDomainOrder(stored), true, nil
	}
	if claim == ClaimReconciliationRequired {
		return domain.Order{}, true, exchange.NewError(domain.ErrorRejected, "RECONCILIATION_REQUIRED", "", false, true)
	}
	if !commandMatchesStored(command, stored) {
		failure := domain.ExchangeError{Category: domain.ErrorValidation, Code: "COMMAND_ORDER_MISMATCH", Message: "Stored order and execution command do not match."}
		_ = s.orders.Fail(ctx, stored, failure, s.now())
		return domain.Order{}, false, &exchange.Error{Normalized: failure}
	}
	decision, riskErr := s.risk.Evaluate(ctx, resolved, risk.OrderInput{
		ID: stored.ID, UserID: stored.UserID, ExchangeAccountID: stored.ExchangeAccountID,
		Symbol: stored.Symbol, Source: stored.Source, Quantity: stored.Quantity, Price: stored.Price,
		Leverage: stored.Leverage, ReduceOnly: stored.ReduceOnly,
	}, writer)
	if riskErr != nil {
		failure := domain.ExchangeError{Category: domain.ErrorUnavailable, Code: "RISK_ENGINE_UNAVAILABLE", Message: "Risk engine could not verify the order."}
		_ = s.orders.Fail(ctx, stored, failure, s.now())
		return domain.Order{}, false, &exchange.Error{Normalized: failure}
	}
	if decision.Status != "APPROVED" {
		failure := domain.ExchangeError{Category: domain.ErrorRejected, Code: decision.Code, Message: decision.Message}
		_ = s.orders.Fail(ctx, stored, failure, s.now())
		return domain.Order{}, false, &exchange.Error{Normalized: failure}
	}
	if !stored.ReduceOnly {
		if err := writer.ConfigurePosition(ctx, stored.Symbol, stored.Leverage, stored.MarginMode); err != nil {
			failure := normalizeFailure(err, false)
			_ = s.orders.Fail(ctx, stored, failure, s.now())
			return domain.Order{}, false, err
		}
	}
	result, err := writer.PlaceOrder(ctx, exchange.PlaceOrderInput{
		Symbol: stored.Symbol, Side: stored.Side, Type: stored.Type, Quantity: stored.Quantity,
		Price: stored.Price, StopPrice: stored.StopPrice, ReduceOnly: stored.ReduceOnly, ClientOrderID: stored.ClientOrderID,
	})
	if err != nil {
		failure := normalizeFailure(err, true)
		if persistErr := s.orders.Fail(ctx, stored, failure, s.now()); persistErr != nil {
			return domain.Order{}, false, errors.Join(err, persistErr)
		}
		return domain.Order{}, false, err
	}
	if err := s.orders.Complete(ctx, stored, result, s.now()); err != nil {
		return domain.Order{}, false, err
	}
	return result, false, nil
}

func (s *Service) Cancel(ctx context.Context, command tradingv1.CancelOrderCommand) (domain.Order, bool, error) {
	if err := command.Meta.Validate(); err != nil || command.Account.UserID != command.Meta.ActorUserID || command.ExchangeOrderID == "" || command.Symbol == "" {
		return domain.Order{}, false, validationError("INVALID_CANCEL_COMMAND")
	}
	_, writer, err := s.resolveWriter(ctx, command.Account)
	if err != nil {
		return domain.Order{}, false, err
	}
	stored, claim, err := s.orders.ClaimCancel(ctx, command.Meta.ActorUserID, command.Account.ID, command.ExchangeOrderID, command.Meta.IdempotencyKey, command.Meta.ClientOrderID, s.now())
	if err != nil {
		return domain.Order{}, false, err
	}
	if stored.Symbol != command.Symbol {
		return domain.Order{}, false, validationError("CANCEL_ORDER_MISMATCH")
	}
	if claim == ClaimCompletedReplay {
		result := storedDomainOrder(stored)
		result.Status = domain.OrderCanceled
		return result, true, nil
	}
	if claim == ClaimReconciliationRequired {
		return domain.Order{}, true, exchange.NewError(domain.ErrorRejected, "RECONCILIATION_REQUIRED", "", false, true)
	}
	result, err := writer.CancelOrder(ctx, stored.Symbol, stored.ExchangeOrderID)
	if err != nil {
		failure := normalizeFailure(err, true)
		if persistErr := s.orders.FailCancel(ctx, stored, failure, s.now()); persistErr != nil {
			return domain.Order{}, false, errors.Join(err, persistErr)
		}
		return domain.Order{}, false, err
	}
	if err := s.orders.CompleteCancel(ctx, stored, s.now()); err != nil {
		return domain.Order{}, false, err
	}
	return result, false, nil
}

func (s *Service) resolveWriter(ctx context.Context, reference domain.ExchangeAccountRef) (account.Resolved, exchange.Writer, error) {
	resolved, err := s.accounts.Resolve(ctx, reference.UserID, reference.ID)
	if err != nil {
		return account.Resolved{}, nil, err
	}
	if resolved.Engine != "GO" {
		return account.Resolved{}, nil, errors.New("exchange account is not owned by Go executor")
	}
	writer, err := s.factory(resolved)
	return resolved, writer, err
}

func commandMatchesStored(command tradingv1.PlaceOrderCommand, stored StoredOrder) bool {
	return command.Symbol == stored.Symbol && command.Side == stored.Side && command.Type == stored.Type &&
		decimalEqual(command.Quantity, stored.Quantity) && decimalEqual(command.Price, stored.Price) && decimalEqual(command.StopPrice, stored.StopPrice) &&
		command.Leverage == stored.Leverage && command.MarginMode == stored.MarginMode && command.ReduceOnly == stored.ReduceOnly
}

func decimalEqual(left, right domain.Decimal) bool {
	if left == "" || right == "" {
		return left == right
	}
	leftValue, leftOK := new(big.Rat).SetString(string(left))
	rightValue, rightOK := new(big.Rat).SetString(string(right))
	return leftOK && rightOK && leftValue.Cmp(rightValue) == 0
}

func storedDomainOrder(stored StoredOrder) domain.Order {
	return domain.Order{ID: stored.ID, ExchangeAccountID: stored.ExchangeAccountID, ExchangeOrderID: stored.ExchangeOrderID,
		ClientOrderID: stored.ClientOrderID, IdempotencyKey: stored.IdempotencyKey, Symbol: stored.Symbol,
		Side: stored.Side, Type: stored.Type, Status: stored.Status, Quantity: stored.Quantity,
		Price: stored.Price, StopPrice: stored.StopPrice, Leverage: stored.Leverage, MarginMode: stored.MarginMode, ReduceOnly: stored.ReduceOnly}
}

func validationError(code string) error {
	return exchange.NewError(domain.ErrorValidation, code, "", false, false)
}

func normalizeFailure(err error, afterWrite bool) domain.ExchangeError {
	var exchangeError *exchange.Error
	if errors.As(err, &exchangeError) {
		failure := exchangeError.Normalized
		if afterWrite && (failure.Category == domain.ErrorTimeout || failure.Category == domain.ErrorUnavailable || failure.Code == "INVALID_EXCHANGE_RESPONSE") {
			failure.Reconciliation = true
		}
		return failure
	}
	return domain.ExchangeError{Category: domain.ErrorInternal, Code: "INTERNAL_EXECUTION_ERROR", Message: "Trading execution failed.", Reconciliation: afterWrite}
}

func positive(value string) bool {
	rational, ok := new(big.Rat).SetString(value)
	return ok && rational.Sign() > 0
}

func compare(left, right string) int {
	leftValue, leftOK := new(big.Rat).SetString(left)
	rightValue, rightOK := new(big.Rat).SetString(right)
	if !leftOK || !rightOK {
		return 0
	}
	return leftValue.Cmp(rightValue)
}

func stepAligned(value, step string) bool {
	valueRat, valueOK := new(big.Rat).SetString(value)
	stepRat, stepOK := new(big.Rat).SetString(step)
	if !valueOK || !stepOK || stepRat.Sign() <= 0 {
		return false
	}
	quotient := new(big.Rat).Quo(valueRat, stepRat)
	return quotient.IsInt()
}

func multiply(left, right string, scale int) string {
	leftValue, leftOK := new(big.Rat).SetString(left)
	rightValue, rightOK := new(big.Rat).SetString(right)
	if !leftOK || !rightOK {
		return "0"
	}
	value := new(big.Rat).Mul(leftValue, rightValue).FloatString(scale)
	return strings.TrimRight(strings.TrimRight(value, "0"), ".")
}
