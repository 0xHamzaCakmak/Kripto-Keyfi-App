package exchange

import (
	"errors"
	"net/http"
	"testing"
)

func TestBinanceOrderNotVisibleIsRetryableForReconciliation(t *testing.T) {
	err := classifyHTTPError(http.StatusBadRequest, "-2013")
	var normalized *Error
	if !errors.As(err, &normalized) || normalized.Normalized.Code != "EXCHANGE_ORDER_NOT_VISIBLE" || !normalized.Normalized.Retryable || !normalized.Normalized.Reconciliation {
		t.Fatalf("unexpected eventual-consistency classification: %#v", err)
	}
}

func TestBinanceInsufficientMarginHasExplicitReasonCode(t *testing.T) {
	err := classifyHTTPError(http.StatusBadRequest, "-2019")
	var normalized *Error
	if !errors.As(err, &normalized) || normalized.Normalized.Code != "INSUFFICIENT_BALANCE" || normalized.Normalized.Retryable {
		t.Fatalf("unexpected insufficient-margin classification: %#v", err)
	}
}
