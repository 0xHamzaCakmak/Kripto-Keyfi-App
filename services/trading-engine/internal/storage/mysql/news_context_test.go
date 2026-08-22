package mysqlstore

import "testing"

func TestClassifyNewsText(t *testing.T) {
	if classifyNewsText("ETF approved, strong inflow and adoption") != 1 {
		t.Fatal("bullish news was not classified")
	}
	if classifyNewsText("Borsa hack saldırısı ve delist riski") != -1 {
		t.Fatal("bearish news was not classified")
	}
	if classifyNewsText("routine market update") != 0 {
		t.Fatal("neutral news must remain neutral")
	}
}
