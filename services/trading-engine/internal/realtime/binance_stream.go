package realtime

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	binanceexchange "github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange/binance"
)

const (
	listenKeyKeepalive = 30 * time.Minute
	websocketHeartbeat = 2 * time.Minute
	websocketReadLimit = 1 << 20
)

type binanceStream struct {
	resolved  account.Resolved
	store     Store
	client    *http.Client
	endpoints exchange.Endpoints
	logger    *slog.Logger
}

func newBinanceStream(resolved account.Resolved, store Store, client *http.Client, endpoints exchange.Endpoints, logger *slog.Logger) *binanceStream {
	return &binanceStream{resolved: resolved, store: store, client: client, endpoints: endpoints, logger: logger}
}

func (s *binanceStream) run(ctx context.Context) error {
	if s.resolved.Reference.Provider != domain.ProviderBinance {
		return errors.New("realtime provider is not supported")
	}
	if err := s.reconcile(ctx, "connect"); err != nil {
		return fmt.Errorf("initial stream reconciliation: %w", err)
	}
	listenKey, err := s.startListenKey(ctx)
	if err != nil {
		return err
	}
	defer s.closeListenKey(context.WithoutCancel(ctx))

	streamURL := strings.TrimRight(s.endpoints.BinanceFuturesWS, "/") + "/ws/" + listenKey
	connection, response, err := websocket.DefaultDialer.DialContext(ctx, streamURL, nil)
	if response != nil && response.Body != nil {
		_ = response.Body.Close()
	}
	if err != nil {
		return fmt.Errorf("connect binance private websocket: %w", err)
	}
	defer connection.Close()
	closed := make(chan struct{})
	defer close(closed)
	go func() {
		select {
		case <-ctx.Done():
			_ = connection.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "shutdown"), time.Now().Add(time.Second))
			_ = connection.Close()
		case <-closed:
		}
	}()
	connection.SetReadLimit(websocketReadLimit)
	_ = connection.SetReadDeadline(time.Now().Add(10 * time.Minute))
	connection.SetPongHandler(func(string) error {
		return connection.SetReadDeadline(time.Now().Add(10 * time.Minute))
	})

	if err := s.store.AppendOutboxEvent(ctx, statusEvent(s.resolved, "STREAM_CONNECTED", map[string]any{
		"transport": "BINANCE_USER_DATA", "reconciled": true,
	})); err != nil {
		return err
	}

	keepalive := time.NewTicker(listenKeyKeepalive)
	heartbeat := time.NewTicker(websocketHeartbeat)
	defer keepalive.Stop()
	defer heartbeat.Stop()
	keepaliveError := make(chan error, 1)
	writeError := make(chan error, 1)
	var writeMutex sync.Mutex

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-keepalive.C:
				if err := s.keepaliveListenKey(ctx); err != nil {
					select {
					case keepaliveError <- err:
					default:
					}
					return
				}
			case <-heartbeat.C:
				writeMutex.Lock()
				err := connection.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second))
				writeMutex.Unlock()
				if err != nil {
					select {
					case writeError <- err:
					default:
					}
					return
				}
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-keepaliveError:
			return fmt.Errorf("keepalive binance listen key: %w", err)
		case err := <-writeError:
			return fmt.Errorf("binance websocket heartbeat: %w", err)
		default:
		}
		_, message, err := connection.ReadMessage()
		if err != nil {
			return fmt.Errorf("read binance private websocket: %w", err)
		}
		_ = connection.SetReadDeadline(time.Now().Add(10 * time.Minute))
		if err := s.handleMessage(ctx, message); err != nil {
			return err
		}
	}
}

func (s *binanceStream) reconcile(ctx context.Context, reason string) error {
	reader := binanceexchange.New(binanceexchange.Options{
		Credentials: s.resolved.Credentials, Client: s.client,
		FuturesURL: s.endpoints.BinanceFutures, SpotURL: s.endpoints.BinanceSpot,
	})
	orders, err := reader.GetOpenOrders(ctx)
	if err != nil {
		return err
	}
	positions, err := reader.GetPositions(ctx)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	return s.store.AppendOutboxEvent(ctx, domain.OutboxEvent{
		UserID: s.resolved.Reference.UserID, ExchangeAccountID: s.resolved.Reference.ID,
		Provider: domain.ProviderBinance, Topic: "trading.snapshot", EventType: "SNAPSHOT_RECONCILED",
		AggregateType: "ACCOUNT", AggregateID: s.resolved.Reference.ID,
		DeduplicationKey: fmt.Sprintf("%s:snapshot:%d", s.resolved.Reference.ID, now.UnixNano()),
		Payload:          map[string]any{"reason": reason, "orders": orders, "positions": positions}, OccurredAt: now,
	})
}

func (s *binanceStream) startListenKey(ctx context.Context) (string, error) {
	var body struct {
		ListenKey string `json:"listenKey"`
	}
	if err := s.listenKeyRequest(ctx, http.MethodPost, &body); err != nil {
		return "", fmt.Errorf("start binance listen key: %w", err)
	}
	if strings.TrimSpace(body.ListenKey) == "" {
		return "", errors.New("start binance listen key: empty response")
	}
	return body.ListenKey, nil
}

func (s *binanceStream) keepaliveListenKey(ctx context.Context) error {
	return s.listenKeyRequest(ctx, http.MethodPut, &struct{}{})
}

func (s *binanceStream) closeListenKey(ctx context.Context) {
	closeContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	_ = s.listenKeyRequest(closeContext, http.MethodDelete, nil)
}

func (s *binanceStream) listenKeyRequest(ctx context.Context, method string, target any) error {
	requestURL := strings.TrimRight(s.endpoints.BinanceFutures, "/") + "/fapi/v1/listenKey"
	request, err := http.NewRequestWithContext(ctx, method, requestURL, nil)
	if err != nil {
		return err
	}
	request.Header.Set("X-MBX-APIKEY", s.resolved.Credentials.APIKey)
	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("listen key request rejected with status %d", response.StatusCode)
	}
	if target == nil || response.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(response.Body).Decode(target)
}

type binanceEnvelope struct {
	EventType       string          `json:"e"`
	EventTime       int64           `json:"E"`
	TransactionTime int64           `json:"T"`
	Order           json.RawMessage `json:"o"`
	Account         json.RawMessage `json:"a"`
}

func (s *binanceStream) handleMessage(ctx context.Context, message []byte) error {
	var envelope binanceEnvelope
	if err := json.Unmarshal(message, &envelope); err != nil {
		return errors.New("decode binance private stream event")
	}
	if envelope.EventType == "" {
		return nil
	}
	occurredAt := time.UnixMilli(envelope.EventTime).UTC()
	if envelope.EventTime == 0 {
		occurredAt = time.Now().UTC()
	}
	payload := map[string]any{"eventTime": envelope.EventTime, "transactionTime": envelope.TransactionTime}
	eventType, topic, aggregateType, aggregateID := envelope.EventType, "trading.account", "ACCOUNT", s.resolved.Reference.ID

	switch envelope.EventType {
	case "ORDER_TRADE_UPDATE":
		var order struct {
			Symbol           string `json:"s"`
			ClientOrderID    string `json:"c"`
			Side             string `json:"S"`
			Type             string `json:"o"`
			ExecutionType    string `json:"x"`
			Status           string `json:"X"`
			OrderID          int64  `json:"i"`
			Quantity         string `json:"q"`
			ExecutedQuantity string `json:"z"`
			Price            string `json:"p"`
			StopPrice        string `json:"sp"`
			ReduceOnly       bool   `json:"R"`
			PositionSide     string `json:"ps"`
		}
		if err := json.Unmarshal(envelope.Order, &order); err != nil || order.Symbol == "" || order.OrderID == 0 {
			return errors.New("decode binance order update")
		}
		eventType, topic, aggregateType, aggregateID = "ORDER_UPDATED", "trading.order", "ORDER", fmt.Sprintf("%d", order.OrderID)
		payload["order"] = map[string]any{
			"symbol": order.Symbol, "clientOrderId": order.ClientOrderID, "exchangeOrderId": aggregateID,
			"side": order.Side, "type": order.Type, "executionType": order.ExecutionType, "status": order.Status,
			"quantity": order.Quantity, "executedQuantity": order.ExecutedQuantity, "price": order.Price,
			"stopPrice": order.StopPrice, "reduceOnly": order.ReduceOnly, "positionSide": order.PositionSide,
		}
	case "ACCOUNT_UPDATE":
		var update struct {
			Reason   string `json:"m"`
			Balances []struct {
				Asset              string `json:"a"`
				WalletBalance      string `json:"wb"`
				CrossWalletBalance string `json:"cw"`
				BalanceChange      string `json:"bc"`
			} `json:"B"`
			Positions []struct {
				Symbol              string `json:"s"`
				PositionAmount      string `json:"pa"`
				EntryPrice          string `json:"ep"`
				BreakEvenPrice      string `json:"bep"`
				AccumulatedRealized string `json:"cr"`
				UnrealizedPnL       string `json:"up"`
				MarginType          string `json:"mt"`
				IsolatedWallet      string `json:"iw"`
				PositionSide        string `json:"ps"`
			} `json:"P"`
		}
		if err := json.Unmarshal(envelope.Account, &update); err != nil {
			return errors.New("decode binance account update")
		}
		eventType = "POSITION_UPDATED"
		payload["reason"] = update.Reason
		payload["balances"] = update.Balances
		payload["positions"] = update.Positions
	case "listenKeyExpired":
		eventType = "LISTEN_KEY_EXPIRED"
		payload["reason"] = "listen_key_expired"
	default:
		return nil
	}
	digest := sha256.Sum256(message)
	event := domain.OutboxEvent{
		UserID: s.resolved.Reference.UserID, ExchangeAccountID: s.resolved.Reference.ID,
		Provider: domain.ProviderBinance, Topic: topic, EventType: eventType,
		AggregateType: aggregateType, AggregateID: aggregateID,
		DeduplicationKey: s.resolved.Reference.ID + ":binance:" + hex.EncodeToString(digest[:]),
		Payload:          payload, OccurredAt: occurredAt,
	}
	if err := s.store.AppendOutboxEvent(ctx, event); err != nil {
		return err
	}
	if envelope.EventType == "listenKeyExpired" {
		return errors.New("binance listen key expired")
	}
	return nil
}
