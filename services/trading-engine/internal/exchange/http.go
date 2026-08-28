package exchange

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

const maximumResponseBytes = 8 << 20

var exchangeCooldowns = struct {
	sync.Mutex
	until map[string]time.Time
}{until: make(map[string]time.Time)}

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
	if err := waitForExchangeCooldown(ctx, request.URL.Host); err != nil {
		return 0, NewError(domain.ErrorTimeout, "EXCHANGE_RATE_LIMIT_BACKOFF_CANCELED", "", true, false)
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
		if response.StatusCode == http.StatusTooManyRequests || response.StatusCode == http.StatusTeapot || exchangeCode == "-1003" || exchangeCode == "10006" {
			recordExchangeCooldown(request.URL.Host, response.Header.Get("Retry-After"), time.Now())
		}
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

func waitForExchangeCooldown(ctx context.Context, host string) error {
	for {
		exchangeCooldowns.Lock()
		until := exchangeCooldowns.until[host]
		exchangeCooldowns.Unlock()
		delay := time.Until(until)
		if delay <= 0 {
			return nil
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}
}

func recordExchangeCooldown(host, retryAfter string, now time.Time) {
	delay := 5 * time.Second
	if seconds, err := strconv.Atoi(retryAfter); err == nil && seconds > 0 {
		delay = time.Duration(seconds) * time.Second
	} else if parsed, err := http.ParseTime(retryAfter); err == nil && parsed.After(now) {
		delay = parsed.Sub(now)
	}
	if delay > time.Minute {
		delay = time.Minute
	}
	exchangeCooldowns.Lock()
	defer exchangeCooldowns.Unlock()
	until := now.Add(delay)
	if until.After(exchangeCooldowns.until[host]) {
		exchangeCooldowns.until[host] = until
	}
}

func classifyHTTPError(status int, exchangeCode string) error {
	if status == http.StatusUnauthorized || status == http.StatusForbidden || exchangeCode == "-2015" || exchangeCode == "10003" {
		return NewError(domain.ErrorPermission, "EXCHANGE_PERMISSION_DENIED", exchangeCode, false, false)
	}
	if status == http.StatusTooManyRequests || status == http.StatusTeapot || exchangeCode == "-1003" || exchangeCode == "10006" {
		return NewError(domain.ErrorRateLimit, "EXCHANGE_RATE_LIMITED", exchangeCode, true, false)
	}
	// Binance Demo can briefly return -2013 immediately after accepting a
	// market order. Reconciliation reads may retry this eventual-consistency
	// response; execution idempotency still prevents resubmission.
	if exchangeCode == "-2013" {
		return NewError(domain.ErrorUnavailable, "EXCHANGE_ORDER_NOT_VISIBLE", exchangeCode, true, true)
	}
	if exchangeCode == "-2019" || exchangeCode == "110007" {
		return NewError(domain.ErrorRejected, "INSUFFICIENT_BALANCE", exchangeCode, false, false)
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
