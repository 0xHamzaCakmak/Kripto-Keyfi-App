package regime

import (
	"errors"
	"math"
	"sort"
	"strconv"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/performance"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/scoring"
)

type Trade struct {
	Regime      Type
	Performance performance.Trade
	Liquidated  bool
}
type Stats struct {
	Regime  Type
	Metrics performance.Metrics
	Score   scoring.Breakdown
}

func Aggregate(startingBalance string, trades []Trade, scoreConfig scoring.Config) (map[Type]Stats, error) {
	starting, err := strconv.ParseFloat(startingBalance, 64)
	if err != nil || starting <= 0 {
		return nil, errors.New("regime starting balance is invalid")
	}
	grouped := make(map[Type][]Trade)
	for _, trade := range trades {
		if !known(trade.Regime) {
			return nil, errors.New("trade regime is invalid")
		}
		grouped[trade.Regime] = append(grouped[trade.Regime], trade)
	}
	result := make(map[Type]Stats, len(grouped))
	for regimeType, items := range grouped {
		sort.SliceStable(items, func(i, j int) bool { return items[i].Performance.ClosedAt.Before(items[j].Performance.ClosedAt) })
		performanceTrades := make([]performance.Trade, 0, len(items))
		curve := make([]performance.EquityPoint, 0, len(items)+1)
		equity := starting
		liquidations := 0
		if len(items) > 0 {
			curve = append(curve, performance.EquityPoint{At: items[0].Performance.OpenedAt, Equity: strconv.FormatFloat(equity, 'g', -1, 64)})
		}
		for _, item := range items {
			pnl, parseErr := strconv.ParseFloat(item.Performance.NetPnL, 64)
			if parseErr != nil {
				return nil, errors.New("regime trade pnl is invalid")
			}
			equity += pnl
			performanceTrades = append(performanceTrades, item.Performance)
			curve = append(curve, performance.EquityPoint{At: item.Performance.ClosedAt, Equity: strconv.FormatFloat(equity, 'g', -1, 64)})
			if item.Liquidated {
				liquidations++
			}
		}
		metrics, computeErr := performance.Compute(performance.Input{StartingBalance: startingBalance, Trades: performanceTrades, EquityCurve: curve})
		if computeErr != nil {
			return nil, computeErr
		}
		score, scoreErr := scoring.Calculate(scoreConfig, scoring.Input{Metrics: metrics, LiquidationCount: liquidations, ReturnInstability: returnInstability(curve)})
		if scoreErr != nil {
			return nil, scoreErr
		}
		result[regimeType] = Stats{Regime: regimeType, Metrics: metrics, Score: score}
	}
	return result, nil
}

func known(value Type) bool {
	switch value {
	case TrendingUp, TrendingDown, Ranging, Breakout, HighVolatility, LowVolatility, Chaotic, Unknown:
		return true
	}
	return false
}
func returnInstability(curve []performance.EquityPoint) float64 {
	if len(curve) < 3 {
		return 0
	}
	returns := make([]float64, 0, len(curve)-1)
	for index := 1; index < len(curve); index++ {
		previous, _ := strconv.ParseFloat(curve[index-1].Equity, 64)
		current, _ := strconv.ParseFloat(curve[index].Equity, 64)
		returns = append(returns, current/previous-1)
	}
	mean := 0.0
	for _, value := range returns {
		mean += value
	}
	mean /= float64(len(returns))
	variance := 0.0
	for _, value := range returns {
		difference := value - mean
		variance += difference * difference
	}
	return math.Sqrt(variance / float64(len(returns)-1))
}
