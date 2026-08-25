package bot

import (
	"errors"
	"math"
	"strconv"
	"strings"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type MarketSnapshot struct {
	Candles                map[string][]domain.MarketCandle
	Derivatives            domain.DerivativesContext
	DerivativesUnavailable bool
	News                   NewsContext
	Liquidations           LiquidationContext
}

type LiquidationContext struct {
	Available                           bool
	Source, ObservedAt                  string
	WindowSeconds, EventCount           int
	BuyNotional, SellNotional, Pressure float64
	Cluster                             bool
}

type NewsContext struct {
	Available  bool
	Bias       string
	Score      float64
	Confidence float64
	ArticleIDs []string
	ObservedAt string
}

type MarketAnalysis struct {
	Regime, Direction, HigherDirection, MiddleDirection, LowerDirection   string
	HigherTimeframeAligned, DerivativesAligned, OIConfirmed               bool
	ConfirmedTimeframes                                                   int
	RegimeConfidence, ADX15M, ADX1H, ATRExpansion, ATRBps15m, FundingRate float64
}

func AnalyzeMarket(snapshot MarketSnapshot, side string) (MarketAnalysis, error) {
	required := map[string]int{"15m": 193, "1h": 49}
	series := make(map[string][]float64, len(required))
	for interval, minimum := range required {
		candles := snapshot.Candles[interval]
		if len(candles) < minimum {
			return MarketAnalysis{}, errors.New("15m/1h market history is incomplete for the 24h/48h direction windows")
		}
		values := make([]float64, len(candles))
		for index, candle := range candles {
			parsed, err := strconv.ParseFloat(string(candle.Close), 64)
			if err != nil || parsed <= 0 {
				return MarketAnalysis{}, errors.New("multi-timeframe close is invalid")
			}
			values[index] = parsed
		}
		series[interval] = values
	}
	adx15m, err := adx(snapshot.Candles["15m"], 14)
	if err != nil {
		return MarketAnalysis{}, err
	}
	adx1h, err := adx(snapshot.Candles["1h"], 14)
	if err != nil {
		return MarketAnalysis{}, err
	}
	direction24h := directionalConsensus(windowDirection(series["15m"], 96, 5), windowDirection(series["1h"], 24, 5))
	direction48h := directionalConsensus(windowDirection(series["15m"], 192, 5), windowDirection(series["1h"], 48, 5))
	entryDirection15m := emaDirection(series["15m"], 9, 21)
	atrExpansion, err := atrExpansion(snapshot.Candles["15m"], 20)
	if err != nil {
		return MarketAnalysis{}, err
	}
	atrBps15m, err := normalizedATRBps(snapshot.Candles["15m"], 14)
	if err != nil {
		return MarketAnalysis{}, err
	}
	regime := "UNCERTAIN"
	confidence := math.Min(adx15m, adx1h) / 50
	if atrExpansion > 1.5 {
		regime = "HIGH_VOLATILITY"
	} else if direction24h != "NEUTRAL" && direction24h == direction48h && adx15m > 25 && adx1h > 25 {
		regime = "TREND"
	} else if adx15m < 20 && adx1h < 20 && bandWidth(series["1h"], 24) <= 0.05 {
		regime = "RANGE"
	}
	direction := "BUY"
	if strings.ToUpper(side) == "SELL" {
		direction = "SELL"
	}
	confirmed := 0
	for _, vote := range []string{direction48h, direction24h, entryDirection15m} {
		if vote == direction {
			confirmed++
		}
	}
	funding, fundingOK := parseMarketDecimal(snapshot.Derivatives.FundingRate)
	oi, oiOK := parseMarketDecimal(snapshot.Derivatives.OpenInterest)
	previousOI, previousOK := parseMarketDecimal(snapshot.Derivatives.PreviousOpenInterest)
	derivativesAligned := fundingOK && oiOK && previousOK && oi > 0 && previousOI > 0
	if derivativesAligned && ((direction == "BUY" && funding > 0.001) || (direction == "SELL" && funding < -0.001)) {
		derivativesAligned = false
	}
	return MarketAnalysis{Regime: regime, Direction: direction, HigherDirection: direction48h, MiddleDirection: direction24h, LowerDirection: entryDirection15m,
		HigherTimeframeAligned: direction48h == direction, ConfirmedTimeframes: confirmed, DerivativesAligned: derivativesAligned,
		OIConfirmed: derivativesAligned && oi > previousOI, RegimeConfidence: math.Max(0, math.Min(1, confidence)),
		ADX15M: adx15m, ADX1H: adx1h, ATRExpansion: atrExpansion, ATRBps15m: atrBps15m, FundingRate: funding}, nil
}

func windowDirection(values []float64, bars int, neutralBps float64) string {
	if bars < 1 || len(values) <= bars {
		return "NEUTRAL"
	}
	start, end := values[len(values)-1-bars], values[len(values)-1]
	if start <= 0 {
		return "NEUTRAL"
	}
	changeBps := (end - start) / start * 10_000
	if changeBps > neutralBps {
		return "BUY"
	}
	if changeBps < -neutralBps {
		return "SELL"
	}
	return "NEUTRAL"
}

func directionalConsensus(left, right string) string {
	if left == right {
		return left
	}
	if left == "NEUTRAL" {
		return right
	}
	if right == "NEUTRAL" {
		return left
	}
	return "NEUTRAL"
}

func normalizedATRBps(candles []domain.MarketCandle, period int) (float64, error) {
	trueRangeValues, err := trueRanges(candles)
	if err != nil || len(trueRangeValues) < period {
		return 0, errors.New("ATR history is incomplete")
	}
	lastClose, ok := parseMarketDecimal(candles[len(candles)-1].Close)
	if !ok || lastClose <= 0 {
		return 0, errors.New("ATR normalization close is invalid")
	}
	total := 0.0
	for _, value := range trueRangeValues[len(trueRangeValues)-period:] {
		total += value
	}
	return total / float64(period) / lastClose * 10_000, nil
}

func emaDirection(values []float64, fastPeriod, slowPeriod int) string {
	fast, slow := ema(values, fastPeriod), ema(values, slowPeriod)
	if fast > slow {
		return "BUY"
	}
	if fast < slow {
		return "SELL"
	}
	return "NEUTRAL"
}

func consensus(left, right string) string {
	if left == right {
		return left
	}
	return "NEUTRAL"
}

func bandWidth(values []float64, count int) float64 {
	values = values[len(values)-count:]
	minimum, maximum := values[0], values[0]
	for _, value := range values[1:] {
		minimum = math.Min(minimum, value)
		maximum = math.Max(maximum, value)
	}
	midpoint := (maximum + minimum) / 2
	if midpoint <= 0 {
		return math.Inf(1)
	}
	return (maximum - minimum) / midpoint
}

func atrExpansion(candles []domain.MarketCandle, period int) (float64, error) {
	trueRanges, err := trueRanges(candles)
	if err != nil || len(trueRanges) < period+1 {
		return 0, errors.New("ATR history is incomplete")
	}
	average := 0.0
	for _, value := range trueRanges[len(trueRanges)-period-1 : len(trueRanges)-1] {
		average += value
	}
	average /= float64(period)
	if average <= 0 {
		// A genuinely flat/quantized market series is valid evidence, not a
		// corrupt feed. Treat it as non-expanding volatility; malformed candles
		// are already rejected by trueRanges above.
		return 1, nil
	}
	return trueRanges[len(trueRanges)-1] / average, nil
}

func adx(candles []domain.MarketCandle, period int) (float64, error) {
	if len(candles) < period*2+1 {
		return 0, errors.New("ADX history is incomplete")
	}
	trs, err := trueRanges(candles)
	if err != nil {
		return 0, err
	}
	dx := make([]float64, 0, len(candles)-period)
	for end := period; end < len(candles); end++ {
		trSum, plusSum, minusSum := 0.0, 0.0, 0.0
		for index := end - period + 1; index <= end; index++ {
			high, _ := parseMarketDecimal(candles[index].High)
			low, _ := parseMarketDecimal(candles[index].Low)
			previousHigh, _ := parseMarketDecimal(candles[index-1].High)
			previousLow, _ := parseMarketDecimal(candles[index-1].Low)
			up, down := high-previousHigh, previousLow-low
			if up > down && up > 0 {
				plusSum += up
			}
			if down > up && down > 0 {
				minusSum += down
			}
			trSum += trs[index-1]
		}
		if trSum == 0 {
			dx = append(dx, 0)
			continue
		}
		plusDI, minusDI := 100*plusSum/trSum, 100*minusSum/trSum
		denominator := plusDI + minusDI
		if denominator == 0 {
			dx = append(dx, 0)
		} else {
			dx = append(dx, 100*math.Abs(plusDI-minusDI)/denominator)
		}
	}
	count := period
	if len(dx) < count {
		count = len(dx)
	}
	total := 0.0
	for _, value := range dx[len(dx)-count:] {
		total += value
	}
	return total / float64(count), nil
}

func trueRanges(candles []domain.MarketCandle) ([]float64, error) {
	result := make([]float64, 0, len(candles)-1)
	for index := 1; index < len(candles); index++ {
		high, highOK := parseMarketDecimal(candles[index].High)
		low, lowOK := parseMarketDecimal(candles[index].Low)
		previous, closeOK := parseMarketDecimal(candles[index-1].Close)
		if !highOK || !lowOK || !closeOK || high < low {
			return nil, errors.New("market candle is invalid")
		}
		result = append(result, math.Max(high-low, math.Max(math.Abs(high-previous), math.Abs(low-previous))))
	}
	return result, nil
}

func parseMarketDecimal(value domain.Decimal) (float64, bool) {
	parsed, err := strconv.ParseFloat(string(value), 64)
	return parsed, err == nil && !math.IsNaN(parsed) && !math.IsInf(parsed, 0)
}
