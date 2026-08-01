package tradingv1

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

func TestCommandMetaRequiresIdempotencyAndClientOrderIDs(t *testing.T) {
	valid := CommandMeta{
		RequestID: "req-1", ActorUserID: "user-1",
		IdempotencyKey: "manual_order_123456", ClientOrderID: "kk_123456",
		RequestedAt: time.Now(),
	}
	if err := valid.Validate(); err != nil {
		t.Fatalf("expected valid command metadata: %v", err)
	}

	valid.IdempotencyKey = ""
	if err := valid.Validate(); err == nil {
		t.Fatal("missing idempotency key must be rejected")
	}
	valid.IdempotencyKey = "manual_order_123456"
	valid.ClientOrderID = ""
	if err := valid.Validate(); err == nil {
		t.Fatal("missing client order id must be rejected")
	}
}

func TestFinancialValuesSerializeAsStrings(t *testing.T) {
	payload := PlaceOrderCommand{Quantity: domain.Decimal("0.0159"), Price: domain.Decimal("62565.4")}
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	jsonText := string(encoded)
	if !strings.Contains(jsonText, `"quantity":"0.0159"`) || !strings.Contains(jsonText, `"price":"62565.4"`) {
		t.Fatalf("financial values must remain JSON strings: %s", jsonText)
	}
}

func TestContractUsesVersionedInternalPaths(t *testing.T) {
	for _, path := range []string{SymbolsPath, BalancesPath, OrdersPath, PositionsPath, ReconciliationPath} {
		if !strings.HasPrefix(path, "/internal/v1/") {
			t.Fatalf("unversioned internal path: %s", path)
		}
	}
}
