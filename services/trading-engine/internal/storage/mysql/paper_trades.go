package mysqlstore

import (
	"context"
	"errors"
	"fmt"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/paper"
)

func (s *AccountStore) CreatePaperTrade(ctx context.Context, trade paper.TradeRecord) error {
	_, err := s.database.ExecContext(ctx, `INSERT INTO paper_trades
(id, tradingBotId, strategyVersionId, symbol, side, status, entryPrice, quantity, leverage,
 fees, funding, slippageCost, realizedPnl, openedAt, createdAt, updatedAt)
VALUES (?, ?, NULLIF(?, ''), ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		trade.ID, trade.TradingBotID, trade.StrategyVersionID, trade.Symbol, trade.Side,
		trade.EntryPrice, trade.Quantity, trade.Leverage, trade.Fees, trade.Funding,
		trade.SlippageCost, trade.RealizedPnL, trade.OpenedAt,
	)
	if err != nil {
		return fmt.Errorf("insert autonomous paper trade: %w", err)
	}
	return nil
}

func (s *AccountStore) ClosePaperTrade(ctx context.Context, trade paper.TradeRecord) error {
	if trade.ClosedAt == nil {
		return errors.New("closed paper trade requires closed time")
	}
	result, err := s.database.ExecContext(ctx, `UPDATE paper_trades
SET status = ?, exitPrice = ?, fees = ?, funding = ?, slippageCost = ?, realizedPnl = ?, closedAt = ?, updatedAt = UTC_TIMESTAMP(3)
WHERE id = ? AND tradingBotId = ? AND status = 'OPEN'`,
		trade.Status, trade.ExitPrice, trade.Fees, trade.Funding, trade.SlippageCost,
		trade.RealizedPnL, *trade.ClosedAt, trade.ID, trade.TradingBotID,
	)
	if err != nil {
		return fmt.Errorf("close autonomous paper trade: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read autonomous paper trade update result: %w", err)
	}
	if affected != 1 {
		return errors.New("paper trade is not open or changed concurrently")
	}
	return nil
}

var _ paper.TradeStore = (*AccountStore)(nil)
