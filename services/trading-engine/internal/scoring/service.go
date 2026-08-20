package scoring

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

type ScoreStore interface {
	SaveBotScore(context.Context, string, time.Time, float64, []byte) error
}

type Service struct {
	config Config
	store  ScoreStore
}

func NewService(config Config, store ScoreStore) (*Service, error) {
	if store == nil {
		return nil, errors.New("bot score store is required")
	}
	if err := validateConfig(config); err != nil {
		return nil, err
	}
	return &Service{config: config, store: store}, nil
}

func (service *Service) CalculateAndSave(ctx context.Context, botID string, snapshotAt time.Time, input Input) (Breakdown, error) {
	if botID == "" || snapshotAt.IsZero() {
		return Breakdown{}, errors.New("bot score snapshot identity is required")
	}
	breakdown, err := Calculate(service.config, input)
	if err != nil {
		return Breakdown{}, err
	}
	payload, err := json.Marshal(breakdown)
	if err != nil {
		return Breakdown{}, err
	}
	if err := service.store.SaveBotScore(ctx, botID, snapshotAt, breakdown.FinalScore, payload); err != nil {
		return Breakdown{}, err
	}
	return breakdown, nil
}
