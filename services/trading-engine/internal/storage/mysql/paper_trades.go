package mysqlstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/paper"
)

func (s *AccountStore) CreatePaperTrade(ctx context.Context, trade paper.TradeRecord) error {
	var marketContext any
	if trade.MarketContext != nil {
		encoded, err := json.Marshal(trade.MarketContext)
		if err != nil {
			return fmt.Errorf("encode paper trade market context: %w", err)
		}
		marketContext = encoded
	}
	_, err := s.database.ExecContext(ctx, `INSERT INTO paper_trades
(id, tradingBotId, strategyVersionId, marketRegimeSnapshotId, symbol, side, status, entryPrice, quantity, leverage,
 fees, funding, slippageCost, realizedPnl, stopLoss, takeProfit, maxFavorableExcursion, maxAdverseExcursion,
 marketContext, aiConfidence, decisionSummary, openedAt, createdAt, updatedAt)
VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, ?, NULLIF(?, ''), ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		trade.ID, trade.TradingBotID, trade.StrategyVersionID, trade.MarketRegimeSnapshotID, trade.Symbol, trade.Side,
		trade.EntryPrice, trade.Quantity, trade.Leverage, trade.Fees, trade.Funding,
		trade.SlippageCost, trade.RealizedPnL, trade.StopLoss, trade.TakeProfit,
		trade.MaxFavorableExcursion, trade.MaxAdverseExcursion, marketContext, trade.AIConfidence, trade.DecisionSummary, trade.OpenedAt,
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
SET status = ?, exitPrice = ?, fees = ?, funding = ?, slippageCost = ?, realizedPnl = ?,
 maxFavorableExcursion = ?, maxAdverseExcursion = ?, holdingSeconds = ?, closeReason = ?,
 closedAt = ?, updatedAt = UTC_TIMESTAMP(3)
WHERE id = ? AND tradingBotId = ? AND status = 'OPEN'`,
		trade.Status, trade.ExitPrice, trade.Fees, trade.Funding, trade.SlippageCost,
		trade.RealizedPnL, trade.MaxFavorableExcursion, trade.MaxAdverseExcursion,
		trade.HoldingSeconds, trade.CloseReason, *trade.ClosedAt, trade.ID, trade.TradingBotID,
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
