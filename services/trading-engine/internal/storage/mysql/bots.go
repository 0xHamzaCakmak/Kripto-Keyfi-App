package mysqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/autonomousrisk"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
)

func (s *AccountStore) AcquireNext(ctx context.Context, owner string, now, leaseUntil time.Time) (*bot.Instance, error) {
	tx, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, fmt.Errorf("begin bot lease: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	const query = `SELECT id, userId, exchangeAccountId, name, type, mode, symbol, state, desiredState, intervalSeconds, configuration, schedulerOwner, leaseExpiresAt
FROM trading_bots
WHERE desiredState = 'RUNNING'
  AND state IN ('STARTING', 'RUNNING', 'RISK_BLOCKED', 'RECONCILING', 'ERROR')
  AND (leaseExpiresAt IS NULL OR leaseExpiresAt < ? OR schedulerOwner = ?)
  AND (lastDecisionAt IS NULL OR lastDecisionAt <= DATE_SUB(?, INTERVAL intervalSeconds SECOND))
ORDER BY COALESCE(lastDecisionAt, createdAt), id
LIMIT 1 FOR UPDATE SKIP LOCKED`
	var instance bot.Instance
	var configuration []byte
	var previousOwner sql.NullString
	var previousLease sql.NullTime
	err = tx.QueryRowContext(ctx, query, now, owner, now).Scan(
		&instance.ID, &instance.UserID, &instance.ExchangeAccountID, &instance.Name, &instance.Type,
		&instance.Mode, &instance.Symbol, &instance.State, &instance.DesiredState, &instance.IntervalSeconds, &configuration,
		&previousOwner, &previousLease,
	)
	if errors.Is(err, sql.ErrNoRows) {
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("commit empty bot lease: %w", err)
		}
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("select bot lease: %w", err)
	}
	if err := json.Unmarshal(configuration, &instance.Configuration); err != nil {
		return nil, fmt.Errorf("decode bot configuration: %w", err)
	}
	instance.NeedsReconciliation = instance.State == bot.StateRunning && (!previousOwner.Valid || previousOwner.String != owner || !previousLease.Valid || previousLease.Time.Before(now))
	result, err := tx.ExecContext(ctx, `UPDATE trading_bots SET schedulerOwner = ?, leaseExpiresAt = ?, heartbeatAt = ?, version = version + 1
WHERE id = ? AND (leaseExpiresAt IS NULL OR leaseExpiresAt < ? OR schedulerOwner = ?)`, owner, leaseUntil, now, instance.ID, now, owner)
	if err != nil {
		return nil, fmt.Errorf("claim bot lease: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected != 1 {
		return nil, errors.New("bot lease was claimed concurrently")
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit bot lease: %w", err)
	}
	return &instance, nil
}

func (s *AccountStore) CheckGate(ctx context.Context, instance bot.Instance) (bot.Gate, error) {
	const query = `SELECT a.isActive, a.connectionStatus, COALESCE(p.enabled, FALSE),
COALESCE(p.accountKillSwitch, TRUE), COALESCE(c.globalKillSwitch, TRUE)
FROM exchange_accounts a
LEFT JOIN trading_risk_profiles p ON p.exchangeAccountId = a.id
LEFT JOIN trading_risk_controls c ON c.id = 'global'
WHERE a.id = ? AND a.userId = ? LIMIT 1`
	var active, riskEnabled, accountKillSwitch, globalKillSwitch bool
	var connectionStatus string
	err := s.database.QueryRowContext(ctx, query, instance.ExchangeAccountID, instance.UserID).Scan(
		&active, &connectionStatus, &riskEnabled, &accountKillSwitch, &globalKillSwitch,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return bot.Gate{Code: "BOT_ACCOUNT_NOT_FOUND", Message: "Borsa hesabı bulunamadı."}, nil
	}
	if err != nil {
		return bot.Gate{}, fmt.Errorf("read bot safety gate: %w", err)
	}
	switch {
	case !active:
		return bot.Gate{Code: "BOT_ACCOUNT_DISABLED", Message: "Borsa hesabı devre dışı."}, nil
	case connectionStatus != "CONNECTED":
		return bot.Gate{Code: "BOT_ACCOUNT_NOT_READY", Message: "Borsa bağlantısı hazır değil."}, nil
	case !riskEnabled:
		return bot.Gate{Code: "BOT_RISK_PROFILE_DISABLED", Message: "Risk profili etkin değil."}, nil
	case globalKillSwitch:
		return bot.Gate{Code: "GLOBAL_KILL_SWITCH_ACTIVE", Message: "Global acil durdurma aktif."}, nil
	case accountKillSwitch:
		return bot.Gate{Code: "ACCOUNT_KILL_SWITCH_ACTIVE", Message: "Hesap acil durdurması aktif."}, nil
	default:
		return bot.Gate{Ready: true, Message: "Scheduler güvenlik kapıları hazır."}, nil
	}
}

func (s *AccountStore) LoadBotMarketAccount(ctx context.Context, userID, accountID string) (bot.MarketAccount, error) {
	var account bot.MarketAccount
	var active bool
	var status string
	err := s.database.QueryRowContext(ctx, `SELECT provider, environment, isActive, connectionStatus
FROM exchange_accounts WHERE id = ? AND userId = ? LIMIT 1`, accountID, userID).Scan(
		&account.Provider, &account.Environment, &active, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return bot.MarketAccount{}, ErrAccountNotFound
	}
	if err != nil {
		return bot.MarketAccount{}, fmt.Errorf("load bot market account: %w", err)
	}
	if !active || status != "CONNECTED" {
		return bot.MarketAccount{}, errors.New("bot market account is not ready")
	}
	if account.Environment != domain.EnvironmentDemo && account.Environment != domain.EnvironmentTestnet {
		return bot.MarketAccount{}, errors.New("live bot market accounts are not allowed")
	}
	return account, nil
}

func (s *AccountStore) UpdateState(ctx context.Context, instance *bot.Instance, owner string, target bot.State, reason string, now time.Time) error {
	result, err := s.database.ExecContext(ctx, `UPDATE trading_bots SET state = ?, stateReason = ?, heartbeatAt = ?,
startedAt = CASE WHEN ? = 'RUNNING' AND startedAt IS NULL THEN ? ELSE startedAt END,
stoppedAt = CASE WHEN ? IN ('STOPPED', 'EMERGENCY_STOPPED') THEN ? ELSE stoppedAt END,
lastDecisionAt = CASE WHEN ? IN ('RISK_BLOCKED', 'ERROR') THEN ? ELSE lastDecisionAt END,
lastErrorCode = CASE WHEN ? = 'ERROR' THEN 'BOT_RUNNER_ERROR' WHEN ? = 'RISK_BLOCKED' THEN 'BOT_SAFETY_GATE_BLOCKED' ELSE NULL END,
lastErrorMessage = CASE WHEN ? IN ('ERROR', 'RISK_BLOCKED') THEN ? ELSE NULL END, version = version + 1
WHERE id = ? AND schedulerOwner = ? AND state = ?`,
		target, reason, now, target, now, target, now, target, now, target, target, target, reason, instance.ID, owner, instance.State)
	if err != nil {
		return fmt.Errorf("update bot state: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected != 1 {
		return errors.New("bot state changed outside scheduler lease")
	}
	payload, _ := json.Marshal(map[string]any{"botId": instance.ID, "state": target, "previousState": instance.State, "reason": reason})
	_, err = s.database.ExecContext(ctx, `INSERT INTO trading_outbox_events
(userId, exchangeAccountId, provider, topic, eventType, aggregateType, aggregateId, deduplicationKey, payload, occurredAt, createdAt)
SELECT b.userId, b.exchangeAccountId, a.provider, 'trading.bot', 'BOT_STATE_CHANGED', 'TRADING_BOT', b.id, ?, ?, ?, UTC_TIMESTAMP(3)
FROM trading_bots b JOIN exchange_accounts a ON a.id = b.exchangeAccountId WHERE b.id = ?`,
		fmt.Sprintf("go:bot:%s:state:%d", instance.ID, now.UnixNano()), payload, now, instance.ID)
	if err != nil {
		return fmt.Errorf("append bot state event: %w", err)
	}
	return nil
}

func (s *AccountStore) CompleteCycle(ctx context.Context, instance bot.Instance, owner string, decision bot.Decision, now, leaseUntil time.Time) error {
	tx, err := s.database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin bot cycle: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(ctx, `UPDATE trading_bots SET heartbeatAt = ?, lastDecisionAt = ?, leaseExpiresAt = ?, version = version + 1
WHERE id = ? AND schedulerOwner = ? AND state = 'RUNNING'`, now, now, leaseUntil, instance.ID, owner)
	if err != nil {
		return fmt.Errorf("heartbeat bot cycle: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected != 1 {
		return errors.New("bot cycle lost its scheduler lease")
	}
	hypotheticalOrder, err := nullableJSON(decision.HypotheticalOrder)
	if err != nil {
		return fmt.Errorf("marshal hypothetical bot order: %w", err)
	}
	metrics, err := nullableJSON(decision.Metrics)
	if err != nil {
		return fmt.Errorf("marshal bot decision metrics: %w", err)
	}
	decisionResult, err := tx.ExecContext(ctx, `INSERT INTO trading_bot_decisions
(tradingBotId, userId, exchangeAccountId, type, mode, symbol, kind, summary, markPrice, referencePrice, hypotheticalOrder, metrics, occurredAt, createdAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?, UTC_TIMESTAMP(3))`,
		instance.ID, instance.UserID, instance.ExchangeAccountID, instance.Type, instance.Mode, instance.Symbol,
		decision.Kind, decision.Summary, decision.MarkPrice, decision.ReferencePrice, hypotheticalOrder, metrics, now)
	if err != nil {
		return fmt.Errorf("insert bot decision: %w", err)
	}
	decisionID, err := decisionResult.LastInsertId()
	if err != nil {
		return fmt.Errorf("read bot decision id: %w", err)
	}
	riskApproved := true
	var autonomousRiskDecision *autonomousrisk.Decision
	if instance.Type == "AUTONOMOUS" && decision.HypotheticalOrder != nil {
		result, riskErr := evaluateAutonomousPaperRisk(ctx, tx, instance, decision, now)
		if riskErr != nil {
			return fmt.Errorf("evaluate autonomous paper risk: %w", riskErr)
		}
		riskApproved = result.Approved
		autonomousRiskDecision = &result
	}
	safetyChecks, err := json.Marshal(map[string]any{
		"mode": instance.Mode, "riskGatePassed": true, "autonomousRiskApproved": riskApproved,
		"autonomousRiskDecision": autonomousRiskDecision, "submittedToExchange": false, "orderExecutionAllowed": false,
	})
	if err != nil {
		return fmt.Errorf("marshal bot signal safety checks: %w", err)
	}
	signalStatus := "ACCEPTED"
	if !riskApproved {
		signalStatus = "REJECTED"
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO trading_bot_signals
(tradingBotId, userId, exchangeAccountId, decisionId, source, action, status, confidence, rationale, features, safetyChecks, decidedAt, createdAt)
VALUES (?, ?, ?, ?, 'RULE_ENGINE', ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
		instance.ID, instance.UserID, instance.ExchangeAccountID, decisionID, signalAction(decision.Kind), signalStatus, signalConfidence(decision.Kind),
		decision.Summary, metrics, safetyChecks, now)
	if err != nil {
		return fmt.Errorf("insert bot signal: %w", err)
	}
	if decision.AIObservation != nil {
		comparisonFeatures, marshalErr := json.Marshal(map[string]any{
			"ruleDecisionKind": decision.Kind, "ruleAction": signalAction(decision.Kind),
			"agreement": signalAction(decision.Kind) == decision.AIObservation.Action,
		})
		if marshalErr != nil {
			return fmt.Errorf("marshal AI comparison features: %w", marshalErr)
		}
		observerSafetyChecks, marshalErr := json.Marshal(map[string]any{
			"mode": instance.Mode, "comparisonOnly": true, "riskGatePassed": true,
			"submittedToExchange": false, "orderExecutionAllowed": false, "paperFillAllowed": false,
		})
		if marshalErr != nil {
			return fmt.Errorf("marshal AI observer safety checks: %w", marshalErr)
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO trading_bot_signals
(tradingBotId, userId, exchangeAccountId, decisionId, source, action, status, confidence, rationale,
 modelProvider, modelName, promptVersion, features, safetyChecks, expiresAt, decidedAt, createdAt)
VALUES (?, ?, ?, ?, 'AI_MODEL', ?, 'OBSERVED', ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
			instance.ID, instance.UserID, instance.ExchangeAccountID, decisionID, decision.AIObservation.Action,
			strconv.FormatFloat(decision.AIObservation.Confidence, 'f', 4, 64), decision.AIObservation.Rationale,
			decision.AIObservation.Provider, decision.AIObservation.Model, decision.AIObservation.PromptVersion,
			comparisonFeatures, observerSafetyChecks, decision.AIObservation.ExpiresAt, now)
		if err != nil {
			return fmt.Errorf("insert AI observed signal: %w", err)
		}
	}
	var paperExecution *bot.PaperExecution
	if instance.Mode == "PAPER" && riskApproved {
		paperExecution, err = persistPaperCycle(ctx, tx, instance, decision, decisionID, now)
		if err != nil {
			return err
		}
	}
	var shadowExecution map[string]any
	if instance.Mode == "SHADOW" && riskApproved {
		shadowExecution, err = persistShadowCycle(ctx, tx, instance, decision, decisionID, now)
		if err != nil {
			return err
		}
	}
	payload, err := json.Marshal(map[string]any{
		"botId": instance.ID, "mode": instance.Mode, "state": instance.State,
		"decision": decision.Kind, "summary": decision.Summary, "markPrice": decision.MarkPrice,
		"referencePrice": decision.ReferencePrice, "metrics": decision.Metrics, "hypotheticalOrder": decision.HypotheticalOrder,
		"paperExecution": paperExecution, "shadowExecution": shadowExecution, "autonomousRiskDecision": autonomousRiskDecision,
		"signalSource": "RULE_ENGINE", "signalAction": signalAction(decision.Kind),
	})
	if err != nil {
		return fmt.Errorf("marshal bot decision: %w", err)
	}
	eventType := "BOT_SHADOW_DECISION"
	if instance.Mode == "PAPER" {
		eventType = "BOT_PAPER_DECISION"
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO trading_outbox_events
(userId, exchangeAccountId, provider, topic, eventType, aggregateType, aggregateId, deduplicationKey, payload, occurredAt, createdAt)
SELECT b.userId, b.exchangeAccountId, a.provider, 'trading.bot', ?, 'TRADING_BOT', b.id, ?, ?, ?, UTC_TIMESTAMP(3)
FROM trading_bots b JOIN exchange_accounts a ON a.id = b.exchangeAccountId WHERE b.id = ?`,
		eventType, fmt.Sprintf("go:bot:%s:decision:%d", instance.ID, now.UnixNano()), payload, now, instance.ID)
	if err != nil {
		return fmt.Errorf("append bot decision event: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit bot cycle: %w", err)
	}
	return nil
}

func persistShadowCycle(ctx context.Context, tx *sql.Tx, instance bot.Instance, decision bot.Decision, decisionID int64, now time.Time) (map[string]any, error) {
	if decision.HypotheticalOrder == nil {
		return nil, nil
	}
	position, shadowUnrealized, err := loadLatestShadowPosition(ctx, tx, instance.ID)
	if err != nil {
		return nil, err
	}
	if stopPrice, ok := decision.HypotheticalOrder["moveStopTo"].(string); ok && stopPrice != "" {
		_, err := tx.ExecContext(ctx, `INSERT INTO shadow_trades
(tradingBotId, decisionId, action, markPrice, stopPrice, netQuantity, avgEntryPrice, cumulativePnl, totalFees, unrealizedPnl, occurredAt, createdAt)
VALUES (?, ?, 'WOULD_MOVE_STOP', ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`, instance.ID, decisionID, decision.MarkPrice,
			stopPrice, position.NetQuantity, position.AvgEntryPrice, position.RealizedPnL, position.TotalFees, shadowUnrealized, now)
		if err != nil {
			return nil, fmt.Errorf("insert shadow stop decision: %w", err)
		}
		return map[string]any{"action": "WOULD_MOVE_STOP", "stopPrice": stopPrice, "submittedToExchange": false}, nil
	}
	side, sideOK := decision.HypotheticalOrder["side"].(string)
	quantity, quantityOK := decision.HypotheticalOrder["quantity"].(string)
	feeBps, feeOK := paperNumber(decision.HypotheticalOrder["feeBps"])
	slippageBps, slippageOK := paperNumber(decision.HypotheticalOrder["slippageBps"])
	if !sideOK || !quantityOK || !feeOK || !slippageOK {
		return nil, errors.New("shadow hypothetical order is incomplete")
	}
	action := "WOULD_OPEN"
	if (side == "SELL" && decimalSign(position.NetQuantity) > 0) || (side == "BUY" && decimalSign(position.NetQuantity) < 0) {
		action = "WOULD_CLOSE"
	}
	execution, err := bot.ApplyPaperExecution(position, side, quantity, decision.MarkPrice, feeBps, slippageBps)
	if err != nil {
		return nil, fmt.Errorf("apply shadow simulation: %w", err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO shadow_trades
(tradingBotId, decisionId, action, side, quantity, markPrice, simulatedFillPrice, notional, fee, realizedPnl,
 netQuantity, avgEntryPrice, cumulativePnl, totalFees, unrealizedPnl, slippageBps, feeBps, occurredAt, createdAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
		instance.ID, decisionID, action, execution.Side, execution.Quantity, execution.MarkPrice, execution.FillPrice,
		execution.Notional, execution.Fee, execution.RealizedPnL, execution.NetQuantity, execution.AvgEntryPrice,
		execution.CumulativePnL, execution.TotalFees, execution.UnrealizedPnL, execution.SlippageBps, execution.FeeBps, now)
	if err != nil {
		return nil, fmt.Errorf("insert shadow trade: %w", err)
	}
	return map[string]any{
		"action": action, "side": execution.Side, "quantity": execution.Quantity, "markPrice": execution.MarkPrice,
		"simulatedFillPrice": execution.FillPrice, "realizedPnl": execution.RealizedPnL,
		"netQuantity": execution.NetQuantity, "submittedToExchange": false,
	}, nil
}

func loadLatestShadowPosition(ctx context.Context, tx *sql.Tx, botID string) (bot.PaperPosition, string, error) {
	var position bot.PaperPosition
	var unrealized string
	err := tx.QueryRowContext(ctx, `SELECT netQuantity, avgEntryPrice, cumulativePnl, totalFees, unrealizedPnl
FROM shadow_trades WHERE tradingBotId = ? ORDER BY id DESC LIMIT 1`, botID).Scan(
		&position.NetQuantity, &position.AvgEntryPrice, &position.RealizedPnL, &position.TotalFees, &unrealized)
	if errors.Is(err, sql.ErrNoRows) {
		return bot.PaperPosition{}, "0", nil
	}
	if err != nil {
		return bot.PaperPosition{}, "", fmt.Errorf("load shadow position: %w", err)
	}
	return position, unrealized, nil
}

func decimalSign(value string) int {
	parsed, ok := new(big.Rat).SetString(value)
	if !ok {
		return 0
	}
	return parsed.Sign()
}

func signalAction(kind string) string {
	switch kind {
	case "BUY", "GRID_BUY":
		return "BUY"
	case "SELL", "GRID_SELL":
		return "SELL"
	default:
		return "HOLD"
	}
}

func signalConfidence(kind string) string {
	switch kind {
	case "BUY", "SELL", "GRID_BUY", "GRID_SELL", "OUT_OF_RANGE":
		return "1.0000"
	case "WARMING_UP":
		return "0.2500"
	default:
		return "0.5000"
	}
}

func persistPaperCycle(ctx context.Context, tx *sql.Tx, instance bot.Instance, decision bot.Decision, decisionID int64, now time.Time) (*bot.PaperExecution, error) {
	position, exists, err := loadPaperPosition(ctx, tx, instance.ID)
	if err != nil {
		return nil, err
	}
	if decision.HypotheticalOrder == nil {
		if !exists {
			return nil, nil
		}
		unrealized, err := bot.MarkPaperPosition(position, decision.MarkPrice)
		if err != nil {
			return nil, fmt.Errorf("mark paper position: %w", err)
		}
		_, err = tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET unrealizedPnl = ?, lastMarkPrice = ?, updatedAt = ? WHERE tradingBotId = ?`,
			unrealized, decision.MarkPrice, now, instance.ID)
		if err != nil {
			return nil, fmt.Errorf("update paper position mark: %w", err)
		}
		return nil, nil
	}
	side, sideOK := decision.HypotheticalOrder["side"].(string)
	quantity, quantityOK := decision.HypotheticalOrder["quantity"].(string)
	feeBps, feeOK := paperNumber(decision.HypotheticalOrder["feeBps"])
	slippageBps, slippageOK := paperNumber(decision.HypotheticalOrder["slippageBps"])
	if !sideOK || !quantityOK || !feeOK || !slippageOK {
		return nil, errors.New("paper hypothetical order is incomplete")
	}
	execution, err := bot.ApplyPaperExecution(position, side, quantity, decision.MarkPrice, feeBps, slippageBps)
	if err != nil {
		return nil, fmt.Errorf("apply paper execution: %w", err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO trading_bot_paper_fills
(tradingBotId, decisionId, side, quantity, markPrice, fillPrice, notional, fee, realizedPnl, slippageBps, feeBps, occurredAt, createdAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`, instance.ID, decisionID, execution.Side,
		execution.Quantity, execution.MarkPrice, execution.FillPrice, execution.Notional, execution.Fee, execution.RealizedPnL,
		execution.SlippageBps, execution.FeeBps, now)
	if err != nil {
		return nil, fmt.Errorf("insert paper fill: %w", err)
	}
	openedAt := any(nil)
	if execution.NetQuantity != "0.000000000000000000" {
		openedAt = now
	}
	if !exists {
		_, err = tx.ExecContext(ctx, `INSERT INTO trading_bot_paper_positions
(tradingBotId, symbol, netQuantity, avgEntryPrice, realizedPnl, unrealizedPnl, totalFees, lastMarkPrice, totalFills, openedAt, lastFilledAt, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, UTC_TIMESTAMP(3), ?)`, instance.ID, instance.Symbol, execution.NetQuantity,
			execution.AvgEntryPrice, execution.CumulativePnL, execution.UnrealizedPnL, execution.TotalFees, decision.MarkPrice, openedAt, now, now)
	} else {
		if position.NetQuantity != "0.000000000000000000" && position.NetQuantity != "0" && execution.NetQuantity != "0.000000000000000000" {
			openedAt = nil
		}
		_, err = tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET netQuantity = ?, avgEntryPrice = ?, realizedPnl = ?,
unrealizedPnl = ?, totalFees = ?, lastMarkPrice = ?, totalFills = totalFills + 1,
openedAt = CASE WHEN ? = '0.000000000000000000' THEN NULL ELSE COALESCE(?, openedAt) END, lastFilledAt = ?, updatedAt = ?
WHERE tradingBotId = ?`, execution.NetQuantity, execution.AvgEntryPrice, execution.CumulativePnL, execution.UnrealizedPnL,
			execution.TotalFees, decision.MarkPrice, execution.NetQuantity, openedAt, now, now, instance.ID)
	}
	if err != nil {
		return nil, fmt.Errorf("persist paper position: %w", err)
	}
	return &execution, nil
}

func loadPaperPosition(ctx context.Context, tx *sql.Tx, botID string) (bot.PaperPosition, bool, error) {
	var position bot.PaperPosition
	err := tx.QueryRowContext(ctx, `SELECT netQuantity, avgEntryPrice, realizedPnl, totalFees
FROM trading_bot_paper_positions WHERE tradingBotId = ? FOR UPDATE`, botID).Scan(
		&position.NetQuantity, &position.AvgEntryPrice, &position.RealizedPnL, &position.TotalFees)
	if errors.Is(err, sql.ErrNoRows) {
		return bot.PaperPosition{}, false, nil
	}
	if err != nil {
		return bot.PaperPosition{}, false, fmt.Errorf("load paper position: %w", err)
	}
	return position, true, nil
}

func paperNumber(value any) (float64, bool) {
	switch number := value.(type) {
	case float64:
		return number, true
	case int:
		return float64(number), true
	default:
		return 0, false
	}
}

func (s *AccountStore) Release(ctx context.Context, botID, owner string) error {
	_, err := s.database.ExecContext(ctx, `UPDATE trading_bots SET schedulerOwner = NULL, leaseExpiresAt = NULL
WHERE id = ? AND schedulerOwner = ?`, botID, owner)
	if err != nil {
		return fmt.Errorf("release bot lease: %w", err)
	}
	return nil
}

func (s *AccountStore) LoadLatestBotDecisionPrice(ctx context.Context, botID string) (string, error) {
	var markPrice string
	err := s.database.QueryRowContext(ctx, `SELECT markPrice FROM trading_bot_decisions WHERE tradingBotId = ? ORDER BY id DESC LIMIT 1`, botID).Scan(&markPrice)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("load latest bot decision price: %w", err)
	}
	return markPrice, nil
}

func nullableJSON(value any) (any, error) {
	if value == nil {
		return nil, nil
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

var _ bot.Store = (*AccountStore)(nil)
