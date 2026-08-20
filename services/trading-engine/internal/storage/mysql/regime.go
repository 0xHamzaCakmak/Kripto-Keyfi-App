package mysqlstore

import (
	"context"
	"fmt"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/regime"
)

func (s *AccountStore) SaveMarketRegimeSnapshot(ctx context.Context, snapshot regime.Snapshot, features []byte) (uint64, error) {
	result, err := s.database.ExecContext(ctx, `INSERT INTO market_regime_snapshots
(symbol, timeframe, regime, confidence, features, observedAt, createdAt)
VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`, snapshot.Symbol, snapshot.Timeframe,
		snapshot.Classification.Regime, snapshot.Classification.Confidence, features, snapshot.ObservedAt)
	if err != nil {
		return 0, fmt.Errorf("insert market regime snapshot: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("read market regime snapshot id: %w", err)
	}
	return uint64(id), nil
}
