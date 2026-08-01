package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	tradingv1 "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/api/v1"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/execution"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/shadow"
)

type Server struct {
	httpServer *http.Server
	logger     *slog.Logger
	mode       string
	ready      atomic.Bool
	execution  *execution.Service
	shadow     *shadow.Service
	token      string
}

type Options struct {
	Addr      string
	Logger    *slog.Logger
	Mode      string
	Execution *execution.Service
	Shadow    *shadow.Service
	Token     string
}

func New(options Options) *Server {
	server := &Server{logger: options.Logger, mode: options.Mode, execution: options.Execution, shadow: options.Shadow, token: options.Token}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", server.live)
	mux.HandleFunc("GET /health/ready", server.readiness)
	mux.Handle("GET /internal/v1/status", server.requireInternalToken(http.HandlerFunc(server.status)))
	if server.shadow != nil {
		mux.Handle("GET /internal/v1/shadow/accounts/{accountId}/snapshot", server.requireInternalToken(http.HandlerFunc(server.shadowSnapshot)))
	}
	if server.execution != nil {
		mux.Handle("POST /internal/v1/execution/orders/preview", server.requireInternalToken(http.HandlerFunc(server.previewOrder)))
		mux.Handle("POST /internal/v1/execution/orders", server.requireInternalToken(http.HandlerFunc(server.placeOrder)))
		mux.Handle("POST /internal/v1/execution/orders/cancel", server.requireInternalToken(http.HandlerFunc(server.cancelOrder)))
	}

	server.httpServer = &http.Server{
		Addr:              options.Addr,
		Handler:           server.requestContext(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	return server
}

func (s *Server) SetReady(ready bool) { s.ready.Store(ready) }

func (s *Server) ListenAndServe() error {
	err := s.httpServer.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.ready.Store(false)
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) Handler() http.Handler { return s.httpServer.Handler }

func (s *Server) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "service": "trading-engine"})
}

func (s *Server) readiness(w http.ResponseWriter, _ *http.Request) {
	if !s.ready.Load() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"status": "not_ready"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ready", "mode": s.mode})
}

func (s *Server) status(w http.ResponseWriter, _ *http.Request) {
	shadowRead := "disabled"
	if s.shadow != nil {
		shadowRead = "enabled"
	}
	executor := "disabled"
	if s.execution != nil {
		executor = "enabled"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "ready",
		"mode":        s.mode,
		"executor":    executor,
		"shadow_read": shadowRead,
	})
}

func (s *Server) previewOrder(w http.ResponseWriter, r *http.Request) {
	var request tradingv1.PreviewOrderRequest
	if err := decodeJSON(r, &request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_request"})
		return
	}
	result, err := s.execution.Preview(r.Context(), request)
	if err != nil {
		writeExecutionError(w, err)
		return
	}
	result.Meta = tradingv1.NewMeta(w.Header().Get("X-Request-ID"), time.Now())
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) placeOrder(w http.ResponseWriter, r *http.Request) {
	var command tradingv1.PlaceOrderCommand
	if err := decodeJSON(r, &command); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_request"})
		return
	}
	result, replay, err := s.execution.Place(r.Context(), command)
	if err != nil {
		writeExecutionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"order": result, "idempotentReplay": replay})
}

func (s *Server) cancelOrder(w http.ResponseWriter, r *http.Request) {
	var command tradingv1.CancelOrderCommand
	if err := decodeJSON(r, &command); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_request"})
		return
	}
	result, replay, err := s.execution.Cancel(r.Context(), command)
	if err != nil {
		writeExecutionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"order": result, "idempotentReplay": replay})
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeExecutionError(w http.ResponseWriter, err error) {
	var exchangeError *exchange.Error
	if errors.As(err, &exchangeError) {
		status := http.StatusUnprocessableEntity
		if exchangeError.Normalized.Category == "VALIDATION" {
			status = http.StatusBadRequest
		}
		if exchangeError.Normalized.Reconciliation {
			status = http.StatusConflict
		}
		writeJSON(w, status, map[string]any{"error": exchangeError.Normalized})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "execution_failed"})
}

func (s *Server) shadowSnapshot(w http.ResponseWriter, r *http.Request) {
	accountID := strings.TrimSpace(r.PathValue("accountId"))
	userID := strings.TrimSpace(r.URL.Query().Get("userId"))
	if accountID == "" || userID == "" || len(accountID) > 128 || len(userID) > 128 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_shadow_query"})
		return
	}
	snapshot, err := s.shadow.Snapshot(r.Context(), userID, accountID)
	if err != nil {
		s.logger.Warn("shadow snapshot failed", "account_id", accountID, "error", err)
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": "shadow_snapshot_failed"})
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (s *Server) requireInternalToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		provided := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if len(provided) != len(s.token) || subtle.ConstantTimeCompare([]byte(provided), []byte(s.token)) != 1 {
			w.Header().Set("WWW-Authenticate", "Bearer")
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) requestContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := strings.TrimSpace(r.Header.Get("X-Request-ID"))
		if requestID == "" || len(requestID) > 128 {
			requestID = randomID()
		}
		w.Header().Set("X-Request-ID", requestID)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		started := time.Now()
		next.ServeHTTP(w, r)
		s.logger.Info("request completed", "method", r.Method, "path", r.URL.Path, "request_id", requestID, "duration_ms", time.Since(started).Milliseconds())
	})
}

func randomID() string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "request-id-unavailable"
	}
	return hex.EncodeToString(buffer)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
