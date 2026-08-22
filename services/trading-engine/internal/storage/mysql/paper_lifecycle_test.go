package mysqlstore

import "testing"

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
