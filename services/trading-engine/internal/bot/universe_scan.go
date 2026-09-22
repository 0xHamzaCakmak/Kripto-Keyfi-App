package bot

import (
	"errors"
	"strings"
)

// Each bot owns an independent cursor. No strategy or bot identity is shared
// between markets, and a failing market cannot starve the rest of the universe.
func SelectUniverseMarket(instance *Instance, symbols []string) error {
	if instance.Type != "AUTONOMOUS" || instance.Mode != "DEMO" {
		return nil
	}
	if instance.Configuration["manualBotEntry"] != nil || instance.Configuration["manualPositionControl"] != nil {
		return nil
	}
	unique := make([]string, 0, len(symbols))
	seen := map[string]bool{}
	for _, symbol := range symbols {
		symbol = strings.ToUpper(strings.TrimSpace(symbol))
		if symbol != "" && !seen[symbol] {
			unique = append(unique, symbol)
			seen[symbol] = true
		}
	}
	if len(unique) == 0 {
		return errors.New("bot analysis universe has no enabled markets")
	}
	cursor := 0
	if last, ok := instance.Configuration["lastAnalyzedUniverseSymbol"].(string); ok {
		for i, symbol := range unique {
			if symbol == last {
				cursor = (i + 1) % len(unique)
				break
			}
		}
	}
	instance.LeaseSymbol = instance.Symbol
	instance.Symbol = unique[cursor]
	instance.UniverseScan = true
	return nil
}
