package exchange

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

const maximumResponseBytes = 8 << 20

func GetJSON(ctx context.Context, client *http.Client, requestURL string, headers map[string]string, target any) (int, error) {
	return RequestJSON(ctx, client, http.MethodGet, requestURL, headers, nil, target, nil)
}

func RequestJSON(ctx context.Context, client *http.Client, method, requestURL string, headers map[string]string, requestBody []byte, target any, acceptedCodes map[string]struct{}) (int, error) {
	request, err := http.NewRequestWithContext(ctx, method, requestURL, bytes.NewReader(requestBody))
	if err != nil {
		return 0, fmt.Errorf("build exchange request: %w", err)
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response, err := client.Do(request)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return 0, NewError(domain.ErrorTimeout, "EXCHANGE_TIMEOUT", "", true, false)
		}
		return 0, NewError(domain.ErrorUnavailable, "EXCHANGE_UNAVAILABLE", "", true, false)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, maximumResponseBytes))
	if err != nil {
		return response.StatusCode, NewError(domain.ErrorUnavailable, "EXCHANGE_UNAVAILABLE", "", true, false)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		var envelope struct {
			Code    any `json:"code"`
			RetCode any `json:"retCode"`
		}
		_ = json.Unmarshal(body, &envelope)
		exchangeCode := firstCode(envelope.Code, envelope.RetCode)
		if _, accepted := acceptedCodes[exchangeCode]; !accepted {
			return response.StatusCode, classifyHTTPError(response.StatusCode, exchangeCode)
		}
	}
	if target == nil || len(body) == 0 {
		return response.StatusCode, nil
	}
	if err := json.Unmarshal(body, target); err != nil {
		return response.StatusCode, NewError(domain.ErrorInternal, "INVALID_EXCHANGE_RESPONSE", "", false, false)
	}
	return response.StatusCode, nil
}

func classifyHTTPError(status int, exchangeCode string) error {
	if status == http.StatusUnauthorized || status == http.StatusForbidden || exchangeCode == "-2015" || exchangeCode == "10003" {
		return NewError(domain.ErrorPermission, "EXCHANGE_PERMISSION_DENIED", exchangeCode, false, false)
	}
	if status == http.StatusTooManyRequests || exchangeCode == "10006" {
		return NewError(domain.ErrorRateLimit, "EXCHANGE_RATE_LIMITED", exchangeCode, true, false)
	}
	return NewError(domain.ErrorRejected, "EXCHANGE_REJECTED", exchangeCode, false, false)
}

func firstCode(values ...any) string {
	for _, value := range values {
		switch typed := value.(type) {
		case string:
			if typed != "" {
				return typed
			}
		case float64:
			return fmt.Sprintf("%.0f", typed)
		}
	}
	return ""
}
