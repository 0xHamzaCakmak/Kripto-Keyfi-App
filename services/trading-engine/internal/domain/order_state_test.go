package domain

import "testing"

func TestOrderStateMachineAllowsExpectedLifecycle(t *testing.T) {
	lifecycle := []OrderStatus{OrderPending, OrderSubmitting, OrderOpen, OrderPartiallyFilled, OrderCanceling, OrderCanceled}
	for index := 0; index < len(lifecycle)-1; index++ {
		if err := ValidateOrderTransition(lifecycle[index], lifecycle[index+1]); err != nil {
			t.Fatalf("expected transition to be valid: %v", err)
		}
	}
}

func TestOrderStateMachineRejectsTerminalTransition(t *testing.T) {
	if CanTransitionOrder(OrderFilled, OrderOpen) {
		t.Fatal("filled orders must be terminal")
	}
	if !IsTerminalOrderStatus(OrderFilled) || !IsTerminalOrderStatus(OrderCanceled) || !IsTerminalOrderStatus(OrderFailed) {
		t.Fatal("terminal status classification is incomplete")
	}
}

func TestReconciliationCanResolveToExchangeTruth(t *testing.T) {
	for _, status := range []OrderStatus{OrderOpen, OrderPartiallyFilled, OrderFilled, OrderCanceled, OrderFailed} {
		if !CanTransitionOrder(OrderReconciliationRequired, status) {
			t.Fatalf("reconciliation must resolve to %s", status)
		}
	}
}
