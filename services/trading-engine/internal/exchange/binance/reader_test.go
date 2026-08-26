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
		case "/fapi/v1/openAlgoOrders":
			_, _ = w.Write([]byte(`[]`))
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

func TestWriterUsesAlgoAPIForProtectiveStop(t *testing.T) {
	var placeCalls, openCalls, cancelCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		assertBinanceSignature(t, request)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/fapi/v1/algoOrder":
			placeCalls++
			query := request.URL.Query()
			if query.Get("algoType") != "CONDITIONAL" || query.Get("type") != "STOP_MARKET" || query.Get("triggerPrice") != "49500.00" || query.Get("workingType") != "MARK_PRICE" || query.Get("clientAlgoId") != "kk_stop" || query.Get("reduceOnly") != "true" {
				t.Fatalf("unexpected algo params: %s", request.URL.RawQuery)
			}
			_, _ = w.Write([]byte(`{"algoId":2146760,"clientAlgoId":"kk_stop","algoType":"CONDITIONAL","orderType":"STOP_MARKET","symbol":"BTCUSDT","side":"SELL","quantity":"0.01","algoStatus":"NEW","triggerPrice":"49500.00","price":"0","reduceOnly":true,"createTime":1700000000000,"updateTime":1700000000000}`))
		case request.Method == http.MethodGet && request.URL.Path == "/fapi/v1/openOrders":
			_, _ = w.Write([]byte(`[]`))
		case request.Method == http.MethodGet && request.URL.Path == "/fapi/v1/openAlgoOrders":
			openCalls++
			if request.URL.Query().Get("algoType") != "CONDITIONAL" {
				t.Fatal("missing algo type filter")
			}
			_, _ = w.Write([]byte(`[{"algoId":2146760,"clientAlgoId":"kk_stop","orderType":"STOP_MARKET","symbol":"BTCUSDT","side":"SELL","quantity":"0.01","algoStatus":"NEW","triggerPrice":"49500.00","price":"0","reduceOnly":true}]`))
		case request.Method == http.MethodDelete && request.URL.Path == "/fapi/v1/algoOrder":
			cancelCalls++
			if request.URL.Query().Get("algoId") != "2146760" {
				t.Fatal("missing algo id")
			}
			_, _ = w.Write([]byte(`{"algoId":2146760,"clientAlgoId":"kk_stop","code":"200","msg":"success"}`))
		default:
			http.NotFound(w, request)
		}
	}))
	defer server.Close()
	reader := New(Options{Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret}, Client: server.Client(), FuturesURL: server.URL})
	placed, err := reader.PlaceOrder(t.Context(), exchange.PlaceOrderInput{Symbol: "BTCUSDT", Side: domain.SideSell, Type: domain.OrderStopMarket, Quantity: "0.01", StopPrice: "49500.00", ReduceOnly: true, ClientOrderID: "kk_stop"})
	if err != nil || placed.ExchangeOrderID != "2146760" || placed.Type != domain.OrderStopMarket || placed.Status != domain.OrderOpen || placed.StopPrice != "49500.00" {
		t.Fatalf("unexpected algo placement: %#v err=%v", placed, err)
	}
	orders, err := reader.GetOpenOrders(t.Context())
	if err != nil || len(orders) != 1 || orders[0].ExchangeOrderID != "2146760" {
		t.Fatalf("unexpected algo orders: %#v err=%v", orders, err)
	}
	canceled, err := reader.CancelConditionalOrder(t.Context(), "BTCUSDT", "2146760")
	if err != nil || canceled.Status != domain.OrderCanceled {
		t.Fatalf("unexpected algo cancel: %#v err=%v", canceled, err)
	}
	if placeCalls != 1 || openCalls != 1 || cancelCalls != 1 {
		t.Fatalf("unexpected call counts: %d %d %d", placeCalls, openCalls, cancelCalls)
	}
}

func TestWriterUsesAlgoAPIForTakeProfit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		assertBinanceSignature(t, request)
		query := request.URL.Query()
		if request.Method != http.MethodPost || request.URL.Path != "/fapi/v1/algoOrder" || query.Get("type") != "TAKE_PROFIT_MARKET" || query.Get("triggerPrice") != "51000.00" {
			t.Fatalf("unexpected take-profit request: %s %s", request.Method, request.URL.String())
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"algoId":2146761,"clientAlgoId":"kk_take","algoType":"CONDITIONAL","orderType":"TAKE_PROFIT_MARKET","symbol":"BTCUSDT","side":"SELL","quantity":"0.01","algoStatus":"NEW","triggerPrice":"51000.00","price":"0","reduceOnly":true}`))
	}))
	defer server.Close()
	reader := New(Options{Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret}, Client: server.Client(), FuturesURL: server.URL})
	placed, err := reader.PlaceOrder(t.Context(), exchange.PlaceOrderInput{Symbol: "BTCUSDT", Side: domain.SideSell, Type: domain.OrderTakeProfitMarket, Quantity: "0.01", StopPrice: "51000.00", ReduceOnly: true, ClientOrderID: "kk_take"})
	if err != nil || placed.Type != domain.OrderTakeProfitMarket || placed.StopPrice != "51000.00" {
		t.Fatalf("unexpected take-profit placement: %#v err=%v", placed, err)
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

func TestReaderLoadsFuturesChartCloses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet || request.URL.Path != "/fapi/v1/klines" || request.URL.Query().Get("symbol") != "BTCUSDT" || request.URL.Query().Get("interval") != "1m" || request.URL.Query().Get("limit") != "3" {
			t.Fatalf("unexpected chart request: %s %s", request.Method, request.URL.String())
		}
		_, _ = w.Write([]byte(`[[1,"99","101","98","100","1"],[2,"100","103","99","102","1"],[3,"102","104","101","103","1"]]`))
	}))
	defer server.Close()
	reader := New(Options{Client: server.Client(), FuturesURL: server.URL})
	closes, err := reader.GetRecentCloses(t.Context(), "BTCUSDT", "1m", 3)
	if err != nil || len(closes) != 3 || closes[0] != "100" || closes[2] != "103" {
		t.Fatalf("unexpected chart closes: %#v err=%v", closes, err)
	}
}

func TestReaderRejectsMarkPriceForAnotherSymbol(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		if request.URL.Query().Get("symbol") != "ETHUSDT" {
			t.Fatalf("unexpected mark query: %s", request.URL.RawQuery)
		}
		_, _ = w.Write([]byte(`{"symbol":"ENAUSDT","markPrice":"0.1595"}`))
	}))
	defer server.Close()
	reader := New(Options{Client: server.Client(), FuturesURL: server.URL})
	if price, err := reader.GetMarkPrice(t.Context(), "ETHUSDT"); err == nil || price != "" {
		t.Fatalf("cross-symbol mark price was accepted: price=%s err=%v", price, err)
	}
}

func TestReaderLoadsDerivativesContext(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/fapi/v1/premiumIndex":
			_, _ = w.Write([]byte(`{"symbol":"BTCUSDT","lastFundingRate":"0.0001"}`))
		case "/futures/data/openInterestHist":
			if request.URL.Query().Get("period") != "5m" || request.URL.Query().Get("limit") != "2" {
				t.Fatalf("unexpected OI query: %s", request.URL.RawQuery)
			}
			_, _ = w.Write([]byte(`[{"symbol":"BTCUSDT","sumOpenInterest":"100"},{"symbol":"BTCUSDT","sumOpenInterest":"110"}]`))
		default:
			http.NotFound(w, request)
		}
	}))
	defer server.Close()
	reader := New(Options{Client: server.Client(), FuturesURL: server.URL})
	context, err := reader.GetDerivativesContext(t.Context(), "BTCUSDT")
	if err != nil || context.FundingRate != "0.0001" || context.PreviousOpenInterest != "100" || context.OpenInterest != "110" {
		t.Fatalf("unexpected derivatives context: %#v err=%v", context, err)
	}
}

func TestReaderFallsBackToAlgoOrderByClientID(t *testing.T) {
	var regularCalls, algoCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		assertBinanceSignature(t, request)
		w.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/fapi/v1/order":
			regularCalls++
			if request.URL.Query().Get("origClientOrderId") != "kk_algo_reconcile" {
				t.Fatalf("unexpected regular order lookup: %s", request.URL.String())
			}
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"code":-2013,"msg":"Order does not exist."}`))
		case "/fapi/v1/algoOrder":
			algoCalls++
			if request.URL.Query().Get("clientAlgoId") != "kk_algo_reconcile" {
				t.Fatalf("unexpected algo order lookup: %s", request.URL.String())
			}
			_, _ = w.Write([]byte(`{"algoId":88,"clientAlgoId":"kk_algo_reconcile","algoType":"CONDITIONAL","orderType":"TAKE_PROFIT_MARKET","symbol":"BTCUSDT","side":"SELL","quantity":"0.01","algoStatus":"FINISHED","actualOrderId":"991","actualQty":"0.01","actualPrice":"51025","triggerPrice":"51000","reduceOnly":true,"createTime":1700000000000,"updateTime":1700000001000}`))
		default:
			http.NotFound(w, request)
		}
	}))
	defer server.Close()

	reader := New(Options{Credentials: exchange.Credentials{APIKey: "test-key", APISecret: testSecret}, Client: server.Client(), FuturesURL: server.URL})
	order, err := reader.GetOrderByClientID(t.Context(), "BTCUSDT", "kk_algo_reconcile")
	if err != nil || order.ExchangeOrderID != "991" || order.Type != domain.OrderTakeProfitMarket || order.Status != domain.OrderFilled || order.ExecutedQuantity != "0.01" || order.StopPrice != "51000" {
		t.Fatalf("unexpected algo reconciliation order: %#v err=%v", order, err)
	}
	if regularCalls != 1 || algoCalls != 1 {
		t.Fatalf("unexpected reconciliation call counts: %d %d", regularCalls, algoCalls)
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
