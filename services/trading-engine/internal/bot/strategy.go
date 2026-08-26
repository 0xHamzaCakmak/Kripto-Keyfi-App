package bot

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"
	"time"

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
	closes := make([]domain.Decimal, 0, len(snapshot.Candles["15m"]))
	for _, candle := range snapshot.Candles["15m"] {
		closes = append(closes, candle.Close)
	}
	result, err := evaluateAutonomousStrategy(instance, markPrice, referencePrice, closes)
	if err != nil {
		return result, err
	}
	if result.HypotheticalOrder == nil && instance.Mode == "PAPER" && booleanConfig(instance.Configuration, "paperAlwaysInMarket") {
		result, err = paperContinuousTrainingDecision(instance, markPrice, referencePrice, closes)
		if err != nil {
			return Decision{}, err
		}
	}
	if result.HypotheticalOrder == nil && instance.Mode == "DEMO" && booleanConfig(instance.Configuration, "testnetContinuousExecution") {
		result, err = testnetContinuousExecutionDecision(instance, markPrice, referencePrice, closes)
		if err != nil {
			return Decision{}, err
		}
	}
	if result.HypotheticalOrder == nil {
		return result, nil
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
	result.Metrics["confirmedTimeframes"], result.Metrics["adx15m"], result.Metrics["adx1h"], result.Metrics["atrExpansion"] = analysis.ConfirmedTimeframes, roundFloat(analysis.ADX15M, 4), roundFloat(analysis.ADX1H, 4), roundFloat(analysis.ATRExpansion, 4)
	result.Metrics["analysisTimeframes"], result.Metrics["directionWindowsHours"] = []string{"15m", "1h"}, []int{24, 48}
	result.Metrics["atrBps15m"] = roundFloat(analysis.ATRBps15m, 4)
	result.Metrics["derivativesAvailable"] = !snapshot.DerivativesUnavailable
	result.Metrics["newsAvailable"], result.Metrics["newsBias"], result.Metrics["newsScore"], result.Metrics["newsConfidence"] = snapshot.News.Available, snapshot.News.Bias, roundFloat(snapshot.News.Score, 4), roundFloat(snapshot.News.Confidence, 4)
	result.Metrics["newsArticleIds"], result.Metrics["newsObservedAt"] = snapshot.News.ArticleIDs, snapshot.News.ObservedAt
	result.Metrics["liquidationAvailable"], result.Metrics["liquidationSource"], result.Metrics["liquidationCluster"] = snapshot.Liquidations.Available, snapshot.Liquidations.Source, snapshot.Liquidations.Cluster
	result.Metrics["liquidationEventCount"], result.Metrics["liquidationBuyNotional"], result.Metrics["liquidationSellNotional"], result.Metrics["liquidationPressure"] = snapshot.Liquidations.EventCount, roundFloat(snapshot.Liquidations.BuyNotional, 4), roundFloat(snapshot.Liquidations.SellNotional, 4), roundFloat(snapshot.Liquidations.Pressure, 4)
	result.Metrics["playbookVersion"] = stringConfigOr(instance.Configuration, "playbookVersion", "TRADING_PLAYBOOK_V1")
	result.Metrics["experimentId"] = stringConfigOr(instance.Configuration, "experimentId", "ATR_STOP_WALK_FORWARD_V1")
	result.Metrics["experimentVariant"] = stringConfigOr(instance.Configuration, "experimentVariant", "ATR_1_50")
	order := result.HypotheticalOrder
	order["marketRegime"], order["higherTimeframeAligned"], order["confirmedTimeframes"], order["derivativesAligned"] = analysis.Regime, analysis.HigherTimeframeAligned, analysis.ConfirmedTimeframes, analysis.DerivativesAligned
	order["oiConfirmed"], order["regimeConfidence"] = analysis.OIConfirmed, roundFloat(analysis.RegimeConfidence, 4)
	latestCandle := snapshot.Candles["15m"][len(snapshot.Candles["15m"])-1]
	order["signalKey"] = fmt.Sprintf("%s:%d:%s", instance.Symbol, latestCandle.OpenTimeMS, side)
	result.Metrics["marketDataOpenTimeMs"] = latestCandle.OpenTimeMS
	if instance.Mode == "DEMO" {
		if guardedAfter, configured := numberConfig(instance.Configuration, "testnetReentryAfterCandleOpenMs"); configured && latestCandle.OpenTimeMS <= int64(guardedAfter) {
			result.Kind = "HOLD"
			result.Summary = "Manuel/borsa kapanışı sonrası aynı 15 dakikalık mumda yeniden giriş engellendi; yeni mum ve piyasa teyidi bekleniyor."
			result.Metrics["testnetReentryGuardActive"] = true
			result.Metrics["testnetReentryAfterCandleOpenMs"] = int64(guardedAfter)
			result.HypotheticalOrder = nil
			return result, nil
		}
	}
	family := strings.ToUpper(strings.TrimSpace(instance.StrategyFamily))
	selected, _ := result.Metrics["selectedSubStrategy"].(string)
	isMeanReversion := family == "RSI_MEAN_REVERSION" || family == "BOLLINGER_MEAN_REVERSION" || (family == "MULTI_AGENT" && selected == "RANGE_MEAN_REVERSION")
	marketConfirmed := analysis.DerivativesAligned
	if isMeanReversion {
		marketConfirmed = marketConfirmed && analysis.Regime == "RANGE"
	} else {
		marketConfirmed = marketConfirmed && analysis.Regime == "TREND" && analysis.HigherTimeframeAligned && analysis.ConfirmedTimeframes >= 2
	}
	if instance.Mode == "PAPER" {
		marketConfirmed = analysis.ConfirmedTimeframes >= 1
		if isMeanReversion {
			marketConfirmed = marketConfirmed && analysis.Regime == "RANGE"
		} else {
			marketConfirmed = marketConfirmed && analysis.Regime == "TREND"
		}
		if booleanConfig(instance.Configuration, "paperAlwaysInMarket") && result.Metrics["continuousTrainingEntry"] == true {
			// Continuous PAPER evidence needs valid OHLCV/regime classification,
			// but it intentionally does not require directional agreement across
			// timeframes; EMA chooses the side and the central Risk Engine still
			// enforces leverage, stop, exposure and loss limits.
			marketConfirmed = analysis.Regime != ""
		}
	}
	if instance.Mode == "DEMO" && booleanConfig(instance.Configuration, "testnetExecutionProfile") && result.Metrics["testnetContinuousEntry"] == true {
		// Explicit TESTNET training accepts established regimes and guarded
		// transition regimes. A transition still requires Binance derivatives,
		// two same-side timeframes and meaningful 15m volatility; low-confidence
		// leverage reduction and both risk engines remain in force below.
		var transitionAccepted bool
		marketConfirmed, transitionAccepted = testnetContinuousMarketConfirmation(instance.Configuration, analysis)
		result.Metrics["testnetTransitionRegimeAccepted"] = transitionAccepted
		order["transitionRegimeAccepted"] = transitionAccepted
	}
	if !marketConfirmed {
		result.Kind = "HOLD"
		result.Summary = "Playbook rejim/çoklu zaman dilimi/funding-OI giriş teyidi tamamlanmadı."
		result.HypotheticalOrder = nil
		return result, nil
	}
	if instance.Mode == "PAPER" && booleanConfig(instance.Configuration, "newsFilterEnabled") && newsConflicts(snapshot.News, side) {
		result.Kind = "HOLD"
		result.Summary = "Güvenilir güncel haber etkisi teknik giriş yönüyle çelişti; PAPER A/B haber filtresi girişi veto etti."
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
	minimumLeverage := maxInt(1, int(configNumberOr(instance.Configuration, "leverageMin", 5)))
	maximumLeverage := maxInt(minimumLeverage, int(configNumberOr(instance.Configuration, "leverageMax", 20)))
	configuredLeverage = maxInt(minimumLeverage, minInt(maximumLeverage, configuredLeverage))
	if analysis.RegimeConfidence < 0.65 && configuredLeverage > minimumLeverage {
		configuredLeverage = maxInt(minimumLeverage, configuredLeverage/2)
		order["leverage"] = configuredLeverage
	}
	if err := applyAdaptiveRiskPlan(instance, markPrice, analysis, order); err != nil {
		return Decision{}, err
	}
	mentorConsidered, mentorAligned, mentorKey, err := applyMentorEvidence(instance, analysis, order)
	if err != nil {
		return Decision{}, err
	}
	if mentorConsidered {
		result.Metrics["mentorSignalConsidered"] = true
		result.Metrics["mentorSignalAligned"] = mentorAligned
		result.Metrics["mentorSignalKey"] = mentorKey
		order["mentorSignalConsidered"] = true
		order["mentorSignalAligned"] = mentorAligned
		order["mentorSignalWeight"] = 0.20
		order["mentorSignalForcesTrade"] = false
		if !mentorAligned {
			quantity, scaleErr := scaleDecimal(order["quantity"].(string), 4, 5)
			if scaleErr != nil {
				return Decision{}, scaleErr
			}
			order["quantity"] = quantity
			order["mentorSizeMultiplier"] = 0.80
		} else {
			order["mentorSizeMultiplier"] = 1.0
		}
	}
	return result, nil
}

func applyMentorEvidence(instance Instance, analysis MarketAnalysis, order map[string]any) (bool, bool, string, error) {
	raw, ok := instance.Configuration["mentorEvidence"].([]any)
	if !ok || len(raw) == 0 {
		return false, false, "", nil
	}
	botBase := stablecoinBaseAsset(instance.Symbol)
	proposedSide, _ := order["side"].(string)
	for index := len(raw) - 1; index >= 0; index-- {
		item, valid := raw[index].(map[string]any)
		if !valid || !strings.EqualFold(stringValue(item["baseAsset"]), botBase) {
			continue
		}
		observedAt, parseErr := time.Parse(time.RFC3339, stringValue(item["mentorObservedAt"]))
		if parseErr != nil || time.Since(observedAt) > 7*24*time.Hour {
			continue
		}
		regime := strings.ToUpper(stringValue(item["regime"]))
		if regime != "" && regime != "UNKNOWN" && !strings.EqualFold(regime, analysis.Regime) {
			continue
		}
		action := strings.ToUpper(stringValue(item["action"]))
		if action != "BUY" && action != "SELL" {
			continue
		}
		return true, strings.EqualFold(action, proposedSide), stringValue(item["signalKey"]), nil
	}
	return false, false, "", nil
}

func stablecoinBaseAsset(symbol string) string {
	value := strings.ToUpper(strings.TrimSpace(symbol))
	value = strings.TrimSuffix(value, "USDT")
	return strings.TrimSuffix(value, "USDC")
}

func stringValue(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func scaleDecimal(value string, numerator, denominator int64) (string, error) {
	parsed, ok := decimalRat(value)
	if !ok || parsed.Sign() <= 0 || numerator <= 0 || denominator <= 0 {
		return "", errors.New("mentor-adjusted quantity is invalid")
	}
	return new(big.Rat).Mul(parsed, big.NewRat(numerator, denominator)).FloatString(18), nil
}

func applyAdaptiveRiskPlan(instance Instance, markPrice string, analysis MarketAnalysis, order map[string]any) error {
	side, sideOK := order["side"].(string)
	leverage, leverageOK := order["leverage"].(int)
	allocation, allocationOK := numberConfig(instance.Configuration, "allocationUsdt")
	if !sideOK || !leverageOK || !allocationOK || allocation <= 0 || leverage < 1 {
		return errors.New("adaptive risk plan input is invalid")
	}
	multiplier := configNumberOr(instance.Configuration, "atrStopMultiplier", 1.5)
	minimumBps := configNumberOr(instance.Configuration, "adaptiveStopMinBps", 75)
	maximumBps := configNumberOr(instance.Configuration, "adaptiveStopMaxBps", 300)
	riskReward := configNumberOr(instance.Configuration, "riskRewardRatio", 1.5)
	minimumTakeProfitBps := float64(0)
	fixedTestnetProtection := false
	maintenanceMarginBps := configNumberOr(instance.Configuration, "maintenanceMarginBps", 50)
	liquidationReserveFraction := configNumberOr(instance.Configuration, "liquidationReserveFraction", 0.20)
	if instance.Mode == "PAPER" {
		maximumBps = math.Min(configNumberOr(instance.Configuration, "stopLossBps", PaperTrainingStopLossBps), PaperTrainingStopLossBps)
		minimumBps = math.Min(configNumberOr(instance.Configuration, "adaptiveStopMinBps", 75), maximumBps)
		minimumTakeProfitBps = math.Max(configNumberOr(instance.Configuration, "takeProfitBps", PaperTrainingTakeProfitBps), PaperTrainingTakeProfitBps)
		minimumMargin := math.Max(0.01, configNumberOr(instance.Configuration, "minimumInitialMarginUsdt", 20))
		maximumRiskPct := math.Max(0.01, math.Min(0.20, configNumberOr(instance.Configuration, "paperMaxRiskPerTradePct", 0.05)))
		targetNotional := minimumMargin * float64(leverage)
		if targetNotional <= 0 || minimumMargin > allocation {
			return errors.New("PAPER minimum initial margin is outside the bot allocation")
		}
		// Size against 80% of the PAPER risk budget. The central engine evaluates
		// against current equity (which may be below the original allocation), so
		// this buffer prevents harmless rounding/small drawdown rejections while
		// preserving the persisted risk ceiling.
		maximumRiskStopBps := allocation * maximumRiskPct * 0.80 / targetNotional * 10_000
		maximumBps = math.Min(maximumBps, maximumRiskStopBps)
		minimumBps = math.Min(minimumBps, maximumBps)
	}
	if instance.Mode == "DEMO" && booleanConfig(instance.Configuration, "testnetExecutionProfile") {
		configuredStopBps := configNumberOr(instance.Configuration, "stopLossBps", 300)
		configuredTakeBps := configNumberOr(instance.Configuration, "takeProfitBps", 300)
		if booleanConfig(instance.Configuration, "fixedTestnetProtectionTargets") {
			minimumBps = configuredStopBps
			maximumBps = configuredStopBps
			minimumTakeProfitBps = configuredTakeBps
			fixedTestnetProtection = true
		} else {
			minimumTakeProfitBps = math.Max(configNumberOr(instance.Configuration, "minimumTakeProfitBps", 300), 300)
		}
		minimumMargin := math.Max(0.01, configNumberOr(instance.Configuration, "minimumInitialMarginUsdt", 20))
		if minimumMargin > allocation {
			return errors.New("TESTNET minimum initial margin is outside the bot allocation")
		}
	}
	maximumAllowedStopBps := float64(500)
	if instance.Mode == "PAPER" {
		maximumAllowedStopBps = PaperTrainingStopLossBps
	} else if instance.Mode == "DEMO" && booleanConfig(instance.Configuration, "testnetExecutionProfile") {
		maximumAllowedStopBps = 1000
	}
	if multiplier <= 0 || minimumBps < 50 || maximumBps < minimumBps || maximumBps > maximumAllowedStopBps || riskReward < 1 || riskReward > 5 || maintenanceMarginBps < 0 || liquidationReserveFraction < 0.1 || liquidationReserveFraction > 0.5 {
		return errors.New("adaptive risk configuration is invalid")
	}
	stopBps := math.Max(minimumBps, math.Min(maximumBps, analysis.ATRBps15m*multiplier))
	if fixedTestnetProtection {
		maximumSafeLeverage := int(math.Floor(10_000 / (stopBps/(1-liquidationReserveFraction) + maintenanceMarginBps)))
		minimumLeverage := maxInt(1, int(configNumberOr(instance.Configuration, "leverageMin", 5)))
		if maximumSafeLeverage < minimumLeverage {
			return errors.New("configured TESTNET stop cannot satisfy liquidation safety at minimum leverage")
		}
		if leverage > maximumSafeLeverage {
			leverage = maximumSafeLeverage
			order["leverage"] = leverage
			order["mentorIndependentLeverageSafetyCap"] = true
		}
	}
	liquidationDistanceBps := 10_000/float64(leverage) - maintenanceMarginBps
	safeLiquidationBps := liquidationDistanceBps * (1 - liquidationReserveFraction)
	if instance.Mode != "PAPER" {
		if safeLiquidationBps <= 0 {
			return errors.New("adaptive stop has no liquidation safety distance")
		}
		stopBps = math.Min(stopBps, safeLiquidationBps)
		if stopBps < minimumBps {
			return errors.New("adaptive stop cannot satisfy minimum distance before liquidation")
		}
	}
	takeBps := stopBps * riskReward
	if fixedTestnetProtection {
		takeBps = minimumTakeProfitBps
	} else if instance.Mode == "PAPER" || (instance.Mode == "DEMO" && booleanConfig(instance.Configuration, "testnetExecutionProfile")) {
		takeBps = math.Max(takeBps, minimumTakeProfitBps)
	}
	stop, take, err := protectionPrices(markPrice, side, stopBps, takeBps)
	if err != nil {
		return err
	}
	riskFraction := configNumberOr(instance.Configuration, "fixedRiskPct", 0.0075)
	if riskFraction < 0.005 || riskFraction > 0.01 {
		return errors.New("adaptive fixed-risk fraction is outside the 0.5%-1% boundary")
	}
	quantity, err := FixedRiskQuantity(strconv.FormatFloat(allocation, 'f', 8, 64), strconv.FormatFloat(riskFraction, 'f', 8, 64), markPrice, stop)
	if err != nil {
		return err
	}
	maximumNotionalMultiplier := float64(1)
	if instance.Mode == "PAPER" || (instance.Mode == "DEMO" && booleanConfig(instance.Configuration, "testnetMarginAllocationMode")) {
		maximumNotionalMultiplier = float64(leverage)
	}
	quantity, err = capQuantityToAllocation(quantity, markPrice, allocation*maximumNotionalMultiplier)
	if err != nil {
		return err
	}
	if instance.Mode == "PAPER" {
		minimumMargin := math.Max(0.01, configNumberOr(instance.Configuration, "minimumInitialMarginUsdt", 20))
		slippageBps := configNumberOr(instance.Configuration, "paperSlippageBps", DefaultPaperSlippageBps)
		quantity, err = enforceMinimumInitialMargin(quantity, markPrice, minimumMargin, leverage, slippageBps)
		if err != nil {
			return err
		}
		order["initialMarginUsdt"] = minimumMargin
		order["targetNotionalUsdt"] = minimumMargin * float64(leverage)
	}
	if instance.Mode == "DEMO" && booleanConfig(instance.Configuration, "testnetMarginAllocationMode") {
		minimumMargin := math.Max(0.01, configNumberOr(instance.Configuration, "minimumInitialMarginUsdt", 20))
		quantity, err = enforceMinimumInitialMargin(quantity, markPrice, minimumMargin, leverage, 0)
		if err != nil {
			return err
		}
		order["quantity"] = quantity
		order["initialMarginUsdt"] = minimumMargin
		order["targetNotionalUsdt"] = minimumMargin * float64(leverage)
	}
	order["quantity"], order["stopLoss"], order["takeProfit"] = quantity, stop, take
	order["stopLossBps"], order["takeProfitBps"], order["fixedRiskPct"] = roundFloat(stopBps, 4), roundFloat(takeBps, 4), riskFraction
	order["atrStopMultiplier"], order["atrBps15m"], order["riskRewardRatio"] = multiplier, roundFloat(analysis.ATRBps15m, 4), riskReward
	order["liquidationDistanceBps"], order["liquidationSafetyBps"] = roundFloat(liquidationDistanceBps, 4), roundFloat(safeLiquidationBps, 4)
	order["riskPlanVersion"] = "ATR_ADAPTIVE_FIXED_RISK_V1"
	if instance.Mode == "PAPER" {
		order["riskPlanVersion"] = "PAPER_TRAINING_20PCT_STOP_V1"
	}
	if instance.Mode == "DEMO" && booleanConfig(instance.Configuration, "testnetMarginAllocationMode") {
		order["riskPlanVersion"] = "TESTNET_MARGIN_ALLOCATION_V1"
	}
	order["playbookVersion"] = stringConfigOr(instance.Configuration, "playbookVersion", "TRADING_PLAYBOOK_V1")
	order["experimentId"] = stringConfigOr(instance.Configuration, "experimentId", "ATR_STOP_WALK_FORWARD_V1")
	order["experimentVariant"] = stringConfigOr(instance.Configuration, "experimentVariant", "ATR_1_50")
	return nil
}

func configNumberOr(configuration map[string]any, key string, fallback float64) float64 {
	if value, ok := numberConfig(configuration, key); ok {
		return value
	}
	return fallback
}

func testnetContinuousMarketConfirmation(configuration map[string]any, analysis MarketAnalysis) (bool, bool) {
	if !analysis.DerivativesAligned {
		return false, false
	}
	regime := strings.ToUpper(strings.TrimSpace(analysis.Regime))
	if (regime == "TREND" || regime == "RANGE" || regime == "HIGH_VOLATILITY") && analysis.ConfirmedTimeframes >= 1 {
		return true, false
	}

	// Default-on preserves continuity for TESTNET bots created before this
	// setting existed. Persisted false remains an explicit admin opt-out.
	transitionEnabled := true
	if value, exists := configuration["testnetTransitionRegimeEnabled"]; exists {
		enabled, valid := value.(bool)
		transitionEnabled = valid && enabled
	}
	minimumTimeframes := maxInt(2, int(configNumberOr(configuration, "testnetTransitionMinConfirmedTimeframes", 2)))
	minimumATRBps := math.Max(20, configNumberOr(configuration, "testnetTransitionMinAtrBps", 20))
	transitionAccepted := regime == "UNCERTAIN" && transitionEnabled && analysis.ConfirmedTimeframes >= minimumTimeframes && analysis.ATRBps15m >= minimumATRBps
	return transitionAccepted, transitionAccepted
}

func stringConfigOr(configuration map[string]any, key, fallback string) string {
	if value, ok := stringConfig(configuration, key); ok {
		return value
	}
	return fallback
}

func capQuantityToAllocation(quantityText, markPrice string, allocation float64) (string, error) {
	quantity, quantityOK := decimalRat(quantityText)
	mark, markOK := decimalRat(markPrice)
	allocationValue, allocationOK := decimalRat(strconv.FormatFloat(allocation, 'f', 8, 64))
	if !quantityOK || !markOK || !allocationOK || quantity.Sign() <= 0 || mark.Sign() <= 0 || allocationValue.Sign() <= 0 {
		return "", errors.New("adaptive quantity cap input is invalid")
	}
	maximum := new(big.Rat).Quo(allocationValue, mark)
	if quantity.Cmp(maximum) > 0 {
		quantity = maximum
	}
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	scaled := new(big.Rat).Mul(quantity, new(big.Rat).SetInt(scale))
	units := new(big.Int).Quo(scaled.Num(), scaled.Denom())
	return new(big.Rat).Quo(new(big.Rat).SetInt(units), new(big.Rat).SetInt(scale)).FloatString(18), nil
}

func enforceMinimumInitialMargin(quantityText, markPrice string, minimumMargin float64, leverage int, slippageBps float64) (string, error) {
	quantity, quantityOK := decimalRat(quantityText)
	mark, markOK := decimalRat(markPrice)
	margin, marginOK := decimalRat(strconv.FormatFloat(minimumMargin, 'f', 8, 64))
	if !quantityOK || !markOK || !marginOK || quantity.Sign() <= 0 || mark.Sign() <= 0 || margin.Sign() <= 0 || leverage < 1 || slippageBps < 0 || slippageBps >= 10_000 {
		return "", errors.New("PAPER minimum margin sizing input is invalid")
	}
	// SELL fills receive adverse downward slippage, so size against the lowest
	// possible simulated fill. BUY fills then naturally retain a small buffer.
	slippageRate, _ := new(big.Rat).SetString(strconv.FormatFloat(slippageBps/10_000, 'f', 8, 64))
	minimumNotional := new(big.Rat).Mul(margin, big.NewRat(int64(leverage), 1))
	minimumNotional.Quo(minimumNotional, new(big.Rat).Sub(big.NewRat(1, 1), slippageRate))
	minimumQuantity := new(big.Rat).Quo(minimumNotional, mark)
	if quantity.Cmp(minimumQuantity) < 0 {
		quantity = minimumQuantity
	}
	return quantity.FloatString(18), nil
}

func paperContinuousTrainingDecision(instance Instance, markPrice, referencePrice string, closes []domain.Decimal) (Decision, error) {
	if len(closes) < 21 {
		return Decision{}, errors.New("continuous PAPER training requires complete 1m chart history")
	}
	values := make([]float64, 0, len(closes))
	for _, closeText := range closes {
		value, err := strconv.ParseFloat(string(closeText), 64)
		if err != nil || value <= 0 {
			return Decision{}, errors.New("continuous PAPER chart contains an invalid close")
		}
		values = append(values, value)
	}
	fast, slow := ema(values, 9), ema(values, 21)
	side := "BUY"
	if fast < slow {
		side = "SELL"
	}
	configuredSide := strings.ToUpper(stringConfigOr(instance.Configuration, "side", "BOTH"))
	if configuredSide == "BUY" || configuredSide == "SELL" {
		side = configuredSide
	}
	kind, direction := "BUY", "LONG"
	if side == "SELL" {
		kind, direction = "SELL", "SHORT"
	}
	result := decision(instance, kind, "PAPER sürekli eğitim modu geçerli EMA yönünde "+direction+" kanıt işlemi üretti.", markPrice, referencePrice,
		map[string]any{"continuousTrainingEntry": true, "selectedSubStrategy": "CONTINUOUS_EMA_TRAINING", "emaFast": roundFloat(fast, 8), "emaSlow": roundFloat(slow, 8)})
	if result.HypotheticalOrder != nil {
		result.HypotheticalOrder["continuousTrainingEntry"] = true
		result.HypotheticalOrder["marginMode"] = "ISOLATED"
		result.HypotheticalOrder["strategyFamily"] = strings.ToUpper(strings.TrimSpace(instance.StrategyFamily))
		result.HypotheticalOrder["martingaleAllowed"] = false
	}
	return result, nil
}

func testnetContinuousExecutionDecision(instance Instance, markPrice, referencePrice string, closes []domain.Decimal) (Decision, error) {
	result, err := paperContinuousTrainingDecision(instance, markPrice, referencePrice, closes)
	if err != nil {
		return Decision{}, err
	}
	result.Summary = "TESTNET trend-grid profili geÃ§erli EMA yÃ¶nÃ¼nde korumalÄ± giriÅŸ adayÄ± Ã¼retti."
	result.Metrics["continuousTrainingEntry"] = false
	result.Metrics["testnetContinuousEntry"] = true
	result.Metrics["selectedSubStrategy"] = "TESTNET_TREND_GRID"
	if result.HypotheticalOrder != nil {
		result.HypotheticalOrder["continuousTrainingEntry"] = false
		result.HypotheticalOrder["testnetContinuousEntry"] = true
		result.HypotheticalOrder["testnetTrendGridEnabled"] = booleanConfig(instance.Configuration, "testnetTrendGridEnabled")
	}
	return result, nil
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}

func evaluateAutonomousStrategy(instance Instance, markPrice, referencePrice string, closes []domain.Decimal) (Decision, error) {
	family := strings.ToUpper(strings.TrimSpace(instance.StrategyFamily))
	var result Decision
	var err error
	if len(closes) >= 21 {
		switch family {
		case "MOMENTUM", "ATR_BREAKOUT", "DONCHIAN_BREAKOUT", "VOLUME_SPIKE":
			result, err = evaluateChartMomentum(instance, markPrice, closes)
		case "RSI_MEAN_REVERSION", "BOLLINGER_MEAN_REVERSION":
			result, err = evaluateChartMeanReversion(instance, markPrice, closes)
		case "MULTI_AGENT":
			result, err = evaluatePlaybookConfluence(instance, markPrice, closes)
		default:
			return Decision{}, fmt.Errorf("unsupported autonomous strategy family %q", instance.StrategyFamily)
		}
	} else {
		if family != "MOMENTUM" {
			return Decision{}, errors.New("autonomous strategy chart history is incomplete")
		}
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
	result.HypotheticalOrder["strategyFamily"] = family
	allocation, allocationOK := numberConfig(instance.Configuration, "allocationUsdt")
	fixedRiskPct := 0.0075
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

func evaluateChartMeanReversion(instance Instance, markPrice string, closes []domain.Decimal) (Decision, error) {
	if len(closes) < 21 {
		return Decision{}, errors.New("mean-reversion chart history is incomplete")
	}
	values := make([]float64, len(closes))
	for index, closeText := range closes {
		value, err := strconv.ParseFloat(string(closeText), 64)
		if err != nil || value <= 0 {
			return Decision{}, errors.New("mean-reversion chart contains an invalid close")
		}
		values[index] = value
	}
	window := values[len(values)-20:]
	mean := 0.0
	for _, value := range window {
		mean += value
	}
	mean /= float64(len(window))
	variance := 0.0
	for _, value := range window {
		variance += math.Pow(value-mean, 2)
	}
	deviation := math.Sqrt(variance / float64(len(window)))
	experiment, err := resolveSignalExperiment(instance)
	if err != nil {
		return Decision{}, err
	}
	lower, upper := mean-experiment.BollingerDeviation*deviation, mean+experiment.BollingerDeviation*deviation
	rsiValue := rsi(values, 14)
	current := values[len(values)-1]
	side, _ := stringConfig(instance.Configuration, "side")
	side = strings.ToUpper(side)
	kind, summary := "HOLD", "RSI ve Bollinger birlikte aşırı sapma teyidi üretmedi."
	if current <= lower && rsiValue <= experiment.RSILow && (side == "BUY" || side == "BOTH") {
		kind, summary = "BUY", "Alt Bollinger bandı ve düşük RSI RANGE dönüş sinyali üretti."
	} else if current >= upper && rsiValue >= experiment.RSIHigh && (side == "SELL" || side == "BOTH") {
		kind, summary = "SELL", "Üst Bollinger bandı ve yüksek RSI RANGE dönüş sinyali üretti."
	}
	metrics := map[string]any{"rsi14": roundFloat(rsiValue, 4), "bollingerMean": roundFloat(mean, 8), "bollingerLower": roundFloat(lower, 8), "bollingerUpper": roundFloat(upper, 8), "selectedSubStrategy": "RANGE_MEAN_REVERSION",
		"signalExperimentId": experiment.ID, "signalExperimentVariant": experiment.Variant, "bollingerDeviation": experiment.BollingerDeviation, "rsiLow": experiment.RSILow, "rsiHigh": experiment.RSIHigh}
	result := decision(instance, kind, summary, markPrice, strconv.FormatFloat(values[len(values)-2], 'f', -1, 64), metrics)
	attachSignalExperiment(result.HypotheticalOrder, experiment)
	return result, nil
}

func evaluatePlaybookConfluence(instance Instance, markPrice string, closes []domain.Decimal) (Decision, error) {
	momentum, momentumErr := evaluateChartMomentum(instance, markPrice, closes)
	meanReversion, meanErr := evaluateChartMeanReversion(instance, markPrice, closes)
	if momentumErr != nil {
		return Decision{}, momentumErr
	}
	if meanErr != nil {
		return Decision{}, meanErr
	}
	momentumActive, meanActive := momentum.HypotheticalOrder != nil, meanReversion.HypotheticalOrder != nil
	if momentumActive {
		if momentum.Metrics == nil {
			momentum.Metrics = make(map[string]any)
		}
		momentum.Metrics["selectedSubStrategy"] = "TREND_MOMENTUM"
		momentum.Summary = "Playbook Confluence TREND alt stratejisi: " + momentum.Summary
		return momentum, nil
	}
	if meanActive {
		meanReversion.Summary = "Playbook Confluence RANGE alt stratejisi: " + meanReversion.Summary
		return meanReversion, nil
	}
	return Decision{Kind: "HOLD", Summary: "Playbook Confluence alt stratejileri giriş üretmedi.", MarkPrice: markPrice, Metrics: map[string]any{"selectedSubStrategy": "NONE"}}, nil
}

func rsi(values []float64, period int) float64 {
	if len(values) <= period {
		return 50
	}
	gains, losses := 0.0, 0.0
	for index := len(values) - period; index < len(values); index++ {
		change := values[index] - values[index-1]
		if change > 0 {
			gains += change
		} else {
			losses -= change
		}
	}
	if losses == 0 {
		return 100
	}
	rs := gains / losses
	return 100 - 100/(1+rs)
}

func evaluateChartMomentum(instance Instance, markPrice string, closes []domain.Decimal) (Decision, error) {
	configuredThreshold, ok := numberConfig(instance.Configuration, "signalThresholdBps")
	if !ok || configuredThreshold <= 0 || len(closes) < 21 {
		return Decision{}, errors.New("autonomous chart momentum configuration is invalid")
	}
	experiment, err := resolveSignalExperiment(instance)
	if err != nil {
		return Decision{}, err
	}
	threshold := math.Max(5, configuredThreshold*experiment.MomentumMultiplier)
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
	metrics := map[string]any{"chartTimeframe": "1m", "chartSamples": len(values), "emaFast": roundFloat(fast, 8), "emaSlow": roundFloat(slow, 8), "chartMomentumBps": roundFloat(momentumBps, 4),
		"configuredThresholdBps": configuredThreshold, "thresholdBps": roundFloat(threshold, 4), "signalExperimentId": experiment.ID, "signalExperimentVariant": experiment.Variant}
	result := decision(instance, kind, summary, markPrice, strconv.FormatFloat(values[len(values)-2], 'f', -1, 64), metrics)
	attachSignalExperiment(result.HypotheticalOrder, experiment)
	return result, nil
}

const (
	paperSignalExperimentID      = "PAPER_SIGNAL_SENSITIVITY_V1"
	PaperTrainingStopLossBps     = float64(2000)
	PaperTrainingTakeProfitBps   = float64(300)
	PaperTrainingMinNetProfitBps = float64(300)
)

type signalExperiment struct {
	ID, Variant                            string
	MomentumMultiplier, BollingerDeviation float64
	RSILow, RSIHigh                        float64
}

func resolveSignalExperiment(instance Instance) (signalExperiment, error) {
	variant := "CONTROL"
	if instance.Mode == "PAPER" {
		if configured, ok := stringConfig(instance.Configuration, "signalExperimentVariant"); ok {
			variant = strings.ToUpper(strings.TrimSpace(configured))
		} else {
			variant = []string{"CONTROL", "BALANCED", "RESPONSIVE", "EXPLORATORY"}[stableSignalCohort(instance.ID)%4]
		}
	}
	switch variant {
	case "CONTROL":
		return signalExperiment{ID: paperSignalExperimentID, Variant: variant, MomentumMultiplier: 1, BollingerDeviation: 2, RSILow: 35, RSIHigh: 65}, nil
	case "BALANCED":
		return signalExperiment{ID: paperSignalExperimentID, Variant: variant, MomentumMultiplier: 0.75, BollingerDeviation: 1.8, RSILow: 37, RSIHigh: 63}, nil
	case "RESPONSIVE":
		return signalExperiment{ID: paperSignalExperimentID, Variant: variant, MomentumMultiplier: 0.5, BollingerDeviation: 1.6, RSILow: 39, RSIHigh: 61}, nil
	case "EXPLORATORY":
		return signalExperiment{ID: paperSignalExperimentID, Variant: variant, MomentumMultiplier: 0.3, BollingerDeviation: 1.5, RSILow: 40, RSIHigh: 60}, nil
	default:
		return signalExperiment{}, fmt.Errorf("unsupported PAPER signal experiment variant %q", variant)
	}
}

func stableSignalCohort(value string) uint32 {
	hash := uint32(2166136261)
	for index := 0; index < len(value); index++ {
		hash ^= uint32(value[index])
		hash *= 16777619
	}
	return hash
}

func attachSignalExperiment(order map[string]any, experiment signalExperiment) {
	if order == nil {
		return
	}
	order["signalExperimentId"] = experiment.ID
	order["signalExperimentVariant"] = experiment.Variant
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

func booleanConfig(configuration map[string]any, key string) bool {
	value, _ := configuration[key].(bool)
	return value
}

func newsConflicts(news NewsContext, side string) bool {
	if !news.Available || news.Confidence < 0.65 || math.Abs(news.Score) < 0.20 {
		return false
	}
	return (strings.EqualFold(side, "BUY") && news.Score < 0) || (strings.EqualFold(side, "SELL") && news.Score > 0)
}
func roundFloat(value float64, decimals int) float64 {
	factor := math.Pow10(decimals)
	return math.Round(value*factor) / factor
}
