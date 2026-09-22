package binance

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

func TestSpotGridEntryUsesMakerOrderAndNoFuturesParameters(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/api/v3/order" || r.Method != http.MethodPost {
			t.Errorf("unexpected endpoint %s %s", r.Method, r.URL.Path)
		}
		_ = r.ParseForm()
		if r.Form.Get("type") != "LIMIT_MAKER" || r.Form.Get("price") != "2400" {
			t.Errorf("unexpected order %v", r.Form)
		}
		for _, key := range []string{"timeInForce", "reduceOnly", "positionSide", "leverage"} {
			if r.Form.Get(key) != "" {
				t.Errorf("unexpected spot parameter %s", key)
			}
		}
		if r.Form.Get("signature") == "" {
			t.Error("missing signature")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"orderId":42,"symbol":"ETHUSDT","side":"BUY","type":"LIMIT_MAKER","status":"NEW","origQty":"0.1","executedQty":"0","price":"2400"}`))
	}))
	defer server.Close()
	writer := NewSpot(Options{Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret}, Client: server.Client(), SpotURL: server.URL, FuturesURL: "http://invalid.invalid"})
	order, err := writer.PlaceOrder(context.Background(), exchange.PlaceOrderInput{Symbol: "ETHUSDT", Side: domain.SideBuy, Type: domain.OrderLimit, Quantity: "0.1", Price: "2400", PostOnly: true, ClientOrderID: "grid-test"})
	if err != nil {
		t.Fatal(err)
	}
	if order.Type != domain.OrderLimit || calls != 1 {
		t.Fatalf("unexpected result %+v calls=%d", order, calls)
	}
	_, err = writer.PlaceOrder(context.Background(), exchange.PlaceOrderInput{Symbol: "ETHUSDT", Side: domain.SideBuy, Type: domain.OrderLimit, ReduceOnly: true})
	if err == nil || calls != 1 {
		t.Fatal("unsupported short close reached exchange")
	}
}
