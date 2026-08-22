package bot

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

func EvaluateStrategy(instance Instance, markPrice, referencePrice string) (Decision, error) {
	return EvaluateStrategyWithChart(instance, markPrice, referencePrice, nil)
}

func EvaluateStrategyWithChart(instance Instance, markPrice, referencePrice string, closes []domain.Decimal) (Decision, error) {
	if _, ok := decimalRat(markPrice); !ok {
		return Decision{}, errors.New("mark price is invalid")
	}
	switch instance.Type {
	case "SCALPING":
		return evaluateScalping(instance, markPrice, referencePrice)
	case "GRID":
		return evaluateGrid(instance, markPrice, referencePrice)
	case "AUTONOMOUS":
		return evaluateAutonomousStrategy(instance, markPrice, referencePrice, closes)
	default:
		return Decision{}, fmt.Errorf("unsupported bot strategy %q", instance.Type)
	}
}

func EvaluateStrategyWithMarket(instance Instance, markPrice, referencePrice string, snapshot MarketSnapshot) (Decision, error) {
	if instance.Type != "AUTONOMOUS" {
		return EvaluateStrategy(instance, markPrice, referencePrice)
	}
	closes := make([]domain.Decimal, 0, len(snapshot.Candles["1m"]))
	for _, candle := range snapshot.Candles["1m"] {
		closes = append(closes, candle.Close)
	}
	result, err := evaluateAutonomousStrategy(instance, markPrice, referencePrice, closes)
	if err != nil || result.HypotheticalOrder == nil {
		return result, err
	}
	side, _ := result.HypotheticalOrder["side"].(string)
	analysis, err := AnalyzeMarket(snapshot, side)
	if err != nil {
		return Decision{}, err
	}
	if result.Metrics == nil {
		result.Metrics = make(map[string]any)
	}
	result.Metrics["marketRegime"], result.Metrics["higherDirection"], result.Metrics["middleDirection"], result.Metrics["lowerDirection"] = analysis.Regime, analysis.HigherDirection, analysis.MiddleDirection, analysis.LowerDirection
	result.Metrics["confirmedTimeframes"], result.Metrics["adx1h"], result.Metrics["adx4h"], result.Metrics["atrExpansion"] = analysis.ConfirmedTimeframes, roundFloat(analysis.ADX1H, 4), roundFloat(analysis.ADX4H, 4), roundFloat(analysis.ATRExpansion, 4)
	order := result.HypotheticalOrder
	order["marketRegime"], order["higherTimeframeAligned"], order["confirmedTimeframes"], order["derivativesAligned"] = analysis.Regime, analysis.HigherTimeframeAligned, analysis.ConfirmedTimeframes, analysis.DerivativesAligned
	order["oiConfirmed"], order["regimeConfidence"] = analysis.OIConfirmed, roundFloat(analysis.RegimeConfidence, 4)
	if analysis.Regime != "TREND" && analysis.Regime != "RANGE" || !analysis.HigherTimeframeAligned || analysis.ConfirmedTimeframes < 2 || !analysis.DerivativesAligned {
		result.Kind = "HOLD"
		result.Summary = "Playbook rejim/çoklu zaman dilimi/funding-OI giriş teyidi tamamlanmadı."
		result.HypotheticalOrder = nil
		return result, nil
	}
	if !analysis.OIConfirmed {
		quantity, ok := decimalRat(order["quantity"].(string))
		if !ok {
			return Decision{}, errors.New("OI-adjusted quantity is invalid")
		}
		order["quantity"] = new(big.Rat).Quo(quantity, big.NewRat(2, 1)).FloatString(18)
		order["oiSizeMultiplier"] = 0.5
	} else {
		order["oiSizeMultiplier"] = 1.0
	}
	configuredLeverage := int(order["leverage"].(int))
	if analysis.RegimeConfidence < 0.65 && configuredLeverage > 5 {
		configuredLeverage = maxInt(5, configuredLeverage/2)
		order["leverage"] = configuredLeverage
	}
	return result, nil
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func evaluateAutonomousStrategy(instance Instance, markPrice, referencePrice string, closes []domain.Decimal) (Decision, error) {
	if strings.ToUpper(strings.TrimSpace(instance.StrategyFamily)) != "MOMENTUM" {
		return Decision{}, fmt.Errorf("unsupported autonomous strategy family %q", instance.StrategyFamily)
	}
	var result Decision
	var err error
	if len(closes) >= 21 {
		result, err = evaluateChartMomentum(instance, markPrice, closes)
	} else {
		result, err = evaluateScalping(instance, markPrice, referencePrice)
	}
	if err != nil || result.HypotheticalOrder == nil {
		return result, err
	}
	marginMode, marginOK := stringConfig(instance.Configuration, "marginMode")
	stopLossBps, stopOK := numberConfig(instance.Configuration, "stopLossBps")
	takeProfitBps, takeOK := numberConfig(instance.Configuration, "takeProfitBps")
	if !marginOK || strings.ToUpper(marginMode) != "ISOLATED" || !stopOK || !takeOK || stopLossBps <= 0 || takeProfitBps <= 0 {
		return Decision{}, errors.New("autonomous momentum protection configuration is invalid")
	}
	stopLoss, takeProfit, err := protectionPrices(markPrice, result.HypotheticalOrder["side"].(string), stopLossBps, takeProfitBps)
	if err != nil {
		return Decision{}, err
	}
	result.HypotheticalOrder["marginMode"] = "ISOLATED"
	result.HypotheticalOrder["stopLoss"] = stopLoss
	result.HypotheticalOrder["takeProfit"] = takeProfit
	result.HypotheticalOrder["strategyFamily"] = "MOMENTUM"
	allocation, allocationOK := numberConfig(instance.Configuration, "allocationUsdt")
	fixedRiskPct := 0.005
	if configured, ok := numberConfig(instance.Configuration, "fixedRiskPct"); ok {
		fixedRiskPct = configured
	}
	if !allocationOK || allocation <= 0 || fixedRiskPct < 0.005 || fixedRiskPct > 0.01 {
		return Decision{}, errors.New("autonomous fixed-risk sizing configuration is invalid")
	}
	quantity, err := FixedRiskQuantity(strconv.FormatFloat(allocation, 'f', 8, 64), strconv.FormatFloat(fixedRiskPct, 'f', 8, 64), markPrice, stopLoss)
	if err != nil {
		return Decision{}, err
	}
	result.HypotheticalOrder["quantity"] = quantity
	result.HypotheticalOrder["fixedRiskPct"] = fixedRiskPct
	result.HypotheticalOrder["martingaleAllowed"] = false
	return result, nil
}

func evaluateChartMomentum(instance Instance, markPrice string, closes []domain.Decimal) (Decision, error) {
	threshold, ok := numberConfig(instance.Configuration, "signalThresholdBps")
	if !ok || threshold <= 0 || len(closes) < 21 {
		return Decision{}, errors.New("autonomous chart momentum configuration is invalid")
	}
	values := make([]float64, 0, len(closes))
	for _, closeText := range closes {
		closeRat, valid := decimalRat(string(closeText))
		if !valid || closeRat.Sign() <= 0 {
			return Decision{}, errors.New("autonomous chart contains an invalid close")
		}
		value, _ := closeRat.Float64()
		values = append(values, value)
	}
	fast, slow := ema(values, 9), ema(values, 21)
	if slow <= 0 {
		return Decision{}, errors.New("autonomous chart EMA is invalid")
	}
	momentumBps := (fast - slow) / slow * 10_000
	mark, _ := decimalRat(markPrice)
	markFloat, _ := mark.Float64()
	side, _ := stringConfig(instance.Configuration, "side")
	side = strings.ToUpper(side)
	kind := "HOLD"
	summary := "1m grafik EMA momentumu sinyal eşiğinin altında kaldı."
	if momentumBps >= threshold && markFloat >= fast && (side == "BUY" || side == "BOTH") {
		kind, summary = "BUY", "1m grafik EMA momentumu ve fiyat teyidi LONG sinyali üretti."
	} else if momentumBps <= -threshold && markFloat <= fast && (side == "SELL" || side == "BOTH") {
		kind, summary = "SELL", "1m grafik EMA momentumu ve fiyat teyidi SHORT sinyali üretti."
	}
	metrics := map[string]any{"chartTimeframe": "1m", "chartSamples": len(values), "emaFast": roundFloat(fast, 8), "emaSlow": roundFloat(slow, 8), "chartMomentumBps": roundFloat(momentumBps, 4), "thresholdBps": threshold}
	return decision(instance, kind, summary, markPrice, strconv.FormatFloat(values[len(values)-2], 'f', -1, 64), metrics), nil
}

func ema(values []float64, period int) float64 {
	result := values[0]
	alpha := 2.0 / float64(period+1)
	for _, value := range values[1:] {
		result = value*alpha + result*(1-alpha)
	}
	return result
}

func evaluateScalping(instance Instance, markPrice, referencePrice string) (Decision, error) {
	threshold, ok := numberConfig(instance.Configuration, "signalThresholdBps")
	if !ok || threshold <= 0 {
		return Decision{}, errors.New("signalThresholdBps must be positive")
	}
	if referencePrice == "" {
		return decision(instance, "WARMING_UP", "İlk fiyat örneği kaydedildi; karşılaştırma için sonraki çevrim bekleniyor.", markPrice, "", nil), nil
	}
	current, _ := decimalRat(markPrice)
	reference, ok := decimalRat(referencePrice)
	if !ok || reference.Sign() <= 0 {
		return Decision{}, errors.New("reference price is invalid")
	}
	change := new(big.Rat).Sub(current, reference)
	change.Quo(change, reference)
	change.Mul(change, big.NewRat(10_000, 1))
	changeBps, _ := change.Float64()
	metrics := map[string]any{"changeBps": roundFloat(changeBps, 4), "thresholdBps": threshold}
	side, _ := stringConfig(instance.Configuration, "side")
	side = strings.ToUpper(side)
	kind := "HOLD"
	summary := "Fiyat değişimi scalping sinyal eşiğinin altında kaldı."
	if changeBps >= threshold && (side == "BUY" || side == "BOTH") {
		kind, summary = "BUY", "Yukarı yönlü momentum scalping eşiğini geçti."
	} else if changeBps <= -threshold && (side == "SELL" || side == "BOTH") {
		kind, summary = "SELL", "Aşağı yönlü momentum scalping eşiğini geçti."
	}
	return decision(instance, kind, summary, markPrice, referencePrice, metrics), nil
}

func evaluateGrid(instance Instance, markPrice, referencePrice string) (Decision, error) {
	lower, lowerOK := stringConfig(instance.Configuration, "lowerPrice")
	upper, upperOK := stringConfig(instance.Configuration, "upperPrice")
	levels, levelsOK := numberConfig(instance.Configuration, "gridLevels")
	if !lowerOK || !upperOK || !levelsOK || levels < 2 {
		return Decision{}, errors.New("grid configuration is invalid")
	}
	currentIndex, currentInRange, err := gridIndex(markPrice, lower, upper, int(levels))
	if err != nil {
		return Decision{}, err
	}
	metrics := map[string]any{"gridLevels": int(levels), "lowerPrice": lower, "upperPrice": upper}
	if !currentInRange {
		return decision(instance, "OUT_OF_RANGE", "Fiyat tanımlı grid aralığının dışında; yeni sanal işlem üretilmedi.", markPrice, referencePrice, metrics), nil
	}
	metrics["gridIndex"] = currentIndex
	if referencePrice == "" {
		return decision(instance, "WARMING_UP", "İlk grid seviyesi kaydedildi; seviye geçişi için sonraki çevrim bekleniyor.", markPrice, "", metrics), nil
	}
	previousIndex, previousInRange, err := gridIndex(referencePrice, lower, upper, int(levels))
	if err != nil {
		return Decision{}, err
	}
	metrics["previousGridIndex"] = previousIndex
	if !previousInRange || previousIndex == currentIndex {
		return decision(instance, "HOLD", "Yeni bir grid seviyesi geçilmedi.", markPrice, referencePrice, metrics), nil
	}
	if currentIndex < previousIndex {
		return decision(instance, "GRID_BUY", "Fiyat daha düşük bir grid seviyesine geçti; sanal alış sinyali oluştu.", markPrice, referencePrice, metrics), nil
	}
	return decision(instance, "GRID_SELL", "Fiyat daha yüksek bir grid seviyesine geçti; sanal satış sinyali oluştu.", markPrice, referencePrice, metrics), nil
}

func decision(instance Instance, kind, summary, markPrice, referencePrice string, metrics map[string]any) Decision {
	result := Decision{Kind: kind, Summary: summary, MarkPrice: markPrice, ReferencePrice: referencePrice, Metrics: metrics}
	modeAllowed := instance.Mode == "PAPER" || instance.Mode == "SHADOW" || (instance.Mode == "DEMO" && instance.Type == "AUTONOMOUS")
	if !modeAllowed || (kind != "BUY" && kind != "SELL" && kind != "GRID_BUY" && kind != "GRID_SELL") {
		return result
	}
	quantityKey := "quantity"
	if instance.Type == "GRID" {
		quantityKey = "quantityPerGrid"
	}
	quantity, _ := stringConfig(instance.Configuration, quantityKey)
	if instance.Type == "AUTONOMOUS" {
		allocation, allocationOK := numberConfig(instance.Configuration, "allocationUsdt")
		positionPct, positionPctOK := numberConfig(instance.Configuration, "positionNotionalPct")
		mark, markOK := decimalRat(markPrice)
		if allocationOK && positionPctOK && markOK && allocation > 0 && positionPct > 0 && positionPct <= 1 && mark.Sign() > 0 {
			allocationRat, _ := new(big.Rat).SetString(strconv.FormatFloat(allocation, 'f', 8, 64))
			positionPctRat, _ := new(big.Rat).SetString(strconv.FormatFloat(positionPct, 'f', 8, 64))
			quantity = new(big.Rat).Quo(new(big.Rat).Mul(allocationRat, positionPctRat), mark).FloatString(18)
		}
	}
	leverage, _ := numberConfig(instance.Configuration, "leverage")
	feeBps := DefaultPaperFeeBps
	if configured, ok := numberConfig(instance.Configuration, "paperFeeBps"); ok && configured >= 0 {
		feeBps = configured
	}
	slippageBps := DefaultPaperSlippageBps
	if configured, ok := numberConfig(instance.Configuration, "paperSlippageBps"); ok && configured >= 0 {
		slippageBps = configured
	}
	side := "BUY"
	if kind == "SELL" || kind == "GRID_SELL" {
		side = "SELL"
	}
	result.HypotheticalOrder = map[string]any{
		"symbol": instance.Symbol, "side": side, "quantity": quantity, "leverage": int(leverage),
		"price": markPrice, "mode": instance.Mode, "feeBps": feeBps, "slippageBps": slippageBps, "submittedToExchange": false,
	}
	return result
}

func gridIndex(price, lower, upper string, levels int) (int, bool, error) {
	p, pok := decimalRat(price)
	l, lok := decimalRat(lower)
	u, uok := decimalRat(upper)
	if !pok || !lok || !uok || levels < 2 || l.Cmp(u) >= 0 {
		return 0, false, errors.New("grid decimal configuration is invalid")
	}
	if p.Cmp(l) < 0 || p.Cmp(u) > 0 {
		return 0, false, nil
	}
	width := new(big.Rat).Sub(u, l)
	step := new(big.Rat).Quo(width, big.NewRat(int64(levels-1), 1))
	offset := new(big.Rat).Sub(p, l)
	quotient := new(big.Rat).Quo(offset, step)
	index := new(big.Int).Quo(quotient.Num(), quotient.Denom()).Int64()
	if index >= int64(levels) {
		index = int64(levels - 1)
	}
	return int(index), true, nil
}

func protectionPrices(markPrice, side string, stopLossBps, takeProfitBps float64) (string, string, error) {
	mark, ok := decimalRat(markPrice)
	if !ok || mark.Sign() <= 0 {
		return "", "", errors.New("mark price is invalid for autonomous protection")
	}
	stopRate, ok := new(big.Rat).SetString(fmt.Sprintf("%.8f", stopLossBps/10_000))
	if !ok {
		return "", "", errors.New("stop loss rate is invalid")
	}
	takeRate, ok := new(big.Rat).SetString(fmt.Sprintf("%.8f", takeProfitBps/10_000))
	if !ok {
		return "", "", errors.New("take profit rate is invalid")
	}
	one := big.NewRat(1, 1)
	var stop, take *big.Rat
	if strings.ToUpper(side) == "BUY" {
		stop = new(big.Rat).Mul(mark, new(big.Rat).Sub(one, stopRate))
		take = new(big.Rat).Mul(mark, new(big.Rat).Add(one, takeRate))
	} else if strings.ToUpper(side) == "SELL" {
		stop = new(big.Rat).Mul(mark, new(big.Rat).Add(one, stopRate))
		take = new(big.Rat).Mul(mark, new(big.Rat).Sub(one, takeRate))
	} else {
		return "", "", errors.New("autonomous protection side is invalid")
	}
	return decimalString(stop), decimalString(take), nil
}

func decimalRat(value string) (*big.Rat, bool) {
	return new(big.Rat).SetString(strings.TrimSpace(value))
}
func stringConfig(configuration map[string]any, key string) (string, bool) {
	value, ok := configuration[key].(string)
	return strings.TrimSpace(value), ok && strings.TrimSpace(value) != ""
}
func numberConfig(configuration map[string]any, key string) (float64, bool) {
	switch value := configuration[key].(type) {
	case float64:
		return value, true
	case int:
		return float64(value), true
	default:
		return 0, false
	}
}
func roundFloat(value float64, decimals int) float64 {
	factor := math.Pow10(decimals)
	return math.Round(value*factor) / factor
}
