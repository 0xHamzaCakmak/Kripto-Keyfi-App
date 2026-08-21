package bot

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"strings"
)

func EvaluateStrategy(instance Instance, markPrice, referencePrice string) (Decision, error) {
	if _, ok := decimalRat(markPrice); !ok {
		return Decision{}, errors.New("mark price is invalid")
	}
	switch instance.Type {
	case "SCALPING":
		return evaluateScalping(instance, markPrice, referencePrice)
	case "GRID":
		return evaluateGrid(instance, markPrice, referencePrice)
	default:
		return Decision{}, fmt.Errorf("unsupported bot strategy %q", instance.Type)
	}
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
	if (instance.Mode != "PAPER" && instance.Mode != "SHADOW") || (kind != "BUY" && kind != "SELL" && kind != "GRID_BUY" && kind != "GRID_SELL") {
		return result
	}
	quantityKey := "quantity"
	if instance.Type == "GRID" {
		quantityKey = "quantityPerGrid"
	}
	quantity, _ := stringConfig(instance.Configuration, quantityKey)
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
