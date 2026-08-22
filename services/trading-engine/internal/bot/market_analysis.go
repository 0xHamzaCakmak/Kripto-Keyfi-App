package bot

import (
	"errors"
	"math"
	"strconv"
	"strings"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type MarketSnapshot struct {
	Candles     map[string][]domain.MarketCandle
	Derivatives domain.DerivativesContext
}

type MarketAnalysis struct {
	Regime, Direction, HigherDirection, MiddleDirection, LowerDirection string
	HigherTimeframeAligned, DerivativesAligned, OIConfirmed             bool
	ConfirmedTimeframes                                                 int
	RegimeConfidence, ADX1H, ADX4H, ATRExpansion, FundingRate           float64
}

func AnalyzeMarket(snapshot MarketSnapshot, side string) (MarketAnalysis, error) {
	required := []string{"1m", "5m", "15m", "1h", "4h"}
	series := make(map[string][]float64, len(required))
	for _, interval := range required {
		candles := snapshot.Candles[interval]
		if len(candles) < 200 {
			return MarketAnalysis{}, errors.New("multi-timeframe market history is incomplete")
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
	adx1h, err := adx(snapshot.Candles["1h"], 14)
	if err != nil {
		return MarketAnalysis{}, err
	}
	adx4h, err := adx(snapshot.Candles["4h"], 14)
	if err != nil {
		return MarketAnalysis{}, err
	}
	hourDirection := emaDirection(series["1h"], 50, 200)
	fourHourDirection := emaDirection(series["4h"], 50, 200)
	higher := consensus(hourDirection, fourHourDirection)
	atrExpansion, err := atrExpansion(snapshot.Candles["1h"], 20)
	if err != nil {
		return MarketAnalysis{}, err
	}
	regime := "UNCERTAIN"
	confidence := math.Min(adx1h, adx4h) / 50
	if atrExpansion > 1.5 {
		regime = "HIGH_VOLATILITY"
	} else if higher != "NEUTRAL" && adx1h > 25 && adx4h > 25 {
		regime = "TREND"
	} else if adx1h < 20 && adx4h < 20 && bandWidth(series["1h"], 50) <= 0.05 {
		regime = "RANGE"
	}
	middle := emaDirection(series["15m"], 9, 21)
	lower := consensus(emaDirection(series["5m"], 9, 21), emaDirection(series["1m"], 9, 21))
	direction := "BUY"
	if strings.ToUpper(side) == "SELL" {
		direction = "SELL"
	}
	confirmed := 0
	for _, vote := range []string{higher, middle, lower} {
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
	return MarketAnalysis{Regime: regime, Direction: direction, HigherDirection: higher, MiddleDirection: middle, LowerDirection: lower,
		HigherTimeframeAligned: higher == direction, ConfirmedTimeframes: confirmed, DerivativesAligned: derivativesAligned,
		OIConfirmed: derivativesAligned && oi > previousOI, RegimeConfidence: math.Max(0, math.Min(1, confidence)),
		ADX1H: adx1h, ADX4H: adx4h, ATRExpansion: atrExpansion, FundingRate: funding}, nil
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
		return 0, errors.New("ATR baseline is invalid")
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
