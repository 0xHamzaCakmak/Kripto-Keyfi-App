package bot

import (
	"fmt"
	"math/big"
	"testing"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

func TestScalpingWarmsUpBeforeSignal(t *testing.T) {
	instance := scalpingInstance("SHADOW")
	decision, err := EvaluateStrategy(instance, "50000", "")
	if err != nil || decision.Kind != "WARMING_UP" || decision.HypotheticalOrder != nil {
		t.Fatalf("unexpected warmup: %#v %v", decision, err)
	}
}

func TestScalpingPaperCreatesSafeHypotheticalOrder(t *testing.T) {
	instance := scalpingInstance("PAPER")
	decision, err := EvaluateStrategy(instance, "50150", "50000")
	if err != nil || decision.Kind != "BUY" {
		t.Fatalf("expected buy signal: %#v %v", decision, err)
	}
	if decision.HypotheticalOrder["submittedToExchange"] != false || decision.HypotheticalOrder["quantity"] != "0.001" {
		t.Fatalf("paper order escaped safety boundary: %#v", decision.HypotheticalOrder)
	}
}

func TestScalpingShadowCreatesSimulationOnlyOrder(t *testing.T) {
	instance := scalpingInstance("SHADOW")
	decision, err := EvaluateStrategy(instance, "50150", "50000")
	if err != nil || decision.Kind != "BUY" {
		t.Fatalf("expected shadow buy signal: %#v %v", decision, err)
	}
	if decision.HypotheticalOrder["mode"] != "SHADOW" || decision.HypotheticalOrder["submittedToExchange"] != false {
		t.Fatalf("shadow order escaped simulation boundary: %#v", decision.HypotheticalOrder)
	}
}

func TestScalpingHonorsConfiguredSide(t *testing.T) {
	instance := scalpingInstance("PAPER")
	instance.Configuration["side"] = "BUY"
	decision, err := EvaluateStrategy(instance, "49800", "50000")
	if err != nil || decision.Kind != "HOLD" || decision.HypotheticalOrder != nil {
		t.Fatalf("sell signal ignored configured side: %#v %v", decision, err)
	}
}

func TestGridSignalsOnLevelCrossing(t *testing.T) {
	instance := gridInstance("PAPER")
	buy, err := EvaluateStrategy(instance, "52000", "56000")
	if err != nil || buy.Kind != "GRID_BUY" || buy.HypotheticalOrder["side"] != "BUY" {
		t.Fatalf("expected grid buy: %#v %v", buy, err)
	}
	sell, err := EvaluateStrategy(instance, "58000", "52000")
	if err != nil || sell.Kind != "GRID_SELL" || sell.HypotheticalOrder["side"] != "SELL" {
		t.Fatalf("expected grid sell: %#v %v", sell, err)
	}
}

func TestGridHoldsOutsideConfiguredRange(t *testing.T) {
	decision, err := EvaluateStrategy(gridInstance("SHADOW"), "81000", "79000")
	if err != nil || decision.Kind != "OUT_OF_RANGE" || decision.HypotheticalOrder != nil {
		t.Fatalf("unexpected out-of-range decision: %#v %v", decision, err)
	}
}

func TestAutonomousMomentumCreatesRiskProtectedSimulationOnlyIntent(t *testing.T) {
	instance := autonomousMomentumInstance("PAPER")
	decision, err := EvaluateStrategy(instance, "50150", "50000")
	if err != nil || decision.Kind != "BUY" {
		t.Fatalf("expected autonomous momentum buy: %#v %v", decision, err)
	}
	order := decision.HypotheticalOrder
	if order["submittedToExchange"] != false || order["marginMode"] != "ISOLATED" || order["stopLoss"] == "" || order["takeProfit"] == "" {
		t.Fatalf("autonomous intent escaped safety/protection boundary: %#v", order)
	}
}

func TestAutonomousStrategyRejectsUnknownFamilyAndMissingProtection(t *testing.T) {
	unknown := autonomousMomentumInstance("PAPER")
	unknown.StrategyFamily = "CUSTOM"
	if _, err := EvaluateStrategy(unknown, "50150", "50000"); err == nil {
		t.Fatal("unknown autonomous family should fail closed")
	}
	missing := autonomousMomentumInstance("PAPER")
	delete(missing.Configuration, "stopLossBps")
	if _, err := EvaluateStrategy(missing, "50150", "50000"); err == nil {
		t.Fatal("missing autonomous protection should fail closed")
	}
}

func TestAutonomousUsesChartMomentumAndAllocationSizing(t *testing.T) {
	instance := autonomousMomentumInstance("PAPER")
	instance.Configuration["signalThresholdBps"] = float64(5)
	closes := make([]domain.Decimal, 50)
	for index := range closes {
		closes[index] = domain.Decimal(decimalStringForTest(100 + float64(index)*0.25))
	}
	decision, err := EvaluateStrategyWithChart(instance, "112.25", "100", closes)
	if err != nil || decision.Kind != "BUY" {
		t.Fatalf("expected chart-confirmed buy: %#v err=%v", decision, err)
	}
	if decision.Metrics["chartSamples"] != 50 || decision.HypotheticalOrder["quantity"] == "0.001" || decision.HypotheticalOrder["leverage"] != 5 {
		t.Fatalf("chart/allocation sizing was not applied: %#v", decision)
	}
}

func TestPaperSignalExperimentChangesOnlyPaperSensitivity(t *testing.T) {
	closes := make([]domain.Decimal, 50)
	for index := range closes {
		closes[index] = domain.Decimal(decimalStringForTest(100 + float64(index)*0.02))
	}
	paper := autonomousMomentumInstance("PAPER")
	paper.Configuration["signalThresholdBps"] = float64(25)
	paper.Configuration["signalExperimentVariant"] = "EXPLORATORY"
	paperDecision, err := EvaluateStrategyWithChart(paper, "100.98", "100", closes)
	if err != nil || paperDecision.Metrics["signalExperimentVariant"] != "EXPLORATORY" || paperDecision.Metrics["thresholdBps"] != 7.5 {
		t.Fatalf("PAPER signal experiment was not applied: %#v err=%v", paperDecision, err)
	}
	demo := paper
	demo.Mode = "DEMO"
	demoDecision, err := EvaluateStrategyWithChart(demo, "100.98", "100", closes)
	if err != nil || demoDecision.Metrics["signalExperimentVariant"] != "CONTROL" || demoDecision.Metrics["thresholdBps"] != float64(25) {
		t.Fatalf("TESTNET sensitivity changed by PAPER experiment: %#v err=%v", demoDecision, err)
	}
}

func TestPaperSignalExperimentRejectsUnknownConfiguredVariant(t *testing.T) {
	instance := autonomousMomentumInstance("PAPER")
	instance.Configuration["signalExperimentVariant"] = "UNKNOWN"
	closes := make([]domain.Decimal, 21)
	for index := range closes {
		closes[index] = domain.Decimal(decimalStringForTest(100 + float64(index)))
	}
	if _, err := EvaluateStrategyWithChart(instance, "120", "100", closes); err == nil {
		t.Fatal("unknown PAPER signal experiment variant should fail closed")
	}
}

func TestAutonomousMarketEntryCarriesCompletePlaybookEvidence(t *testing.T) {
	instance := autonomousMomentumInstance("PAPER")
	instance.Configuration["signalThresholdBps"] = float64(5)
	decision, err := EvaluateStrategyWithMarket(instance, "209.5", "209", trendingSnapshot(1))
	if err != nil || decision.Kind != "BUY" || decision.HypotheticalOrder == nil {
		t.Fatalf("expected playbook-confirmed entry: %#v err=%v", decision, err)
	}
	order := decision.HypotheticalOrder
	if order["marketRegime"] != "TREND" || order["higherTimeframeAligned"] != true || order["confirmedTimeframes"] != 3 || order["derivativesAligned"] != true {
		t.Fatalf("entry evidence is incomplete: %#v", order)
	}
	stopBps, stopOK := order["stopLossBps"].(float64)
	takeBps, takeOK := order["takeProfitBps"].(float64)
	if !stopOK || !takeOK || stopBps > PaperTrainingStopLossBps || takeBps < PaperTrainingTakeProfitBps || order["fixedRiskPct"] != 0.0075 || order["riskPlanVersion"] != "PAPER_TRAINING_20PCT_STOP_V1" {
		t.Fatalf("adaptive risk plan is incomplete: %#v", order)
	}
	quantity, quantityOK := decimalRat(order["quantity"].(string))
	if !quantityOK {
		t.Fatalf("adaptive quantity is invalid: %#v", order)
	}
	mark, _ := decimalRat("209.5")
	notional := new(big.Rat).Mul(quantity, mark)
	leverage := int64(order["leverage"].(int))
	if notional.Cmp(big.NewRat(100*leverage, 1)) > 0 {
		t.Fatalf("adaptive PAPER quantity exceeded leveraged allocation: %#v", order)
	}
	margin := new(big.Rat).Quo(notional, big.NewRat(leverage, 1))
	if margin.Cmp(big.NewRat(20, 1)) < 0 {
		t.Fatalf("adaptive PAPER quantity did not reserve the 20 USDT minimum margin: %#v", order)
	}
	conflicting := trendingSnapshot(1)
	conflicting.Derivatives.FundingRate = "0.002"
	testnet := instance
	testnet.Mode = "DEMO"
	hold, err := EvaluateStrategyWithMarket(testnet, "209.5", "209", conflicting)
	if err != nil || hold.HypotheticalOrder != nil {
		t.Fatalf("TESTNET unconfirmed entry was not held: %#v err=%v", hold, err)
	}
}

func TestContinuousPaperTrainingEntryCarriesIsolatedRiskContract(t *testing.T) {
	instance := autonomousMomentumInstance("PAPER")
	closes := make([]domain.Decimal, 30)
	for index := range closes {
		closes[index] = domain.Decimal(decimalStringForTest(100 + float64(index)*0.1))
	}
	result, err := paperContinuousTrainingDecision(instance, "103", "102.9", closes)
	if err != nil || result.HypotheticalOrder == nil {
		t.Fatalf("continuous PAPER decision failed: %#v err=%v", result, err)
	}
	order := result.HypotheticalOrder
	if order["marginMode"] != "ISOLATED" || order["continuousTrainingEntry"] != true || order["martingaleAllowed"] != false {
		t.Fatalf("continuous PAPER risk contract is incomplete: %#v", order)
	}
}

func TestPaperNewsFilterVetoesOnlyConflictingTrustedEvidence(t *testing.T) {
	instance := autonomousMomentumInstance("PAPER")
	instance.Configuration["signalThresholdBps"] = float64(5)
	instance.Configuration["newsFilterEnabled"] = true
	snapshot := trendingSnapshot(1)
	snapshot.News = NewsContext{Available: true, Bias: "BEARISH", Score: -0.8, Confidence: 0.9, ArticleIDs: []string{"news-1"}}
	decision, err := EvaluateStrategyWithMarket(instance, "209.5", "209", snapshot)
	if err != nil || decision.Kind != "HOLD" || decision.HypotheticalOrder != nil || decision.Metrics["newsScore"] != -0.8 {
		t.Fatalf("conflicting news was not vetoed: %#v err=%v", decision, err)
	}
	instance.Configuration["newsFilterEnabled"] = false
	decision, err = EvaluateStrategyWithMarket(instance, "209.5", "209", snapshot)
	if err != nil || decision.Kind != "BUY" || decision.HypotheticalOrder == nil {
		t.Fatalf("A/B control bot was changed by news: %#v err=%v", decision, err)
	}
}

func TestRangeMeanReversionRequiresRSIAndBollingerConfluence(t *testing.T) {
	instance := autonomousMomentumInstance("PAPER")
	instance.StrategyFamily = "RSI_MEAN_REVERSION"
	closes := make([]domain.Decimal, 30)
	for index := range closes {
		closes[index] = "100"
	}
	closes[len(closes)-1] = "80"
	decision, err := EvaluateStrategyWithChart(instance, "80", "100", closes)
	if err != nil || decision.Kind != "BUY" || decision.HypotheticalOrder == nil || decision.Metrics["selectedSubStrategy"] != "RANGE_MEAN_REVERSION" {
		t.Fatalf("RANGE confluence did not produce mean-reversion entry: %#v err=%v", decision, err)
	}
}

func TestPlaybookConfluenceSelectsTrendSubStrategy(t *testing.T) {
	instance := autonomousMomentumInstance("PAPER")
	instance.StrategyFamily = "MULTI_AGENT"
	instance.Configuration["signalThresholdBps"] = float64(5)
	closes := make([]domain.Decimal, 50)
	for index := range closes {
		closes[index] = domain.Decimal(decimalStringForTest(100 + float64(index)*0.25))
	}
	decision, err := EvaluateStrategyWithChart(instance, "112.25", "100", closes)
	if err != nil || decision.Kind != "BUY" || decision.HypotheticalOrder == nil || decision.Metrics["selectedSubStrategy"] != "TREND_MOMENTUM" {
		t.Fatalf("Playbook Confluence did not select trend strategy: %#v err=%v", decision, err)
	}
}

func decimalStringForTest(value float64) string {
	return fmt.Sprintf("%.8f", value)
}

func scalpingInstance(mode string) Instance {
	return Instance{ID: "bot-1", Type: "SCALPING", Mode: mode, Symbol: "BTCUSDT", Configuration: map[string]any{
		"side": "BOTH", "quantity": "0.001", "leverage": float64(2), "signalThresholdBps": float64(25),
	}}
}

func gridInstance(mode string) Instance {
	return Instance{ID: "bot-2", Type: "GRID", Mode: mode, Symbol: "BTCUSDT", Configuration: map[string]any{
		"lowerPrice": "50000", "upperPrice": "80000", "gridLevels": float64(7), "quantityPerGrid": "0.001", "leverage": float64(2),
	}}
}

func autonomousMomentumInstance(mode string) Instance {
	return Instance{ID: "autonomous-1", Type: "AUTONOMOUS", StrategyFamily: "MOMENTUM", Mode: mode, Symbol: "BTCUSDT", Configuration: map[string]any{
		"side": "BOTH", "quantity": "0.001", "leverage": float64(5), "signalThresholdBps": float64(25),
		"marginMode": "ISOLATED", "stopLossBps": float64(50), "takeProfitBps": float64(100),
		"allocationUsdt": float64(100), "positionNotionalPct": float64(0.10),
		"paperFeeBps": float64(4), "paperSlippageBps": float64(2),
	}}
}
