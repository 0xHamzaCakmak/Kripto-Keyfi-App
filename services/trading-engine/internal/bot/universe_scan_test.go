package bot

import (
	"fmt"
	"testing"
)

func TestEachBotVisitsAllTwentyMarketsAndResumesItsOwnCursor(t *testing.T) {
	var symbols []string
	for i := 0; i < 20; i++ {
		symbols = append(symbols, fmt.Sprintf("COIN%dUSDT", i))
	}
	for b := 0; b < 20; b++ {
		configuration := map[string]any{}
		seen := map[string]bool{}
		for step := 0; step < 20; step++ {
			instance := Instance{ID: fmt.Sprint(b), Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "BTCUSDT", Configuration: configuration}
			if err := SelectUniverseMarket(&instance, symbols); err != nil {
				t.Fatal(err)
			}
			if instance.LeaseSymbol != "BTCUSDT" || !instance.UniverseScan {
				t.Fatal("lease identity lost")
			}
			seen[instance.Symbol] = true
			configuration["lastAnalyzedUniverseSymbol"] = instance.Symbol
		}
		if len(seen) != 20 {
			t.Fatalf("bot %d only visited %d markets", b, len(seen))
		}
	}
}

func TestUniverseScanPreservesManualInstructionsAndRejectsEmptyUniverse(t *testing.T) {
	instance := Instance{Type: "AUTONOMOUS", Mode: "DEMO", Symbol: "BTCUSDT", Configuration: map[string]any{"manualBotEntry": map[string]any{"id": "manual"}}}
	if err := SelectUniverseMarket(&instance, []string{"ETHUSDT"}); err != nil || instance.Symbol != "BTCUSDT" || instance.UniverseScan {
		t.Fatal("manual route changed")
	}
	delete(instance.Configuration, "manualBotEntry")
	if err := SelectUniverseMarket(&instance, nil); err == nil {
		t.Fatal("empty universe accepted")
	}
	instance.Configuration["lastAnalyzedUniverseSymbol"] = "REMOVEDUSDT"
	if err := SelectUniverseMarket(&instance, []string{"ETHUSDT", "ETHUSDT"}); err != nil || instance.Symbol != "ETHUSDT" {
		t.Fatal("universe edit did not recover")
	}
}
