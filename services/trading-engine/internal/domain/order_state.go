package domain

import "fmt"

type OrderStatus string

const (
	OrderPending                OrderStatus = "PENDING"
	OrderSubmitting             OrderStatus = "SUBMITTING"
	OrderOpen                   OrderStatus = "OPEN"
	OrderPartiallyFilled        OrderStatus = "PARTIALLY_FILLED"
	OrderFilled                 OrderStatus = "FILLED"
	OrderCanceling              OrderStatus = "CANCELING"
	OrderCanceled               OrderStatus = "CANCELED"
	OrderClosing                OrderStatus = "CLOSING"
	OrderFailed                 OrderStatus = "FAILED"
	OrderReconciliationRequired OrderStatus = "RECONCILIATION_REQUIRED"
)

var orderTransitions = map[OrderStatus]map[OrderStatus]struct{}{
	OrderPending: allowed(OrderSubmitting, OrderFailed),
	OrderSubmitting: allowed(
		OrderOpen, OrderPartiallyFilled, OrderFilled, OrderFailed, OrderReconciliationRequired,
	),
	OrderOpen: allowed(
		OrderPartiallyFilled, OrderFilled, OrderCanceling, OrderCanceled, OrderClosing, OrderReconciliationRequired,
	),
	OrderPartiallyFilled: allowed(
		OrderFilled, OrderCanceling, OrderCanceled, OrderClosing, OrderReconciliationRequired,
	),
	OrderCanceling: allowed(
		OrderOpen, OrderPartiallyFilled, OrderFilled, OrderCanceled, OrderReconciliationRequired,
	),
	OrderClosing: allowed(
		OrderOpen, OrderPartiallyFilled, OrderFilled, OrderReconciliationRequired,
	),
	OrderReconciliationRequired: allowed(
		OrderOpen, OrderPartiallyFilled, OrderFilled, OrderCanceled, OrderFailed,
	),
}

func allowed(statuses ...OrderStatus) map[OrderStatus]struct{} {
	result := make(map[OrderStatus]struct{}, len(statuses))
	for _, status := range statuses {
		result[status] = struct{}{}
	}
	return result
}

func CanTransitionOrder(from, to OrderStatus) bool {
	_, ok := orderTransitions[from][to]
	return ok
}

func ValidateOrderTransition(from, to OrderStatus) error {
	if !CanTransitionOrder(from, to) {
		return fmt.Errorf("invalid order status transition: %s -> %s", from, to)
	}
	return nil
}

func IsTerminalOrderStatus(status OrderStatus) bool {
	switch status {
	case OrderFilled, OrderCanceled, OrderFailed:
		return true
	default:
		return false
	}
}
