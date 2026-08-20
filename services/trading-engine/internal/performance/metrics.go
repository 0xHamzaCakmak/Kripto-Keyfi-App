package performance

import (
	"errors"
	"math"
	"sort"
	"strconv"
	"time"
)

type Trade struct {
	NetPnL       string
	RiskAmount   string
	Notional     string
	Fees         string
	FundingCost  string
	SlippageCost string
	OpenedAt     time.Time
	ClosedAt     time.Time
}

type EquityPoint struct {
	At     time.Time
	Equity string
}

type Input struct {
	StartingBalance string
	UnrealizedPnL   string
	Trades          []Trade
	EquityCurve     []EquityPoint
	PeriodsPerYear  float64
}

type Metrics struct {
	StartingBalance       float64  `json:"startingBalance"`
	CurrentEquity         float64  `json:"currentEquity"`
	RealizedPnL           float64  `json:"realizedPnl"`
	UnrealizedPnL         float64  `json:"unrealizedPnl"`
	NetPnL                float64  `json:"netPnl"`
	ROI                   float64  `json:"roi"`
	TotalTrades           int      `json:"totalTrades"`
	Wins                  int      `json:"wins"`
	Losses                int      `json:"losses"`
	WinRate               float64  `json:"winRate"`
	AverageWin            float64  `json:"averageWin"`
	AverageLoss           float64  `json:"averageLoss"`
	Expectancy            float64  `json:"expectancy"`
	AverageRiskReward     *float64 `json:"averageRiskReward"`
	ProfitFactor          *float64 `json:"profitFactor"`
	MaxDrawdown           float64  `json:"maxDrawdown"`
	Sharpe                *float64 `json:"sharpe"`
	Sortino               *float64 `json:"sortino"`
	Calmar                *float64 `json:"calmar"`
	AverageHoldingSeconds float64  `json:"averageHoldingSeconds"`
	Turnover              float64  `json:"turnover"`
	FeeCost               float64  `json:"feeCost"`
	FundingCost           float64  `json:"fundingCost"`
	SlippageCost          float64  `json:"slippageCost"`
	MaxConsecutiveWins    int      `json:"maxConsecutiveWins"`
	MaxConsecutiveLosses  int      `json:"maxConsecutiveLosses"`
}

func Compute(input Input) (Metrics, error) {
	starting, err := finiteDecimal(input.StartingBalance)
	if err != nil || starting <= 0 {
		return Metrics{}, errors.New("starting balance must be a positive finite decimal")
	}
	unrealized := 0.0
	if input.UnrealizedPnL != "" {
		unrealized, err = finiteDecimal(input.UnrealizedPnL)
		if err != nil {
			return Metrics{}, errors.New("unrealized pnl must be a finite decimal")
		}
	}
	metrics := Metrics{StartingBalance: starting, TotalTrades: len(input.Trades)}
	var realized, winsTotal, lossesTotal, holdingTotal, riskRewardTotal float64
	var riskRewardCount, currentWins, currentLosses int
	for _, trade := range input.Trades {
		pnl, parseErr := finiteDecimal(trade.NetPnL)
		if parseErr != nil {
			return Metrics{}, errors.New("trade pnl must be a finite decimal")
		}
		notional, parseErr := nonNegativeDecimal(trade.Notional)
		if parseErr != nil {
			return Metrics{}, errors.New("trade notional must be a non-negative finite decimal")
		}
		fees, parseErr := nonNegativeDecimal(trade.Fees)
		if parseErr != nil {
			return Metrics{}, errors.New("trade fees must be a non-negative finite decimal")
		}
		funding, parseErr := finiteDecimal(trade.FundingCost)
		if parseErr != nil {
			return Metrics{}, errors.New("trade funding must be a finite decimal")
		}
		slippage, parseErr := nonNegativeDecimal(trade.SlippageCost)
		if parseErr != nil {
			return Metrics{}, errors.New("trade slippage must be a non-negative finite decimal")
		}
		if trade.OpenedAt.IsZero() || trade.ClosedAt.Before(trade.OpenedAt) {
			return Metrics{}, errors.New("trade holding period is invalid")
		}
		realized += pnl
		metrics.Turnover += notional
		metrics.FeeCost += fees
		metrics.FundingCost += funding
		metrics.SlippageCost += slippage
		holdingTotal += trade.ClosedAt.Sub(trade.OpenedAt).Seconds()
		switch {
		case pnl > 0:
			metrics.Wins++
			winsTotal += pnl
			currentWins++
			currentLosses = 0
			if currentWins > metrics.MaxConsecutiveWins {
				metrics.MaxConsecutiveWins = currentWins
			}
		case pnl < 0:
			metrics.Losses++
			lossesTotal += pnl
			currentLosses++
			currentWins = 0
			if currentLosses > metrics.MaxConsecutiveLosses {
				metrics.MaxConsecutiveLosses = currentLosses
			}
		default:
			currentWins, currentLosses = 0, 0
		}
		if trade.RiskAmount != "" {
			risk, riskErr := finiteDecimal(trade.RiskAmount)
			if riskErr != nil || risk <= 0 {
				return Metrics{}, errors.New("trade risk amount must be positive when present")
			}
			riskRewardTotal += pnl / risk
			riskRewardCount++
		}
	}
	metrics.CurrentEquity = starting + realized + unrealized
	metrics.RealizedPnL = realized
	metrics.UnrealizedPnL = unrealized
	metrics.NetPnL = metrics.CurrentEquity - starting
	metrics.ROI = metrics.NetPnL / starting
	if metrics.TotalTrades > 0 {
		metrics.WinRate = float64(metrics.Wins) / float64(metrics.TotalTrades)
		metrics.Expectancy = realized / float64(metrics.TotalTrades)
		metrics.AverageHoldingSeconds = holdingTotal / float64(metrics.TotalTrades)
	}
	if metrics.Wins > 0 {
		metrics.AverageWin = winsTotal / float64(metrics.Wins)
	}
	if metrics.Losses > 0 {
		metrics.AverageLoss = lossesTotal / float64(metrics.Losses)
	}
	if lossesTotal < 0 {
		metrics.ProfitFactor = pointer(winsTotal / math.Abs(lossesTotal))
	}
	if riskRewardCount > 0 {
		metrics.AverageRiskReward = pointer(riskRewardTotal / float64(riskRewardCount))
	}
	metrics.Turnover /= starting

	curve, err := normalizedCurve(input.EquityCurve)
	if err != nil {
		return Metrics{}, err
	}
	if len(curve) > 0 {
		metrics.MaxDrawdown = maxDrawdown(curve)
		returns := periodicReturns(curve)
		periods := input.PeriodsPerYear
		if periods <= 0 {
			periods = 365
		}
		metrics.Sharpe = sharpe(returns, periods)
		metrics.Sortino = sortino(returns, periods)
		metrics.Calmar = calmar(curve, metrics.MaxDrawdown)
	}
	if !metricsAreFinite(metrics) {
		return Metrics{}, errors.New("performance calculation overflowed finite bounds")
	}
	return metrics, nil
}

func metricsAreFinite(metrics Metrics) bool {
	values := []float64{
		metrics.StartingBalance, metrics.CurrentEquity, metrics.RealizedPnL, metrics.UnrealizedPnL,
		metrics.NetPnL, metrics.ROI, metrics.WinRate, metrics.AverageWin, metrics.AverageLoss,
		metrics.Expectancy, metrics.MaxDrawdown, metrics.AverageHoldingSeconds, metrics.Turnover,
		metrics.FeeCost, metrics.FundingCost, metrics.SlippageCost,
	}
	for _, value := range values {
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return false
		}
	}
	return true
}

func normalizedCurve(points []EquityPoint) ([]EquityPoint, error) {
	curve := append([]EquityPoint(nil), points...)
	sort.SliceStable(curve, func(i, j int) bool { return curve[i].At.Before(curve[j].At) })
	for index, point := range curve {
		equity, err := finiteDecimal(point.Equity)
		if err != nil || equity <= 0 || point.At.IsZero() {
			return nil, errors.New("equity curve points must be positive and timestamped")
		}
		curve[index].Equity = strconv.FormatFloat(equity, 'g', -1, 64)
		if index > 0 && !point.At.After(curve[index-1].At) {
			return nil, errors.New("equity curve timestamps must be unique")
		}
	}
	return curve, nil
}

func maxDrawdown(curve []EquityPoint) float64 {
	peak, _ := finiteDecimal(curve[0].Equity)
	maximum := 0.0
	for _, point := range curve {
		equity, _ := finiteDecimal(point.Equity)
		if equity > peak {
			peak = equity
		}
		drawdown := (peak - equity) / peak
		if drawdown > maximum {
			maximum = drawdown
		}
	}
	return maximum
}

func periodicReturns(curve []EquityPoint) []float64 {
	if len(curve) < 2 {
		return nil
	}
	returns := make([]float64, 0, len(curve)-1)
	for index := 1; index < len(curve); index++ {
		previous, _ := finiteDecimal(curve[index-1].Equity)
		current, _ := finiteDecimal(curve[index].Equity)
		returns = append(returns, current/previous-1)
	}
	return returns
}

func sharpe(returns []float64, periods float64) *float64 {
	if len(returns) < 2 {
		return nil
	}
	mean, deviation := meanAndSampleDeviation(returns)
	if deviation == 0 {
		return nil
	}
	return finitePointer(mean / deviation * math.Sqrt(periods))
}

func sortino(returns []float64, periods float64) *float64 {
	if len(returns) < 2 {
		return nil
	}
	mean := average(returns)
	downsideSquares := 0.0
	downsideCount := 0
	for _, value := range returns {
		if value < 0 {
			downsideSquares += value * value
			downsideCount++
		}
	}
	if downsideCount == 0 {
		return nil
	}
	downsideDeviation := math.Sqrt(downsideSquares / float64(downsideCount))
	if downsideDeviation == 0 {
		return nil
	}
	return finitePointer(mean / downsideDeviation * math.Sqrt(periods))
}

func calmar(curve []EquityPoint, drawdown float64) *float64 {
	if len(curve) < 2 || drawdown <= 0 {
		return nil
	}
	duration := curve[len(curve)-1].At.Sub(curve[0].At)
	if duration <= 0 {
		return nil
	}
	start, _ := finiteDecimal(curve[0].Equity)
	end, _ := finiteDecimal(curve[len(curve)-1].Equity)
	years := duration.Hours() / (24 * 365)
	if years <= 0 || start <= 0 || end <= 0 {
		return nil
	}
	annualized := math.Pow(end/start, 1/years) - 1
	return finitePointer(annualized / drawdown)
}

func meanAndSampleDeviation(values []float64) (float64, float64) {
	mean := average(values)
	squares := 0.0
	for _, value := range values {
		difference := value - mean
		squares += difference * difference
	}
	return mean, math.Sqrt(squares / float64(len(values)-1))
}
func average(values []float64) float64 {
	total := 0.0
	for _, value := range values {
		total += value
	}
	return total / float64(len(values))
}
func finiteDecimal(value string) (float64, error) {
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		return 0, errors.New("invalid finite decimal")
	}
	return parsed, nil
}
func nonNegativeDecimal(value string) (float64, error) {
	parsed, err := finiteDecimal(value)
	if err != nil || parsed < 0 {
		return 0, errors.New("invalid non-negative decimal")
	}
	return parsed, nil
}
func pointer(value float64) *float64 { return &value }
func finitePointer(value float64) *float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil
	}
	return &value
}
