package scoring

import (
	"errors"
	"math"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/performance"
)

type Weights struct {
	Return, ProfitFactor, Sharpe, Sortino, Expectancy, Consistency float64
	Drawdown, Turnover, Liquidation, Instability, Cost             float64
}

type Config struct {
	Weights              Weights
	MinimumTrades        int
	ReturnTarget         float64
	ProfitFactorTarget   float64
	SharpeTarget         float64
	SortinoTarget        float64
	ExpectancyRateTarget float64
	TurnoverFree         float64
	TurnoverMaximum      float64
	DrawdownMaximum      float64
	LiquidationMaximum   int
	InstabilityMaximum   float64
	CostRateMaximum      float64
}

func DefaultConfig() Config {
	return Config{
		Weights: Weights{
			Return: 20, ProfitFactor: 12, Sharpe: 12, Sortino: 8, Expectancy: 10, Consistency: 8,
			Drawdown: 15, Turnover: 4, Liquidation: 15, Instability: 8, Cost: 8,
		},
		MinimumTrades: 50, ReturnTarget: .20, ProfitFactorTarget: 2, SharpeTarget: 2,
		SortinoTarget: 3, ExpectancyRateTarget: .01, TurnoverFree: 5, TurnoverMaximum: 50,
		DrawdownMaximum: .30, LiquidationMaximum: 2, InstabilityMaximum: .10, CostRateMaximum: .10,
	}
}

type Input struct {
	Metrics           performance.Metrics
	LiquidationCount  int
	ReturnInstability float64
}

type Component struct {
	Normalized   float64 `json:"normalized"`
	Weight       float64 `json:"weight"`
	Contribution float64 `json:"contribution"`
}

type Breakdown struct {
	Positive         map[string]Component `json:"positive"`
	Penalties        map[string]Component `json:"penalties"`
	PositiveTotal    float64              `json:"positiveTotal"`
	PenaltyTotal     float64              `json:"penaltyTotal"`
	RawScore         float64              `json:"rawScore"`
	SampleConfidence float64              `json:"sampleConfidence"`
	FinalScore       float64              `json:"finalScore"`
}

func Calculate(config Config, input Input) (Breakdown, error) {
	if err := validateConfig(config); err != nil {
		return Breakdown{}, err
	}
	if input.LiquidationCount < 0 || !finiteNonNegative(input.ReturnInstability) {
		return Breakdown{}, errors.New("scoring risk inputs are invalid")
	}
	metrics := input.Metrics
	if metrics.StartingBalance <= 0 || metrics.TotalTrades < 0 || metrics.Wins < 0 || metrics.Losses < 0 ||
		metrics.Wins+metrics.Losses > metrics.TotalTrades || metrics.WinRate < 0 || metrics.WinRate > 1 ||
		metrics.MaxDrawdown < 0 || metrics.Turnover < 0 || metrics.FeeCost < 0 || metrics.SlippageCost < 0 ||
		metrics.MaxConsecutiveLosses < 0 || metrics.MaxConsecutiveLosses > metrics.TotalTrades || !metricsFinite(metrics) {
		return Breakdown{}, errors.New("scoring metrics are invalid")
	}
	profitFactor := optionalPositive(metrics.ProfitFactor)
	sharpe := optionalPositive(metrics.Sharpe)
	sortino := optionalPositive(metrics.Sortino)
	expectancyRate := metrics.Expectancy / metrics.StartingBalance
	consistency := consistencyScore(metrics)
	costRate := (metrics.FeeCost + math.Max(0, metrics.FundingCost) + metrics.SlippageCost) / metrics.StartingBalance

	positiveValues := map[string]struct{ value, weight float64 }{
		"return":       {clamp(metrics.ROI / config.ReturnTarget), config.Weights.Return},
		"profitFactor": {clamp((profitFactor - 1) / (config.ProfitFactorTarget - 1)), config.Weights.ProfitFactor},
		"sharpe":       {clamp(sharpe / config.SharpeTarget), config.Weights.Sharpe},
		"sortino":      {clamp(sortino / config.SortinoTarget), config.Weights.Sortino},
		"expectancy":   {clamp(expectancyRate / config.ExpectancyRateTarget), config.Weights.Expectancy},
		"consistency":  {consistency, config.Weights.Consistency},
	}
	penaltyValues := map[string]struct{ value, weight float64 }{
		"drawdown":    {clamp(metrics.MaxDrawdown / config.DrawdownMaximum), config.Weights.Drawdown},
		"turnover":    {clamp((metrics.Turnover - config.TurnoverFree) / (config.TurnoverMaximum - config.TurnoverFree)), config.Weights.Turnover},
		"liquidation": {clamp(float64(input.LiquidationCount) / float64(config.LiquidationMaximum)), config.Weights.Liquidation},
		"instability": {clamp(input.ReturnInstability / config.InstabilityMaximum), config.Weights.Instability},
		"cost":        {clamp(costRate / config.CostRateMaximum), config.Weights.Cost},
	}
	result := Breakdown{Positive: make(map[string]Component), Penalties: make(map[string]Component)}
	positiveWeight := 0.0
	for name, item := range positiveValues {
		component := Component{Normalized: item.value, Weight: item.weight, Contribution: item.value * item.weight}
		result.Positive[name] = component
		result.PositiveTotal += component.Contribution
		positiveWeight += item.weight
	}
	for name, item := range penaltyValues {
		component := Component{Normalized: item.value, Weight: item.weight, Contribution: item.value * item.weight}
		result.Penalties[name] = component
		result.PenaltyTotal += component.Contribution
	}
	result.RawScore = clamp((result.PositiveTotal-result.PenaltyTotal)/positiveWeight) * 100
	result.SampleConfidence = clamp(float64(metrics.TotalTrades) / float64(config.MinimumTrades))
	result.FinalScore = round(clamp(result.RawScore/100)*result.SampleConfidence*100, 4)
	result.RawScore = round(result.RawScore, 4)
	result.PositiveTotal, result.PenaltyTotal = round(result.PositiveTotal, 4), round(result.PenaltyTotal, 4)
	return result, nil
}

func validateConfig(config Config) error {
	weights := []float64{
		config.Weights.Return, config.Weights.ProfitFactor, config.Weights.Sharpe, config.Weights.Sortino,
		config.Weights.Expectancy, config.Weights.Consistency, config.Weights.Drawdown, config.Weights.Turnover,
		config.Weights.Liquidation, config.Weights.Instability, config.Weights.Cost,
	}
	positiveWeight := 0.0
	for index, weight := range weights {
		if !finiteNonNegative(weight) {
			return errors.New("scoring weights must be finite and non-negative")
		}
		if index < 6 {
			positiveWeight += weight
		}
	}
	if positiveWeight <= 0 || config.MinimumTrades <= 0 || config.LiquidationMaximum <= 0 {
		return errors.New("scoring evidence and positive weights must be greater than zero")
	}
	thresholds := []float64{
		config.ReturnTarget, config.ProfitFactorTarget - 1, config.SharpeTarget, config.SortinoTarget,
		config.ExpectancyRateTarget, config.TurnoverMaximum - config.TurnoverFree,
		config.DrawdownMaximum, config.InstabilityMaximum, config.CostRateMaximum,
	}
	for _, threshold := range thresholds {
		if !finitePositive(threshold) {
			return errors.New("scoring normalization thresholds must be positive")
		}
	}
	return nil
}

func consistencyScore(metrics performance.Metrics) float64 {
	if metrics.TotalTrades == 0 {
		return 0
	}
	streakPenalty := float64(metrics.MaxConsecutiveLosses) / float64(metrics.TotalTrades)
	return clamp(metrics.WinRate * (1 - clamp(streakPenalty)))
}
func optionalPositive(value *float64) float64 {
	if value == nil || *value <= 0 || math.IsNaN(*value) || math.IsInf(*value, 0) {
		return 0
	}
	return *value
}
func clamp(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}
func finitePositive(value float64) bool {
	return value > 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}
func finiteNonNegative(value float64) bool {
	return value >= 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}
func metricsFinite(metrics performance.Metrics) bool {
	values := []float64{metrics.StartingBalance, metrics.ROI, metrics.Expectancy, metrics.WinRate, metrics.MaxDrawdown, metrics.Turnover, metrics.FeeCost, metrics.FundingCost, metrics.SlippageCost}
	for _, value := range values {
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return false
		}
	}
	return true
}
func round(value float64, decimals int) float64 {
	factor := math.Pow10(decimals)
	return math.Round(value*factor) / factor
}
