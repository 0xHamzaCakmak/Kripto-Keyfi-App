package performance

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

type Snapshot struct {
	TradingBotID           string
	StrategyVersionID      string
	MarketRegimeSnapshotID *uint64
	Metrics                Metrics
	SnapshotAt             time.Time
}

type SnapshotStore interface {
	SaveBotMetric(context.Context, Snapshot, []byte) error
}

type Service struct {
	store SnapshotStore
	now   func() time.Time
}

func NewService(store SnapshotStore) (*Service, error) {
	if store == nil {
		return nil, errors.New("performance snapshot store is required")
	}
	return &Service{store: store, now: time.Now}, nil
}

func (service *Service) ComputeAndSave(ctx context.Context, botID, strategyVersionID string, regimeID *uint64, input Input) (Snapshot, error) {
	if botID == "" {
		return Snapshot{}, errors.New("performance bot id is required")
	}
	metrics, err := Compute(input)
	if err != nil {
		return Snapshot{}, err
	}
	payload, err := json.Marshal(metrics)
	if err != nil {
		return Snapshot{}, err
	}
	snapshot := Snapshot{
		TradingBotID: botID, StrategyVersionID: strategyVersionID, MarketRegimeSnapshotID: regimeID,
		Metrics: metrics, SnapshotAt: service.now().UTC(),
	}
	if err := service.store.SaveBotMetric(ctx, snapshot, payload); err != nil {
		return Snapshot{}, err
	}
	return snapshot, nil
}
