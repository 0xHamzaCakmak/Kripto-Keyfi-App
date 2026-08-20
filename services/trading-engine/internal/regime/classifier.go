package regime

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"time"
)

type Type string

const (
	TrendingUp     Type = "TRENDING_UP"
	TrendingDown   Type = "TRENDING_DOWN"
	Ranging        Type = "RANGING"
	Breakout       Type = "BREAKOUT"
	HighVolatility Type = "HIGH_VOLATILITY"
	LowVolatility  Type = "LOW_VOLATILITY"
	Chaotic        Type = "CHAOTIC"
	Unknown        Type = "UNKNOWN"
)

type Config struct {
	TrendThreshold          float64
	BreakoutThreshold       float64
	HighVolatilityThreshold float64
	LowVolatilityThreshold  float64
	ChaosNoiseThreshold     float64
	ChaosTrendMaximum       float64
}

func DefaultConfig() Config {
	return Config{
		TrendThreshold: .01, BreakoutThreshold: .03, HighVolatilityThreshold: .05,
		LowVolatilityThreshold: .005, ChaosNoiseThreshold: .70, ChaosTrendMaximum: .005,
	}
}

type Features struct {
	TrendReturn      *float64 `json:"trendReturn"`
	Volatility       *float64 `json:"volatility"`
	BreakoutStrength *float64 `json:"breakoutStrength"`
	NoiseRatio       *float64 `json:"noiseRatio"`
}

type Classification struct {
	Regime     Type
	Confidence float64
	Features   Features
}

type Classifier struct{ config Config }

func NewClassifier(config Config) (*Classifier, error) {
	values := []float64{config.TrendThreshold, config.BreakoutThreshold, config.HighVolatilityThreshold, config.LowVolatilityThreshold, config.ChaosNoiseThreshold, config.ChaosTrendMaximum}
	for _, value := range values {
		if value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
			return nil, errors.New("regime classifier thresholds must be positive and finite")
		}
	}
	if config.LowVolatilityThreshold >= config.HighVolatilityThreshold || config.ChaosNoiseThreshold > 1 {
		return nil, errors.New("regime classifier thresholds are inconsistent")
	}
	return &Classifier{config: config}, nil
}

func (classifier *Classifier) Classify(features Features) Classification {
	if !validFeatures(features) {
		return Classification{Regime: Unknown, Confidence: 0, Features: features}
	}
	trend, volatility, breakout, noise := *features.TrendReturn, *features.Volatility, *features.BreakoutStrength, *features.NoiseRatio
	absTrend := math.Abs(trend)
	switch {
	case noise >= classifier.config.ChaosNoiseThreshold && volatility >= classifier.config.HighVolatilityThreshold*.8 && absTrend <= classifier.config.ChaosTrendMaximum:
		return result(Chaotic, noise/classifier.config.ChaosNoiseThreshold, features)
	case volatility >= classifier.config.HighVolatilityThreshold:
		return result(HighVolatility, volatility/classifier.config.HighVolatilityThreshold, features)
	case math.Abs(breakout) >= classifier.config.BreakoutThreshold:
		return result(Breakout, math.Abs(breakout)/classifier.config.BreakoutThreshold, features)
	case trend >= classifier.config.TrendThreshold:
		return result(TrendingUp, trend/classifier.config.TrendThreshold, features)
	case trend <= -classifier.config.TrendThreshold:
		return result(TrendingDown, -trend/classifier.config.TrendThreshold, features)
	case volatility <= classifier.config.LowVolatilityThreshold:
		return result(LowVolatility, classifier.config.LowVolatilityThreshold/math.Max(volatility, .000000001), features)
	default:
		return result(Ranging, 1-absTrend/classifier.config.TrendThreshold, features)
	}
}

func validFeatures(features Features) bool {
	values := []*float64{features.TrendReturn, features.Volatility, features.BreakoutStrength, features.NoiseRatio}
	for _, value := range values {
		if value == nil || math.IsNaN(*value) || math.IsInf(*value, 0) {
			return false
		}
	}
	return *features.Volatility >= 0 && *features.NoiseRatio >= 0 && *features.NoiseRatio <= 1
}
func result(regime Type, confidence float64, features Features) Classification {
	confidence = math.Max(0, math.Min(1, confidence))
	return Classification{Regime: regime, Confidence: math.Round(confidence*10000) / 10000, Features: features}
}

type Snapshot struct {
	ID                uint64
	Symbol, Timeframe string
	Classification    Classification
	ObservedAt        time.Time
}
type SnapshotStore interface {
	SaveMarketRegimeSnapshot(context.Context, Snapshot, []byte) (uint64, error)
}

type Service struct {
	classifier *Classifier
	store      SnapshotStore
}

func NewService(classifier *Classifier, store SnapshotStore) (*Service, error) {
	if classifier == nil || store == nil {
		return nil, errors.New("regime classifier and store are required")
	}
	return &Service{classifier: classifier, store: store}, nil
}
func (service *Service) ClassifyAndSave(ctx context.Context, symbol, timeframe string, observedAt time.Time, features Features) (Snapshot, error) {
	if symbol == "" || timeframe == "" || observedAt.IsZero() {
		return Snapshot{}, errors.New("regime snapshot identity is required")
	}
	classification := service.classifier.Classify(features)
	payload, err := json.Marshal(features)
	if err != nil {
		return Snapshot{}, err
	}
	snapshot := Snapshot{Symbol: symbol, Timeframe: timeframe, Classification: classification, ObservedAt: observedAt.UTC()}
	id, err := service.store.SaveMarketRegimeSnapshot(ctx, snapshot, payload)
	if err != nil {
		return Snapshot{}, err
	}
	snapshot.ID = id
	return snapshot, nil
}
