package mysqlstore

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/performance"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/scoring"
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

// RefreshBotPerformance rebuilds the latest risk-adjusted snapshot from the
// canonical closed PAPER trades. It is intentionally independent from fills:
// fills are an audit ledger, while a round trip is the scoring evidence unit.
func (s *AccountStore) RefreshBotPerformance(ctx context.Context, botID string) error {
	var startingBalance, strategyVersionID, unrealized string
	err := s.database.QueryRowContext(ctx, `SELECT CAST(b.startingPaperBalance AS CHAR), COALESCE(b.strategyVersionId, ''),
COALESCE(CAST(p.unrealizedPnl AS CHAR), '0') FROM trading_bots b
LEFT JOIN trading_bot_paper_positions p ON p.tradingBotId = b.id WHERE b.id = ? AND b.mode = 'PAPER'`, botID).Scan(
		&startingBalance, &strategyVersionID, &unrealized)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("load paper performance identity: %w", err)
	}

	rows, err := s.database.QueryContext(ctx, `SELECT CAST(realizedPnl AS CHAR),
CAST(ABS(entryPrice - COALESCE(stopLoss, entryPrice)) * quantity AS CHAR),
CAST(entryPrice * quantity AS CHAR), CAST(fees AS CHAR), CAST(funding AS CHAR), CAST(slippageCost AS CHAR),
openedAt, closedAt, status FROM paper_trades
WHERE tradingBotId = ? AND status IN ('CLOSED', 'LIQUIDATED') ORDER BY closedAt, id`, botID)
	if err != nil {
		return fmt.Errorf("load closed paper trades: %w", err)
	}
	defer rows.Close()
	trades := make([]performance.Trade, 0)
	curve := []performance.EquityPoint{{At: time.Unix(0, 0).UTC(), Equity: startingBalance}}
	equity, parseErr := strconv.ParseFloat(startingBalance, 64)
	if parseErr != nil {
		return fmt.Errorf("parse paper starting balance: %w", parseErr)
	}
	liquidations := 0
	lastCurveAt := curve[0].At
	returns := make([]float64, 0)
	for rows.Next() {
		var trade performance.Trade
		var status string
		if err := rows.Scan(&trade.NetPnL, &trade.RiskAmount, &trade.Notional, &trade.Fees, &trade.FundingCost,
			&trade.SlippageCost, &trade.OpenedAt, &trade.ClosedAt, &status); err != nil {
			return fmt.Errorf("scan closed paper trade: %w", err)
		}
		if status == "LIQUIDATED" {
			liquidations++
		}
		if risk, riskErr := strconv.ParseFloat(trade.RiskAmount, 64); riskErr == nil && risk <= 0 {
			trade.RiskAmount = ""
		}
		pnl, err := strconv.ParseFloat(trade.NetPnL, 64)
		if err != nil {
			return fmt.Errorf("parse paper trade pnl: %w", err)
		}
		before := equity
		equity += pnl
		if equity <= 0 {
			equity = 0.00000001
		}
		if before > 0 {
			returns = append(returns, pnl/before)
		}
		at := trade.ClosedAt
		if !at.After(lastCurveAt) {
			at = lastCurveAt.Add(time.Nanosecond)
		}
		lastCurveAt = at
		curve = append(curve, performance.EquityPoint{At: at, Equity: strconv.FormatFloat(equity, 'f', 8, 64)})
		trades = append(trades, trade)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate closed paper trades: %w", err)
	}

	performanceService, err := performance.NewService(s)
	if err != nil {
		return err
	}
	snapshot, err := performanceService.ComputeAndSave(ctx, botID, strategyVersionID, nil, performance.Input{
		StartingBalance: startingBalance, UnrealizedPnL: unrealized, Trades: trades, EquityCurve: curve, PeriodsPerYear: 365 * 24 * 60,
	})
	if err != nil {
		return fmt.Errorf("compute paper performance: %w", err)
	}
	scoreService, err := scoring.NewService(scoring.DefaultConfig(), s)
	if err != nil {
		return err
	}
	_, err = scoreService.CalculateAndSave(ctx, botID, snapshot.SnapshotAt, scoring.Input{
		Metrics: snapshot.Metrics, LiquidationCount: liquidations, ReturnInstability: returnInstability(returns),
	})
	if err != nil {
		return fmt.Errorf("score paper performance: %w", err)
	}
	return nil
}

func returnInstability(returns []float64) float64 {
	if len(returns) < 2 {
		return 0
	}
	mean := 0.0
	for _, value := range returns {
		mean += value
	}
	mean /= float64(len(returns))
	variance := 0.0
	for _, value := range returns {
		difference := value - mean
		variance += difference * difference
	}
	return math.Sqrt(variance / float64(len(returns)-1))
}
