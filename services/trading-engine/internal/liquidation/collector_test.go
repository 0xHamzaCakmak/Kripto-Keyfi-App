package liquidation

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestParseAndClusterLiquidations(t *testing.T) {
	now := time.UnixMilli(1_700_000_000_000).UTC()
	collector := New("ws://example.invalid", nil)
	collector.now = func() time.Time { return now }
	for _, side := range []string{"SELL", "SELL", "SELL"} {
		value, err := parse([]byte(`{"e":"forceOrder","E":1700000000000,"o":{"s":"BTCUSDT","S":"` + side + `","q":"1","p":"20000","ap":"20000","z":"1","T":1700000000000}}`))
		if err != nil {
			t.Fatal(err)
		}
		collector.add(value)
	}
	context, err := collector.LiquidationContext(t.Context(), "BTCUSDT", now)
	if err != nil || !context.Cluster || context.Pressure >= 0 || context.EventCount != 3 {
		t.Fatalf("unexpected liquidation cluster: %#v err=%v", context, err)
	}
}

func TestCollectorSendsHeartbeatBeforeReadDeadline(t *testing.T) {
	pingObserved := make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		connection, err := (&websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}).Upgrade(response, request, nil)
		if err != nil {
			return
		}
		defer connection.Close()
		connection.SetPingHandler(func(payload string) error {
			select {
			case pingObserved <- struct{}{}:
			default:
			}
			return connection.WriteControl(websocket.PongMessage, []byte(payload), time.Now().Add(time.Second))
		})
		for {
			if _, _, err := connection.ReadMessage(); err != nil {
				return
			}
		}
	}))
	defer server.Close()
	collector := New("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	collector.pingInterval = 20 * time.Millisecond
	collector.heartbeatWindow = 200 * time.Millisecond
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- collector.consume(ctx) }()
	select {
	case <-pingObserved:
		cancel()
	case <-time.After(time.Second):
		cancel()
		t.Fatal("liquidation websocket heartbeat was not sent")
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("collector did not shut down cleanly: %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("collector did not stop after context cancellation")
	}
}
