package bot

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHTTPObserverProducesComparisonOnlyObservation(t *testing.T) {
	t.Parallel()
	fixedNow := time.Date(2026, 8, 2, 18, 0, 0, 0, time.UTC)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer 0123456789abcdef0123456789abcdef" {
			t.Error("observer token was not sent")
		}
		var payload observerRequest
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.Constraints.ExecutionAllowed || payload.Constraints.SubmittedToExchange || !payload.Constraints.ComparisonOnly {
			t.Fatalf("unsafe observer constraints: %#v", payload.Constraints)
		}
		_ = json.NewEncoder(response).Encode(observerResponse{Action: "BUY", Confidence: 0.82, Rationale: "Momentum gözlemi BUY yönünü destekliyor.", ExpiresInSeconds: 90})
	}))
	defer server.Close()
	observer, err := NewHTTPObserver(HTTPObserverOptions{Endpoint: server.URL, Token: "0123456789abcdef0123456789abcdef", Provider: "TEST", Model: "observer-test", PromptVersion: "v1", Client: server.Client(), Now: func() time.Time { return fixedNow }})
	if err != nil {
		t.Fatal(err)
	}
	result, err := observer.Observe(t.Context(), Instance{ID: "bot-1", Type: "SCALPING", Mode: "SHADOW", Symbol: "BTCUSDT"}, Decision{Kind: "BUY", MarkPrice: "70000", Summary: "rule"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Action != "BUY" || result.Confidence != 0.82 || !result.ExpiresAt.Equal(fixedNow.Add(90*time.Second)) {
		t.Fatalf("unexpected observation: %#v", result)
	}
}

func TestHTTPObserverRejectsUnsafeOutput(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(response).Encode(observerResponse{Action: "PLACE_ORDER", Confidence: 1, Rationale: "Emir gönder."})
	}))
	defer server.Close()
	observer, err := NewHTTPObserver(HTTPObserverOptions{Endpoint: server.URL, Token: "0123456789abcdef0123456789abcdef", Provider: "TEST", Model: "observer-test", PromptVersion: "v1", Client: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := observer.Observe(t.Context(), Instance{}, Decision{}); err == nil {
		t.Fatal("unsafe observer action must be rejected")
	}
}
