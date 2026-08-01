package realtime

import (
	"context"
	"testing"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type recordingStore struct{ events []domain.OutboxEvent }

func (s *recordingStore) ListRealtimeAccounts(context.Context) ([]account.Resolved, error) {
	return nil, nil
}
func (s *recordingStore) AppendOutboxEvent(_ context.Context, event domain.OutboxEvent) error {
	s.events = append(s.events, event)
	return nil
}

func TestBinanceOrderUpdateIsNormalized(t *testing.T) {
	store := &recordingStore{}
	stream := &binanceStream{resolved: testResolvedAccount(), store: store}
	message := []byte(`{"e":"ORDER_TRADE_UPDATE","E":1700000000000,"T":1700000000001,"o":{"s":"ADAUSDT","c":"kk_test","S":"BUY","o":"LIMIT","x":"NEW","X":"NEW","i":42,"q":"36","z":"0","p":"0.1669","sp":"0","R":false,"ps":"BOTH"}}`)

	if err := stream.handleMessage(t.Context(), message); err != nil {
		t.Fatal(err)
	}
	if len(store.events) != 1 || store.events[0].EventType != "ORDER_UPDATED" || store.events[0].AggregateID != "42" {
		t.Fatalf("unexpected normalized event: %#v", store.events)
	}
	payload := store.events[0].Payload.(map[string]any)
	order := payload["order"].(map[string]any)
	if order["symbol"] != "ADAUSDT" || order["status"] != "NEW" || order["clientOrderId"] != "kk_test" {
		t.Fatalf("unexpected order payload: %#v", order)
	}
}

func TestBinanceAccountUpdateIsNormalized(t *testing.T) {
	store := &recordingStore{}
	stream := &binanceStream{resolved: testResolvedAccount(), store: store}
	message := []byte(`{"e":"ACCOUNT_UPDATE","E":1700000000000,"T":1700000000001,"a":{"m":"ORDER","B":[{"a":"USDT","wb":"100","cw":"90","bc":"0"}],"P":[{"s":"ADAUSDT","pa":"38","ep":"0.17","bep":"0.17","cr":"0","up":"0.1","mt":"isolated","iw":"3.2","ps":"BOTH"}]}}`)

	if err := stream.handleMessage(t.Context(), message); err != nil {
		t.Fatal(err)
	}
	if len(store.events) != 1 || store.events[0].EventType != "POSITION_UPDATED" {
		t.Fatalf("unexpected normalized event: %#v", store.events)
	}
	payload := store.events[0].Payload.(map[string]any)
	if payload["reason"] != "ORDER" {
		t.Fatalf("unexpected account payload: %#v", payload)
	}
}

func TestListenKeyExpiryPersistsBeforeReconnect(t *testing.T) {
	store := &recordingStore{}
	stream := &binanceStream{resolved: testResolvedAccount(), store: store}
	if err := stream.handleMessage(t.Context(), []byte(`{"e":"listenKeyExpired","E":1700000000000}`)); err == nil {
		t.Fatal("expected reconnect error")
	}
	if len(store.events) != 1 || store.events[0].EventType != "LISTEN_KEY_EXPIRED" {
		t.Fatalf("expiry event was not persisted: %#v", store.events)
	}
}

func testResolvedAccount() account.Resolved {
	return account.Resolved{Reference: domain.ExchangeAccountRef{
		ID: "account-1", UserID: "user-1", Provider: domain.ProviderBinance,
		Environment: domain.EnvironmentTestnet, AccountType: domain.AccountTypeUSDTM,
	}}
}
