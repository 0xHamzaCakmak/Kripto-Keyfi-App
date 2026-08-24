package mysqlstore

import (
	"math/big"
	"testing"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/autonomousrisk"
)

func TestPaperProtectionTriggerLongAndShort(t *testing.T) {
	long := &openPaperTrade{Side: "BUY", StopLoss: "95", TakeProfit: "110"}
	if got := paperProtectionTrigger(long, "94"); got != "STOP_LOSS" {
		t.Fatalf("long stop: %s", got)
	}
	if got := paperProtectionTrigger(long, "111"); got != "TAKE_PROFIT" {
		t.Fatalf("long target: %s", got)
	}
	if got := paperProtectionTrigger(long, "100"); got != "" {
		t.Fatalf("long hold: %s", got)
	}
	short := &openPaperTrade{Side: "SELL", StopLoss: "105", TakeProfit: "90"}
	if got := paperProtectionTrigger(short, "106"); got != "STOP_LOSS" {
		t.Fatalf("short stop: %s", got)
	}
	if got := paperProtectionTrigger(short, "89"); got != "TAKE_PROFIT" {
		t.Fatalf("short target: %s", got)
	}
}

func TestPaperExcursionsRetainBestAndWorst(t *testing.T) {
	trade := &openPaperTrade{Side: "BUY", EntryPrice: "100", Quantity: "2", MaxFavorableExcursion: "1", MaxAdverseExcursion: "3"}
	favorable, adverse, err := paperExcursions(trade, "105")
	if err != nil {
		t.Fatal(err)
	}
	if favorable != "10.000000000000000000" || adverse != "3.000000000000000000" {
		t.Fatalf("unexpected favorable/adverse: %s %s", favorable, adverse)
	}
	trade.MaxFavorableExcursion, trade.MaxAdverseExcursion = favorable, adverse
	_, adverse, err = paperExcursions(trade, "96")
	if err != nil || adverse != "8.000000000000000000" {
		t.Fatalf("unexpected adverse: %s err=%v", adverse, err)
	}
}

func TestPaperAccountingIncludesEntryAndExitCosts(t *testing.T) {
	net, err := subtractDecimals("5", "0.2", "0.3")
	if err != nil || net != "4.500000000000000000" {
		t.Fatalf("unexpected net: %s err=%v", net, err)
	}
	total, err := addDecimals("0.2", "0.3")
	if err != nil || total != "0.500000000000000000" {
		t.Fatalf("unexpected fees: %s err=%v", total, err)
	}
}

func TestPaperTrainingPolicyIsSeparateFromTestnetAndSupportsOneHundredPositions(t *testing.T) {
	base := autonomousrisk.Policy{MaxConcurrentPositions: 100}
	if got := autonomousPolicyForMode(base, "PAPER").MaxConcurrentPositions; got != 100 {
		t.Fatalf("paper maximum: %d", got)
	}
	if got := autonomousPolicyForMode(base, "DEMO").MaxConcurrentPositions; got != 15 {
		t.Fatalf("testnet maximum changed: %d", got)
	}
	base.MaxConcurrentPositions = 40
	if got := autonomousPolicyForMode(base, "PAPER").MaxConcurrentPositions; got != 40 {
		t.Fatalf("paper did not honor persisted admin maximum: %d", got)
	}
}

func TestPaperTrainingExposureCapacityIsSeparateFromTestnet(t *testing.T) {
	base := autonomousrisk.Policy{MaxConcurrentPositions: 100, MaxPositionSize: "100", MaxTotalExposure: "1500", MaxSymbolExposure: "1500"}
	training := paperTrainingExposurePolicy(autonomousPolicyForMode(base, "PAPER"))
	if training.MaxTotalExposure != "10000" || training.MaxSymbolExposure != "10000" {
		t.Fatalf("paper fleet exposure was not sized for 100 independent allocations: %#v", training)
	}
	testnet := autonomousPolicyForMode(base, "DEMO")
	if testnet.MaxConcurrentPositions != 15 || testnet.MaxTotalExposure != "1500" || testnet.MaxSymbolExposure != "1500" {
		t.Fatalf("testnet policy was changed by PAPER training capacity: %#v", testnet)
	}
}

func TestPaperDoesNotRequirePrivateExchangeWriteReadiness(t *testing.T) {
	if botModeRequiresConnectedAccount("PAPER") || botModeRequiresConnectedAccount("SHADOW") {
		t.Fatal("read-only simulation modes must survive a degraded private exchange connection")
	}
	if !botModeRequiresConnectedAccount("DEMO") {
		t.Fatal("Futures Testnet execution must keep the connected-account gate")
	}
}

func TestDuplicatePaperSignalIsSuppressedPerMarketBar(t *testing.T) {
	if !duplicatePaperSignal("BTCUSDT:1000:BUY", "BTCUSDT:1000:BUY") {
		t.Fatal("same-bar signal was not suppressed")
	}
	if duplicatePaperSignal("BTCUSDT:1000:BUY", "BTCUSDT:2000:BUY") {
		t.Fatal("new market bar was incorrectly suppressed")
	}
}

func TestCoreUniverseBlocksNewExposureButNeverRiskReducingExit(t *testing.T) {
	if coreUniverseAllowsExposure(false, true, false) || coreUniverseAllowsExposure(false, false, false) {
		t.Fatal("disabled or missing Core Universe symbols must reject new exposure")
	}
	if !coreUniverseAllowsExposure(false, true, true) || !coreUniverseAllowsExposure(true, true, false) {
		t.Fatal("enabled entries and risk-reducing exits must remain allowed")
	}
}

func TestPaperTradesNeverMergeWhileTestnetKeepsExplicitPyramidingConfig(t *testing.T) {
	configuration := map[string]any{"pyramidingEnabled": true}
	if paperPyramidingAllowed("PAPER", configuration) {
		t.Fatal("PAPER trades must remain independent and never pyramid into an open trade")
	}
	if !paperPyramidingAllowed("DEMO", configuration) || paperPyramidingAllowed("DEMO", map[string]any{}) {
		t.Fatal("TESTNET pyramiding must remain a separate explicit configuration")
	}
}

func TestConfiguredProtectionPrices(t *testing.T) {
	config := map[string]any{"stopLossBps": float64(50), "takeProfitBps": float64(100)}
	stop, take, err := configuredProtectionPrices(config, "BUY", "100")
	if err != nil || stop != "99.500000000000000000" || take != "101.000000000000000000" {
		t.Fatalf("unexpected long protection: %s %s err=%v", stop, take, err)
	}
	stop, take, err = configuredProtectionPrices(config, "SELL", "100")
	if err != nil || stop != "100.500000000000000000" || take != "99.000000000000000000" {
		t.Fatalf("unexpected short protection: %s %s err=%v", stop, take, err)
	}
}

func TestPaperTrainingTargetClearsThreePercentAfterFeesAndSlippage(t *testing.T) {
	config := map[string]any{
		"paperTrainingMode": true, "stopLossBps": float64(2000), "takeProfitBps": float64(300),
		"minimumNetProfitBps": float64(300), "paperFeeBps": float64(4), "paperSlippageBps": float64(2),
	}
	for _, side := range []string{"BUY", "SELL"} {
		_, target, err := configuredProtectionPrices(config, side, "100")
		if err != nil {
			t.Fatalf("%s target: %v", side, err)
		}
		mark, _ := new(big.Rat).SetString(target)
		entry := big.NewRat(100, 1)
		feeRate := bpsRat(4)
		slippageRate := bpsRat(2)
		exit := new(big.Rat).Set(mark)
		if side == "BUY" {
			exit.Mul(exit, new(big.Rat).Sub(big.NewRat(1, 1), slippageRate))
		} else {
			exit.Mul(exit, new(big.Rat).Add(big.NewRat(1, 1), slippageRate))
		}
		gross := new(big.Rat).Sub(exit, entry)
		if side == "SELL" {
			gross.Neg(gross)
		}
		fees := new(big.Rat).Mul(new(big.Rat).Add(entry, exit), feeRate)
		netRate := new(big.Rat).Quo(new(big.Rat).Sub(gross, fees), entry)
		if netRate.Cmp(big.NewRat(3, 100)) < 0 {
			t.Fatalf("%s net target below 3%%: target=%s net=%s", side, target, netRate.FloatString(8))
		}
	}
}
