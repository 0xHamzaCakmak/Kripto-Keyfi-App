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
	Side                              domain.OrderSide
	Type                              domain.OrderType
	Quantity                          domain.Decimal
	StopPrice                         domain.Decimal
	ReduceOnly                        bool
	Leverage                          int
}

func (s *AccountStore) MarkAutonomousExecution(ctx context.Context, decisionID int64, submitted bool, detail string) error {
	safety, err := json.Marshal(map[string]any{"mode": "DEMO", "riskGatePassed": true, "autonomousRiskApproved": true, "orderExecutionAllowed": true, "submittedToExchange": submitted, "environment": "TESTNET", "productionLive": false, "detail": detail})
	if err != nil {
		return err
	}
	for attempt := 1; attempt <= mysqlTransactionAttempts; attempt++ {
		_, err = s.database.ExecContext(ctx, `UPDATE trading_bot_signals SET safetyChecks = ? WHERE decisionId = ? AND source = 'RULE_ENGINE'`, safety, decisionID)
		if err == nil || !isRetryableMySQLTransactionError(err) || attempt == mysqlTransactionAttempts {
			return err
		}
		if err := waitMySQLTransactionRetry(ctx, attempt); err != nil {
			return err
		}
	}
	return err
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
(id, userId, exchangeAccountId, previewId, idempotencyKey, clientOrderId, symbol, side, type, quantity,
stopPrice, leverage, marginMode, reduceOnly, source, executionEngine, status, createdAt, updatedAt)
VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, 'ISOLATED', ?, 'SYSTEM', 'GO', 'SUBMITTING', ?, ?)`,
		input.ID, instance.UserID, instance.ExchangeAccountID, input.IdempotencyKey, input.ClientOrderID,
		instance.Symbol, input.Side, input.Type, input.Quantity, input.StopPrice, input.Leverage, input.ReduceOnly, now.UTC(), now.UTC())
	if err != nil {
		return fmt.Errorf("create autonomous TESTNET order: %w", err)
	}
	return tx.Commit()
}
