package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/execution"
)

const testToken = "0123456789abcdef0123456789abcdef"

func newTestServer() *Server {
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	server := New(Options{Addr: ":0", Logger: logger, Mode: "shadow", Token: testToken})
	server.SetReady(true)
	return server
}

func TestHealthEndpoints(t *testing.T) {
	server := newTestServer()
	for _, path := range []string{"/health/live", "/health/ready"} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("%s returned %d", path, response.Code)
		}
	}
}

func TestInternalStatusRequiresToken(t *testing.T) {
	server := newTestServer()
	request := httptest.NewRequest(http.MethodGet, "/internal/v1/status", nil)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.Code)
	}
}

func TestInternalStatusStaysInShadowMode(t *testing.T) {
	server := newTestServer()
	request := httptest.NewRequest(http.MethodGet, "/internal/v1/status", nil)
	request.Header.Set("Authorization", "Bearer "+testToken)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"executor":"disabled"`) {
		t.Fatalf("unexpected response: %d %s", response.Code, response.Body.String())
	}
}

func TestReadinessTurnsOffDuringShutdown(t *testing.T) {
	server := newTestServer()
	server.SetReady(false)
	request := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", response.Code)
	}
}

func TestStatusDoesNotAdvertiseExecutorBeforeReconciliation(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	server := New(Options{Addr: ":0", Logger: logger, Mode: "cutover", Execution: &execution.Service{}, Token: testToken})
	server.SetReady(false)
	request := httptest.NewRequest(http.MethodGet, "/internal/v1/status", nil)
	request.Header.Set("Authorization", "Bearer "+testToken)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"status":"not_ready"`) || !strings.Contains(response.Body.String(), `"executor":"disabled"`) {
		t.Fatalf("unsafe pre-reconciliation status: %d %s", response.Code, response.Body.String())
	}
}
