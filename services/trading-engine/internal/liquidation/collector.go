package liquidation

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
)

const defaultURL = "wss://fstream.binance.com/ws/!forceOrder@arr"

const (
	defaultPingInterval    = 4 * time.Minute
	defaultHeartbeatWindow = 10 * time.Minute
	stableConnectionWindow = 30 * time.Second
)

type websocketDialer interface {
	DialContext(context.Context, string, http.Header) (*websocket.Conn, *http.Response, error)
}

type event struct {
	Symbol   string
	Side     string
	Notional float64
	At       time.Time
}

type Collector struct {
	url                           string
	logger                        *slog.Logger
	mu                            sync.RWMutex
	events                        map[string][]event
	now                           func() time.Time
	dialer                        websocketDialer
	pingInterval, heartbeatWindow time.Duration
}

func New(url string, logger *slog.Logger) *Collector {
	if strings.TrimSpace(url) == "" {
		url = defaultURL
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Collector{url: url, logger: logger, events: make(map[string][]event), now: time.Now,
		dialer: websocket.DefaultDialer, pingInterval: defaultPingInterval, heartbeatWindow: defaultHeartbeatWindow}
}

func (c *Collector) Run(ctx context.Context) {
	backoff := time.Second
	for ctx.Err() == nil {
		connectedAt := time.Now()
		if err := c.consume(ctx); err != nil && ctx.Err() == nil {
			c.logger.Warn("Binance liquidation stream disconnected", "error", err)
		}
		connectedFor := time.Since(connectedAt)
		delay := backoff
		if connectedFor >= stableConnectionWindow {
			delay = time.Second
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
		backoff = nextReconnectBackoff(backoff, connectedFor)
	}
}

func nextReconnectBackoff(current, connectedFor time.Duration) time.Duration {
	if connectedFor >= stableConnectionWindow {
		return time.Second
	}
	return time.Duration(math.Min(float64(30*time.Second), float64(current*2)))
}

func (c *Collector) consume(ctx context.Context) error {
	connection, response, err := c.dialer.DialContext(ctx, c.url, nil)
	if response != nil && response.Body != nil {
		_ = response.Body.Close()
	}
	if err != nil {
		return err
	}
	defer connection.Close()
	connection.SetReadLimit(1 << 20)
	_ = connection.SetReadDeadline(time.Now().Add(c.heartbeatWindow))
	connection.SetPongHandler(func(string) error { return connection.SetReadDeadline(time.Now().Add(c.heartbeatWindow)) })
	readError := make(chan error, 1)
	go func() {
		for {
			_, payload, readErr := connection.ReadMessage()
			if readErr != nil {
				readError <- readErr
				return
			}
			_ = connection.SetReadDeadline(time.Now().Add(c.heartbeatWindow))
			if parsed, parseErr := parse(payload); parseErr == nil {
				c.add(parsed)
			}
		}
	}()
	ping := time.NewTicker(c.pingInterval)
	defer ping.Stop()
	for {
		select {
		case <-ctx.Done():
			_ = connection.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "shutdown"), time.Now().Add(time.Second))
			return nil
		case err := <-readError:
			return err
		case <-ping.C:
			if err := connection.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)); err != nil {
				return err
			}
		}
	}
}

func (c *Collector) add(value event) {
	c.mu.Lock()
	defer c.mu.Unlock()
	cutoff := c.now().Add(-10 * time.Minute)
	items := append(c.events[value.Symbol], value)
	kept := items[:0]
	for _, item := range items {
		if item.At.After(cutoff) {
			kept = append(kept, item)
		}
	}
	c.events[value.Symbol] = kept
}

func (c *Collector) LiquidationContext(_ context.Context, symbol string, now time.Time) (bot.LiquidationContext, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	cutoff := now.Add(-5 * time.Minute)
	buy, sell, count := 0.0, 0.0, 0
	for _, item := range c.events[strings.ToUpper(symbol)] {
		if item.At.Before(cutoff) {
			continue
		}
		count++
		if item.Side == "BUY" {
			buy += item.Notional
		} else {
			sell += item.Notional
		}
	}
	total := buy + sell
	if count == 0 || total <= 0 {
		return bot.LiquidationContext{Source: "BINANCE_FORCE_ORDER_STREAM"}, nil
	}
	pressure := (buy - sell) / total
	return bot.LiquidationContext{Available: true, Source: "BINANCE_FORCE_ORDER_STREAM", WindowSeconds: 300, EventCount: count,
		BuyNotional: buy, SellNotional: sell, Pressure: pressure, Cluster: count >= 3 && total >= 10_000, ObservedAt: now.UTC().Format(time.RFC3339)}, nil
}

func parse(payload []byte) (event, error) {
	var envelope struct {
		Event string `json:"e"`
		Time  int64  `json:"E"`
		Order struct {
			Symbol         string `json:"s"`
			Side           string `json:"S"`
			Quantity       string `json:"q"`
			Price          string `json:"p"`
			AveragePrice   string `json:"ap"`
			FilledQuantity string `json:"z"`
			TradeTime      int64  `json:"T"`
		} `json:"o"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return event{}, err
	}
	if envelope.Event != "forceOrder" || envelope.Order.Symbol == "" || (envelope.Order.Side != "BUY" && envelope.Order.Side != "SELL") {
		return event{}, errors.New("invalid liquidation event")
	}
	priceText := envelope.Order.AveragePrice
	if priceText == "" || priceText == "0" {
		priceText = envelope.Order.Price
	}
	quantityText := envelope.Order.FilledQuantity
	if quantityText == "" || quantityText == "0" {
		quantityText = envelope.Order.Quantity
	}
	price, priceErr := strconv.ParseFloat(priceText, 64)
	quantity, quantityErr := strconv.ParseFloat(quantityText, 64)
	if priceErr != nil || quantityErr != nil || price <= 0 || quantity <= 0 {
		return event{}, errors.New("invalid liquidation notional")
	}
	timestamp := envelope.Order.TradeTime
	if timestamp == 0 {
		timestamp = envelope.Time
	}
	return event{Symbol: strings.ToUpper(envelope.Order.Symbol), Side: envelope.Order.Side, Notional: price * quantity, At: time.UnixMilli(timestamp).UTC()}, nil
}
