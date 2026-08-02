package binance

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
)

const testSecret = "binance-test-secret"

func TestReaderNormalizesReadOnlySnapshot(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			t.Fatalf("shadow adapter attempted mutating method: %s", request.Method)
		}
		if strings.HasPrefix(request.URL.Path, "/fapi/") && request.URL.Path != "/fapi/v1/exchangeInfo" {
			assertBinanceSignature(t, request)
		}
		w.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v3/account":
			_, _ = w.Write([]byte(`{"balances":[{"asset":"ETH","free":"1.20","locked":"0.30"},{"asset":"ZERO","free":"0","locked":"0"}]}`))
		case "/api/v3/ticker/price":
			_, _ = w.Write([]byte(`[{"symbol":"ETHUSDT","price":"2000"}]`))
		case "/fapi/v3/account":
			_, _ = w.Write([]byte(`{"assets":[{"asset":"USDT","walletBalance":"100","availableBalance":"90","unrealizedProfit":"-2"}]}`))
		case "/fapi/v1/exchangeInfo":
			_, _ = w.Write([]byte(`{"symbols":[{"symbol":"ETHUSDT","status":"TRADING","baseAsset":"ETH","quoteAsset":"USDT","contractType":"PERPETUAL","filters":[{"filterType":"PRICE_FILTER","tickSize":"0.01"},{"filterType":"LOT_SIZE","stepSize":"0.001","minQty":"0.001","maxQty":"100"},{"filterType":"MARKET_LOT_SIZE","maxQty":"50"},{"filterType":"MIN_NOTIONAL","notional":"5"}]}]}`))
		case "/fapi/v1/leverageBracket":
			_, _ = w.Write([]byte(`[{"symbol":"ETHUSDT","brackets":[{"initialLeverage":75}]}]`))
		case "/fapi/v1/openOrders":
			_, _ = w.Write([]byte(`[{"orderId":42,"clientOrderId":"kk_test","symbol":"ETHUSDT","side":"SELL","type":"STOP","status":"NEW","origQty":"0.5","executedQty":"0","price":"1900","stopPrice":"1950","reduceOnly":true,"time":1700000000000}]`))
		case "/fapi/v2/positionRisk":
			_, _ = w.Write([]byte(`[{"symbol":"ETHUSDT","positionAmt":"-0.546","entryPrice":"1827.37","markPrice":"1836.81","unRealizedProfit":"-5.15","liquidationPrice":"1850.92","leverage":"60","marginType":"isolated","positionSide":"BOTH"}]`))
		default:
			http.NotFound(w, request)
		}
	}))
	defer server.Close()

	reader := New(Options{
		Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret},
		Client:      server.Client(), FuturesURL: server.URL, SpotURL: server.URL,
		Now: func() time.Time { return time.UnixMilli(1700000000000) },
	})
	ctx := t.Context()
	balances, err := reader.GetBalances(ctx)
	if err != nil || len(balances) != 2 || balances[0].ValueUSDT != "3000" {
		t.Fatalf("unexpected balances: %#v, err=%v", balances, err)
	}
	symbols, err := reader.GetSymbols(ctx)
	if err != nil || len(symbols) != 1 || symbols[0].MaxLeverage != 75 || symbols[0].MaxQuantity != "50" {
		t.Fatalf("unexpected symbols: %#v, err=%v", symbols, err)
	}
	orders, err := reader.GetOpenOrders(ctx)
	if err != nil || len(orders) != 1 || orders[0].Type != domain.OrderStopLimit || orders[0].Status != domain.OrderOpen {
		t.Fatalf("unexpected orders: %#v, err=%v", orders, err)
	}
	positions, err := reader.GetPositions(ctx)
	if err != nil || len(positions) != 1 || positions[0].Side != domain.PositionShort || positions[0].Leverage != "60" || positions[0].MarginMode != domain.MarginIsolated {
		t.Fatalf("unexpected positions: %#v, err=%v", positions, err)
	}
}

func TestReaderNormalizesPermissionErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code":-2015}`))
	}))
	defer server.Close()
	reader := New(Options{Credentials: exchange.Credentials{APIKey: "key", APISecret: testSecret}, Client: server.Client(), FuturesURL: server.URL})
	_, err := reader.GetOpenOrders(t.Context())
	exchangeError, ok := err.(*exchange.Error)
	if !ok || exchangeError.Normalized.Code != "EXCHANGE_PERMISSION_DENIED" || exchangeError.Normalized.ExchangeCode != "-2015" {
		t.Fatalf("unexpected normalized error: %#v", err)
	}
}

func TestReaderQueriesOrderByOriginalClientID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		assertBinanceSignature(t, request)
		if request.Method != http.MethodGet || request.URL.Path != "/fapi/v1/order" || request.URL.Query().Get("origClientOrderId") != "kk_reconcile" {
			t.Fatalf("unexpected reconciliation request: %s %s", request.Method, request.URL.String())
		}
		_, _ = w.Write([]byte(`{"orderId":77,"clientOrderId":"kk_reconcile","symbol":"BTCUSDT","side":"BUY","type":"LIMIT","status":"FILLED","origQty":"0.01","executedQty":"0.01","price":"50000","updateTime":1700000001000}`))
	}))
	defer server.Close()
	reader := New(Options{Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret}, Client: server.Client(), FuturesURL: server.URL})
	order, err := reader.GetOrderByClientID(t.Context(), "BTCUSDT", "kk_reconcile")
	if err != nil || order.ExchangeOrderID != "77" || order.Status != domain.OrderFilled || order.UpdatedAt.IsZero() {
		t.Fatalf("unexpected reconciliation order: %#v err=%v", order, err)
	}
}

func TestWriterSignsConfigurePlaceAndCancelRequests(t *testing.T) {
	var marginCalls, leverageCalls, placeCalls, cancelCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		assertBinanceSignature(t, request)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/fapi/v1/marginType":
			marginCalls++
			_, _ = w.Write([]byte(`{"code":200}`))
		case request.Method == http.MethodPost && request.URL.Path == "/fapi/v1/leverage":
			leverageCalls++
			_, _ = w.Write([]byte(`{"leverage":10}`))
		case request.Method == http.MethodPost && request.URL.Path == "/fapi/v1/order":
			placeCalls++
			_, _ = w.Write([]byte(`{"orderId":99,"clientOrderId":"kk_write","symbol":"BTCUSDT","side":"BUY","type":"MARKET","status":"NEW","origQty":"0.001","executedQty":"0","reduceOnly":false}`))
		case request.Method == http.MethodDelete && request.URL.Path == "/fapi/v1/order":
			cancelCalls++
			_, _ = w.Write([]byte(`{"orderId":99,"clientOrderId":"kk_write","symbol":"BTCUSDT","side":"BUY","type":"MARKET","status":"CANCELED","origQty":"0.001","executedQty":"0","reduceOnly":false}`))
		default:
			http.NotFound(w, request)
		}
	}))
	defer server.Close()
	reader := New(Options{Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret}, Client: server.Client(), FuturesURL: server.URL})
	if err := reader.ConfigurePosition(t.Context(), "BTCUSDT", 10, domain.MarginIsolated); err != nil {
		t.Fatal(err)
	}
	placed, err := reader.PlaceOrder(t.Context(), exchange.PlaceOrderInput{Symbol: "BTCUSDT", Side: domain.SideBuy, Type: domain.OrderMarket, Quantity: "0.001", ClientOrderID: "kk_write"})
	if err != nil || placed.ExchangeOrderID != "99" {
		t.Fatalf("unexpected place: %#v err=%v", placed, err)
	}
	canceled, err := reader.CancelOrder(t.Context(), "BTCUSDT", "99")
	if err != nil || canceled.Status != domain.OrderCanceled {
		t.Fatalf("unexpected cancel: %#v err=%v", canceled, err)
	}
	if marginCalls != 1 || leverageCalls != 1 || placeCalls != 1 || cancelCalls != 1 {
		t.Fatalf("unexpected write call counts: %d %d %d %d", marginCalls, leverageCalls, placeCalls, cancelCalls)
	}
}

func assertBinanceSignature(t *testing.T, request *http.Request) {
	t.Helper()
	if request.Header.Get("X-MBX-APIKEY") != "test-key" {
		t.Fatal("missing Binance API key header")
	}
	query := request.URL.Query()
	signature := query.Get("signature")
	query.Del("signature")
	mac := hmac.New(sha256.New, []byte(testSecret))
	_, _ = mac.Write([]byte(query.Encode()))
	if signature != hex.EncodeToString(mac.Sum(nil)) {
		t.Fatal("invalid Binance signature")
	}
}
