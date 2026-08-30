package mysqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

type AutonomousOrderInput struct {
	ID, IdempotencyKey, ClientOrderID string
	DecisionID                        int64
	Side                              domain.OrderSide
	PositionSide                      domain.PositionSide
	Type                              domain.OrderType
	Quantity                          domain.Decimal
	StopPrice                         domain.Decimal
	ReduceOnly                        bool
	Leverage                          int
}

func (s *AccountStore) MarkAutonomousExecution(ctx context.Context, decisionID int64, submitted bool, detail string) error {
	status := "NO_SUBMISSION"
	if submitted {
		status = "EXECUTED"
	} else {
		status = "REJECTED"
	}
	safety, err := json.Marshal(map[string]any{"mode": "DEMO", "riskGatePassed": true, "autonomousRiskApproved": true, "orderExecutionAllowed": true, "submittedToExchange": submitted, "environment": "TESTNET", "productionLive": false, "executionStatus": status, "detail": detail})
	if err != nil {
		return err
	}
	for attempt := 1; attempt <= mysqlTransactionAttempts; attempt++ {
		tx, beginErr := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
		if beginErr != nil {
			return beginErr
		}
		_, err = tx.ExecContext(ctx, `UPDATE trading_bot_signals SET safetyChecks = ? WHERE decisionId = ? AND source = 'RULE_ENGINE'`, safety, decisionID)
		if err == nil {
			campaignStatus := status
			if !submitted {
				campaignStatus = "REJECTED"
			}
			err = updateManualCampaignExecution(ctx, tx, decisionID, campaignStatus, status, detail, submitted, true)
		}
		if err == nil {
			err = tx.Commit()
		} else {
			_ = tx.Rollback()
		}
		if err == nil || !isRetryableMySQLTransactionError(err) || attempt == mysqlTransactionAttempts {
			return err
		}
		if err := waitMySQLTransactionRetry(ctx, attempt); err != nil {
			return err
		}
	}
	return err
}

// MarkAutonomousExecutionFailure augments the decision safety record without
// changing submittedToExchange. This is important when an entry reached the
// exchange but a later protective-order step failed.
func (s *AccountStore) MarkAutonomousExecutionFailure(ctx context.Context, decisionID int64, status, code, detail string) error {
	for attempt := 1; attempt <= mysqlTransactionAttempts; attempt++ {
		tx, beginErr := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
		if beginErr != nil {
			return beginErr
		}
		_, err := tx.ExecContext(ctx, `UPDATE trading_bot_signals
SET safetyChecks = JSON_SET(COALESCE(safetyChecks, JSON_OBJECT()),
  '$.mode', 'DEMO', '$.orderExecutionAllowed', true, '$.environment', 'TESTNET',
  '$.productionLive', false, '$.executionStatus', ?, '$.executionReasonCode', ?, '$.executionError', ?)
WHERE decisionId = ? AND source = 'RULE_ENGINE'`, status, code, detail, decisionID)
		if err == nil {
			err = updateManualCampaignExecution(ctx, tx, decisionID, status, code, detail, false, status != "RETRYING")
		}
		if err == nil {
			err = tx.Commit()
		} else {
			_ = tx.Rollback()
		}
		if err == nil || !isRetryableMySQLTransactionError(err) || attempt == mysqlTransactionAttempts {
			return err
		}
		if err := waitMySQLTransactionRetry(ctx, attempt); err != nil {
			return err
		}
	}
	return nil
}

func updateManualCampaignExecution(ctx context.Context, tx *sql.Tx, decisionID int64, status, code, detail string, submitted, clearInstruction bool) error {
	result, err := tx.ExecContext(ctx, `UPDATE manual_bot_campaign_items i
JOIN trading_bot_decisions d ON d.id = ? AND JSON_UNQUOTE(JSON_EXTRACT(d.metrics, '$.manualCampaignItemId')) = i.id
SET i.status = IF(i.status = 'EXECUTED', i.status, ?), i.reasonCode = ?, i.detail = ?, i.attemptedAt = UTC_TIMESTAMP(3),
    i.executedAt = IF(?, UTC_TIMESTAMP(3), i.executedAt), i.decisionId = d.id, i.updatedAt = UTC_TIMESTAMP(3)`,
		decisionID, status, code, detail, submitted)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return nil
	}
	if clearInstruction {
		if submitted {
			_, err = tx.ExecContext(ctx, `UPDATE trading_bots b
JOIN trading_bot_decisions d ON d.id = ? AND d.tradingBotId = b.id
SET b.configuration = JSON_SET(JSON_REMOVE(b.configuration, '$.manualBotEntry'), '$.manualPositionControl',
  JSON_SET(JSON_EXTRACT(b.configuration, '$.manualBotEntry'), '$.positionSide',
    IF(JSON_UNQUOTE(JSON_EXTRACT(b.configuration, '$.manualBotEntry.side')) = 'BUY', 'LONG', 'SHORT'))),
  b.version = b.version + 1
WHERE JSON_UNQUOTE(JSON_EXTRACT(b.configuration, '$.manualBotEntry.id')) = JSON_UNQUOTE(JSON_EXTRACT(d.metrics, '$.manualCampaignItemId'))`, decisionID)
		} else {
			_, err = tx.ExecContext(ctx, `UPDATE trading_bots b
JOIN trading_bot_decisions d ON d.id = ? AND d.tradingBotId = b.id
SET b.configuration = JSON_REMOVE(b.configuration, '$.manualBotEntry'), b.version = b.version + 1
WHERE JSON_UNQUOTE(JSON_EXTRACT(b.configuration, '$.manualBotEntry.id')) = JSON_UNQUOTE(JSON_EXTRACT(d.metrics, '$.manualCampaignItemId'))`, decisionID)
		}
		if err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `UPDATE manual_bot_campaigns c
JOIN manual_bot_campaign_items current ON current.campaignId = c.id
JOIN trading_bot_decisions d ON d.id = ? AND JSON_UNQUOTE(JSON_EXTRACT(d.metrics, '$.manualCampaignItemId')) = current.id
SET c.status = CASE
  WHEN EXISTS (SELECT 1 FROM manual_bot_campaign_items pending WHERE pending.campaignId = c.id AND pending.status IN ('QUEUED','PENDING_EXECUTION','RETRYING')) THEN 'RUNNING'
  WHEN EXISTS (SELECT 1 FROM manual_bot_campaign_items done WHERE done.campaignId = c.id AND done.status = 'EXECUTED') THEN 'COMPLETED'
  ELSE 'REJECTED' END,
  c.updatedAt = UTC_TIMESTAMP(3)`, decisionID)
	return err
}

func (s *AccountStore) ClearManualPositionControl(ctx context.Context, instance bot.Instance, side domain.PositionSide, now time.Time) error {
	_, err := s.database.ExecContext(ctx, `UPDATE trading_bots
SET configuration = JSON_REMOVE(configuration, '$.manualPositionControl'), version = version + 1, updatedAt = ?
WHERE id = ? AND userId = ?
  AND JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.manualPositionControl.positionSide')) = ?`,
		now.UTC(), instance.ID, instance.UserID, side)
	return err
}

func (s *AccountStore) MarkAutonomousReentryGuard(ctx context.Context, instance bot.Instance, candleOpenMS int64, reason string, now time.Time) error {
	if candleOpenMS <= 0 {
		return errors.New("autonomous reentry guard candle is invalid")
	}
	metadata, err := json.Marshal(map[string]any{"symbol": instance.Symbol, "reason": reason, "candleOpenMs": candleOpenMS, "timeframe": "15m", "productionLive": false})
	if err != nil {
		return err
	}
	tx, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err = tx.ExecContext(ctx, `UPDATE trading_bots SET configuration = JSON_SET(
COALESCE(configuration, JSON_OBJECT()), '$.testnetReentryAfterCandleOpenMs', ?, '$.testnetReentryGuardReason', ?, '$.testnetReentryGuardedAt', ?),
version = version + 1 WHERE userId = ? AND exchangeAccountId = ? AND type = 'AUTONOMOUS' AND mode = 'DEMO' AND symbol = ? AND lifecycleStatus <> 'ARCHIVED'`,
		candleOpenMS, reason, now.UTC().Format(time.RFC3339Nano), instance.UserID, instance.ExchangeAccountID, instance.Symbol); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO trading_audit_logs
(id, userId, exchangeAccountId, action, entityType, entityId, metadata, createdAt)
VALUES (UUID(), ?, ?, 'AUTONOMOUS_EXTERNAL_CLOSE_DETECTED', 'EXCHANGE_POSITION', ?, ?, ?)`,
		instance.UserID, instance.ExchangeAccountID, instance.Symbol, metadata, now.UTC()); err != nil {
		return err
	}
	return tx.Commit()
}

// CreateAutonomousOrder is deliberately restricted to an explicitly activated
// autonomous DEMO bot on a connected Binance TESTNET account owned by Go. The
// 5x-20x band is duplicated here as a transaction-time defense in depth gate.
func (s *AccountStore) CreateAutonomousOrder(ctx context.Context, instance bot.Instance, input AutonomousOrderInput, now time.Time) error {
	var err error
	for attempt := 1; attempt <= mysqlTransactionAttempts; attempt++ {
		err = s.createAutonomousOrderOnce(ctx, instance, input, now)
		if err == nil || !isRetryableMySQLTransactionError(err) || attempt == mysqlTransactionAttempts {
			return err
		}
		if err := waitMySQLTransactionRetry(ctx, attempt); err != nil {
			return err
		}
	}
	return err
}

func (s *AccountStore) createAutonomousOrderOnce(ctx context.Context, instance bot.Instance, input AutonomousOrderInput, now time.Time) error {
	tx, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	var mode, lifecycle, provider, environment, engine, connection string
	var botState, desired string
	var active, riskEnabled, accountKill, globalKill bool
	err = tx.QueryRowContext(ctx, `SELECT b.mode, b.lifecycleStatus, b.state, b.desiredState,
a.provider, a.environment, a.executionEngine, a.connectionStatus, a.isActive,
p.enabled, p.accountKillSwitch, c.globalKillSwitch
FROM trading_bots b JOIN exchange_accounts a ON a.id = b.exchangeAccountId
JOIN trading_risk_profiles p ON p.id = b.riskProfileId AND p.exchangeAccountId = a.id
JOIN trading_risk_controls c ON c.id = 'global'
WHERE b.id = ? AND b.userId = ? AND b.exchangeAccountId = ? AND b.type = 'AUTONOMOUS' FOR UPDATE`,
		instance.ID, instance.UserID, instance.ExchangeAccountID).Scan(&mode, &lifecycle, &botState, &desired,
		&provider, &environment, &engine, &connection, &active, &riskEnabled, &accountKill, &globalKill)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("autonomous execution bot is not eligible")
	}
	if err != nil {
		return err
	}
	if mode != "DEMO" || lifecycle != "PAPER" || botState != "RUNNING" || desired != "RUNNING" || provider != "BINANCE" || environment != "TESTNET" || engine != "GO" || connection != "CONNECTED" || !active || !riskEnabled || accountKill || globalKill {
		return errors.New("autonomous TESTNET execution gate is closed")
	}
	if input.Leverage < 5 || input.Leverage > 20 || strings.TrimSpace(string(input.Quantity)) == "" {
		return errors.New("autonomous TESTNET order exceeds canary constraints")
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO trading_orders
(id, userId, exchangeAccountId, previewId, decisionId, idempotencyKey, clientOrderId, symbol, side, positionSide, type, quantity,
stopPrice, leverage, marginMode, reduceOnly, source, executionEngine, status, createdAt, updatedAt)
VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?, NULLIF(?, ''), ?, 'ISOLATED', ?, 'SYSTEM', 'GO', 'SUBMITTING', ?, ?)`,
		input.ID, instance.UserID, instance.ExchangeAccountID, input.DecisionID, input.IdempotencyKey, input.ClientOrderID,
		instance.Symbol, input.Side, input.PositionSide, input.Type, input.Quantity, input.StopPrice, input.Leverage, input.ReduceOnly, now.UTC(), now.UTC())
	if err != nil {
		return fmt.Errorf("create autonomous TESTNET order: %w", err)
	}
	return tx.Commit()
}
