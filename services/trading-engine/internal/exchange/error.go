package exchange

import (
	"fmt"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type Error struct {
	Normalized domain.ExchangeError
}

func (e *Error) Error() string {
	return fmt.Sprintf("exchange request failed: %s", e.Normalized.Code)
}

func NewError(category domain.ErrorCategory, code, exchangeCode string, retryable, reconciliation bool) *Error {
	return &Error{Normalized: domain.ExchangeError{
		Category: category, Code: code, Message: safeMessage(code), ExchangeCode: exchangeCode,
		Retryable: retryable, Reconciliation: reconciliation,
	}}
}

func safeMessage(code string) string {
	switch code {
	case "EXCHANGE_PERMISSION_DENIED":
		return "API credentials or exchange permissions could not be verified."
	case "EXCHANGE_RATE_LIMITED":
		return "The exchange request limit was reached."
	case "INVALID_EXCHANGE_RESPONSE":
		return "The exchange returned an invalid response."
	case "EXCHANGE_UNAVAILABLE":
		return "A secure connection to the exchange could not be established."
	case "RISK_ENGINE_UNAVAILABLE":
		return "The order could not be verified by the risk engine."
	default:
		return "The exchange rejected the request."
	}
}
