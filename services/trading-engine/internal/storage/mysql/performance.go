package mysqlstore

import (
	"context"
	"fmt"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/performance"
)

func (s *AccountStore) SaveBotMetric(ctx context.Context, snapshot performance.Snapshot, payload []byte) error {
	_, err := s.database.ExecContext(ctx, `INSERT INTO bot_metrics
(tradingBotId, strategyVersionId, marketRegimeSnapshotId, startingBalance, currentEquity,
 realizedPnl, unrealizedPnl, netPnl, totalTrades, wins, losses, maxDrawdown, metrics, snapshotAt, createdAt)
VALUES (?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
		snapshot.TradingBotID, snapshot.StrategyVersionID, snapshot.MarketRegimeSnapshotID,
		snapshot.Metrics.StartingBalance, snapshot.Metrics.CurrentEquity,
		snapshot.Metrics.RealizedPnL, snapshot.Metrics.UnrealizedPnL, snapshot.Metrics.NetPnL,
		snapshot.Metrics.TotalTrades, snapshot.Metrics.Wins, snapshot.Metrics.Losses,
		snapshot.Metrics.MaxDrawdown, payload, snapshot.SnapshotAt,
	)
	if err != nil {
		return fmt.Errorf("insert bot metric snapshot: %w", err)
	}
	return nil
}

var _ performance.SnapshotStore = (*AccountStore)(nil)
