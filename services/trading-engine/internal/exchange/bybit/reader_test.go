package bybit

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

const testSecret = "bybit-test-secret"

func TestReaderNormalizesReadOnlySnapshot(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			t.Fatalf("shadow adapter attempted mutating method: %s", request.Method)
		}
		if request.URL.Path != "/v5/market/instruments-info" {
			assertBybitSignature(t, request)
		}
		w.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/v5/account/wallet-balance":
			_, _ = w.Write([]byte(`{"retCode":0,"result":{"list":[{"coin":[{"coin":"USDT","walletBalance":"100","equity":"95","unrealisedPnl":"-5"}]}]}}`))
		case "/v5/market/instruments-info":
			_, _ = w.Write([]byte(`{"retCode":0,"result":{"list":[{"symbol":"ETHUSDT","status":"Trading","baseCoin":"ETH","quoteCoin":"USDT","leverageFilter":{"maxLeverage":"100"},"priceFilter":{"tickSize":"0.01"},"lotSizeFilter":{"minOrderQty":"0.001","maxOrderQty":"100","maxMktOrderQty":"50","qtyStep":"0.001","minNotionalValue":"5"}}],"nextPageCursor":""}}`))
		case "/v5/order/realtime":
			_, _ = w.Write([]byte(`{"retCode":0,"result":{"list":[{"orderId":"order-1","orderLinkId":"kk_test","symbol":"ETHUSDT","side":"Sell","orderType":"Limit","orderStatus":"PartiallyFilled","qty":"1","cumExecQty":"0.2","price":"1900","triggerPrice":"1950","reduceOnly":true,"createdTime":"1700000000000"}]}}`))
		case "/v5/position/list":
			_, _ = w.Write([]byte(`{"retCode":0,"result":{"list":[{"symbol":"ETHUSDT","side":"Sell","size":"0.546","avgPrice":"1827.37","markPrice":"1836.81","liqPrice":"1850.92","unrealisedPnl":"-5.15","leverage":"60","tradeMode":1,"positionIdx":2}]}}`))
		default:
			http.NotFound(w, request)
		}
	}))
	defer server.Close()

	reader := New(Options{
		Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret}, Client: server.Client(), BaseURL: server.URL,
		Now: func() time.Time { return time.UnixMilli(1700000000000) },
	})
	ctx := t.Context()
	balances, err := reader.GetBalances(ctx)
	if err != nil || len(balances) != 1 || balances[0].WalletType != domain.WalletUnified {
		t.Fatalf("unexpected balances: %#v, err=%v", balances, err)
	}
	symbols, err := reader.GetSymbols(ctx)
	if err != nil || len(symbols) != 1 || symbols[0].MaxLeverage != 100 || symbols[0].MaxQuantity != "50" {
		t.Fatalf("unexpected symbols: %#v, err=%v", symbols, err)
	}
	orders, err := reader.GetOpenOrders(ctx)
	if err != nil || len(orders) != 1 || orders[0].Type != domain.OrderStopLimit || orders[0].Status != domain.OrderPartiallyFilled {
		t.Fatalf("unexpected orders: %#v, err=%v", orders, err)
	}
	positions, err := reader.GetPositions(ctx)
	if err != nil || len(positions) != 1 || positions[0].Side != domain.PositionShort || positions[0].Leverage != "60" || positions[0].MarginMode != domain.MarginIsolated || *positions[0].PositionIndex != 2 {
		t.Fatalf("unexpected positions: %#v, err=%v", positions, err)
	}
}

func TestReaderNormalizesBybitRetCode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"retCode":10006,"retMsg":"sensitive upstream text","result":{}}`))
	}))
	defer server.Close()
	reader := New(Options{Credentials: exchange.Credentials{APIKey: "key", APISecret: testSecret}, Client: server.Client(), BaseURL: server.URL})
	_, err := reader.GetOpenOrders(t.Context())
	exchangeError, ok := err.(*exchange.Error)
	if !ok || exchangeError.Normalized.Code != "EXCHANGE_RATE_LIMITED" || exchangeError.Normalized.Message == "sensitive upstream text" {
		t.Fatalf("unexpected normalized error: %#v", err)
	}
}

func TestWriterSignsConfigurePlaceAndCancelRequests(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		body, _ := io.ReadAll(request.Body)
		assertBybitPostSignature(t, request, body)
		calls++
		w.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/v5/order/create" {
			_, _ = w.Write([]byte(`{"retCode":0,"result":{"orderId":"order-99","orderLinkId":"kk_write"}}`))
			return
		}
		if request.URL.Path == "/v5/order/cancel" {
			_, _ = w.Write([]byte(`{"retCode":0,"result":{"orderId":"order-99","orderLinkId":"kk_write"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"retCode":0,"result":{}}`))
	}))
	defer server.Close()
	reader := New(Options{Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret}, Client: server.Client(), BaseURL: server.URL})
	if err := reader.ConfigurePosition(t.Context(), "BTCUSDT", 10, domain.MarginCross); err != nil {
		t.Fatal(err)
	}
	placed, err := reader.PlaceOrder(t.Context(), exchange.PlaceOrderInput{Symbol: "BTCUSDT", Side: domain.SideBuy, Type: domain.OrderMarket, Quantity: "0.001", ClientOrderID: "kk_write"})
	if err != nil || placed.ExchangeOrderID != "order-99" {
		t.Fatalf("unexpected place: %#v err=%v", placed, err)
	}
	canceled, err := reader.CancelOrder(t.Context(), "BTCUSDT", "order-99")
	if err != nil || canceled.Status != domain.OrderCanceled {
		t.Fatalf("unexpected cancel: %#v err=%v", canceled, err)
	}
	if calls != 4 {
		t.Fatalf("expected four signed writes, got %d", calls)
	}
}

func assertBybitSignature(t *testing.T, request *http.Request) {
	t.Helper()
	timestamp := request.Header.Get("X-BAPI-TIMESTAMP")
	window := request.Header.Get("X-BAPI-RECV-WINDOW")
	if request.Header.Get("X-BAPI-API-KEY") != "test-key" || window != receiveWindow {
		t.Fatal("missing Bybit authentication headers")
	}
	mac := hmac.New(sha256.New, []byte(testSecret))
	_, _ = mac.Write([]byte(timestamp + "test-key" + window + request.URL.RawQuery))
	if request.Header.Get("X-BAPI-SIGN") != hex.EncodeToString(mac.Sum(nil)) {
		t.Fatal("invalid Bybit signature")
	}
}

func assertBybitPostSignature(t *testing.T, request *http.Request, body []byte) {
	t.Helper()
	timestamp := request.Header.Get("X-BAPI-TIMESTAMP")
	window := request.Header.Get("X-BAPI-RECV-WINDOW")
	mac := hmac.New(sha256.New, []byte(testSecret))
	_, _ = mac.Write([]byte(timestamp + "test-key" + window + string(body)))
	if request.Method != http.MethodPost || request.Header.Get("X-BAPI-SIGN") != hex.EncodeToString(mac.Sum(nil)) {
		t.Fatal("invalid Bybit POST signature")
	}
}
