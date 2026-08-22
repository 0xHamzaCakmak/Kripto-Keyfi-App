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

func (s *AccountStore) AcquireNext(ctx context.Context, owner string, now, leaseUntil time.Time, allowDemo bool) (*bot.Instance, error) {
	tx, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return nil, fmt.Errorf("begin bot lease: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	const query = `SELECT b.id, b.userId, b.exchangeAccountId, b.name, b.type, b.mode, b.symbol,
b.state, b.desiredState, b.intervalSeconds, b.configuration, b.schedulerOwner, b.leaseExpiresAt,
COALESCE(b.strategyVersionId, ''), COALESCE(s.family, '')
FROM trading_bots b
LEFT JOIN trading_strategy_versions sv ON sv.id = b.strategyVersionId
LEFT JOIN trading_strategies s ON s.id = sv.strategyId
WHERE b.desiredState = 'RUNNING'
  AND (b.mode <> 'DEMO' OR ?)
  AND state IN ('STARTING', 'RUNNING', 'RISK_BLOCKED', 'RECONCILING', 'ERROR')
  AND (leaseExpiresAt IS NULL OR leaseExpiresAt < ? OR schedulerOwner = ?)
  AND (lastDecisionAt IS NULL OR lastDecisionAt <= DATE_SUB(?, INTERVAL intervalSeconds SECOND))
ORDER BY CASE WHEN b.mode = 'DEMO' THEN 0 ELSE 1 END, COALESCE(lastDecisionAt, b.createdAt), b.id
LIMIT 1 FOR UPDATE SKIP LOCKED`
	var instance bot.Instance
	var configuration []byte
	var previousOwner sql.NullString
	var previousLease sql.NullTime
	err = tx.QueryRowContext(ctx, query, allowDemo, now, owner, now).Scan(
		&instance.ID, &instance.UserID, &instance.ExchangeAccountID, &instance.Name, &instance.Type,
		&instance.Mode, &instance.Symbol, &instance.State, &instance.DesiredState, &instance.IntervalSeconds, &configuration,
		&previousOwner, &previousLease, &instance.StrategyVersionID, &instance.StrategyFamily,
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
		botStateDeduplicationKey(instance.ID, target, now), payload, now, instance.ID)
	if err != nil {
		return fmt.Errorf("append bot state event: %w", err)
	}
	return nil
}

func botStateDeduplicationKey(botID string, state bot.State, occurredAt time.Time) string {
	return fmt.Sprintf("go:bot:%s:state:%s:%d", botID, state, occurredAt.UnixNano())
}

func (s *AccountStore) CompleteCycle(ctx context.Context, instance bot.Instance, owner string, decision bot.Decision, now, leaseUntil time.Time) (bot.CycleResult, error) {
	var result bot.CycleResult
	var err error
	for attempt := 1; attempt <= mysqlTransactionAttempts; attempt++ {
		result, err = s.completeCycleOnce(ctx, instance, owner, decision, now, leaseUntil)
		if err == nil || !isRetryableMySQLTransactionError(err) || attempt == mysqlTransactionAttempts {
			return result, err
		}
		if err := waitMySQLTransactionRetry(ctx, attempt); err != nil {
			return bot.CycleResult{}, err
		}
	}
	return result, err
}

func (s *AccountStore) completeCycleOnce(ctx context.Context, instance bot.Instance, owner string, decision bot.Decision, now, leaseUntil time.Time) (bot.CycleResult, error) {
	tx, err := s.database.BeginTx(ctx, nil)
	if err != nil {
		return bot.CycleResult{}, fmt.Errorf("begin bot cycle: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(ctx, `UPDATE trading_bots SET heartbeatAt = ?, lastDecisionAt = ?, leaseExpiresAt = ?, version = version + 1
WHERE id = ? AND schedulerOwner = ? AND state = 'RUNNING'`, now, now, leaseUntil, instance.ID, owner)
	if err != nil {
		return bot.CycleResult{}, fmt.Errorf("heartbeat bot cycle: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected != 1 {
		return bot.CycleResult{}, errors.New("bot cycle lost its scheduler lease")
	}
	hypotheticalOrder, err := nullableJSON(decision.HypotheticalOrder)
	if err != nil {
		return bot.CycleResult{}, fmt.Errorf("marshal hypothetical bot order: %w", err)
	}
	metrics, err := nullableJSON(decision.Metrics)
	if err != nil {
		return bot.CycleResult{}, fmt.Errorf("marshal bot decision metrics: %w", err)
	}
	decisionResult, err := tx.ExecContext(ctx, `INSERT INTO trading_bot_decisions
(tradingBotId, userId, exchangeAccountId, type, mode, symbol, kind, summary, markPrice, referencePrice, hypotheticalOrder, metrics, occurredAt, createdAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?, UTC_TIMESTAMP(3))`,
		instance.ID, instance.UserID, instance.ExchangeAccountID, instance.Type, instance.Mode, instance.Symbol,
		decision.Kind, decision.Summary, decision.MarkPrice, decision.ReferencePrice, hypotheticalOrder, metrics, now)
	if err != nil {
		return bot.CycleResult{}, fmt.Errorf("insert bot decision: %w", err)
	}
	decisionID, err := decisionResult.LastInsertId()
	if err != nil {
		return bot.CycleResult{}, fmt.Errorf("read bot decision id: %w", err)
	}
	riskApproved := true
	var autonomousRiskDecision *autonomousrisk.Decision
	if instance.Type == "AUTONOMOUS" && decision.HypotheticalOrder != nil {
		result, riskErr := evaluateAutonomousPaperRisk(ctx, tx, instance, decision, now)
		if riskErr != nil {
			return bot.CycleResult{}, fmt.Errorf("evaluate autonomous risk: %w", riskErr)
		}
		riskApproved = result.Approved
		autonomousRiskDecision = &result
	}
	safetyChecks, err := json.Marshal(map[string]any{
		"mode": instance.Mode, "riskGatePassed": true, "autonomousRiskApproved": riskApproved,
		"autonomousRiskDecision": autonomousRiskDecision, "submittedToExchange": false, "orderExecutionAllowed": false,
	})
	if err != nil {
		return bot.CycleResult{}, fmt.Errorf("marshal bot signal safety checks: %w", err)
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
		return bot.CycleResult{}, fmt.Errorf("insert bot signal: %w", err)
	}
	if decision.AIObservation != nil {
		comparisonFeatures, marshalErr := json.Marshal(map[string]any{
			"ruleDecisionKind": decision.Kind, "ruleAction": signalAction(decision.Kind),
			"agreement": signalAction(decision.Kind) == decision.AIObservation.Action,
		})
		if marshalErr != nil {
			return bot.CycleResult{}, fmt.Errorf("marshal AI comparison features: %w", marshalErr)
		}
		observerSafetyChecks, marshalErr := json.Marshal(map[string]any{
			"mode": instance.Mode, "comparisonOnly": true, "riskGatePassed": true,
			"submittedToExchange": false, "orderExecutionAllowed": false, "paperFillAllowed": false,
		})
		if marshalErr != nil {
			return bot.CycleResult{}, fmt.Errorf("marshal AI observer safety checks: %w", marshalErr)
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
			return bot.CycleResult{}, fmt.Errorf("insert AI observed signal: %w", err)
		}
	}
	var paperExecution *bot.PaperExecution
	if instance.Mode == "PAPER" {
		// Protective exits must always be processed. A rejected entry can never
		// prevent an already-open PAPER position from reaching its stop or target.
		paperExecution, err = persistPaperCycle(ctx, tx, instance, decision, decisionID, now, riskApproved)
		if err != nil {
			return bot.CycleResult{}, err
		}
	}
	var shadowExecution map[string]any
	if instance.Mode == "SHADOW" && riskApproved {
		shadowExecution, err = persistShadowCycle(ctx, tx, instance, decision, decisionID, now)
		if err != nil {
			return bot.CycleResult{}, err
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
		return bot.CycleResult{}, fmt.Errorf("marshal bot decision: %w", err)
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
		return bot.CycleResult{}, fmt.Errorf("append bot decision event: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return bot.CycleResult{}, fmt.Errorf("commit bot cycle: %w", err)
	}
	return bot.CycleResult{DecisionID: decisionID, RiskApproved: riskApproved}, nil
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

type openPaperTrade struct {
	ID, Side, EntryPrice, Quantity, Fees, SlippageCost, StopLoss, TakeProfit, RealizedPnL string
	OpenedAt                                                                              time.Time
	MaxFavorableExcursion, MaxAdverseExcursion                                            string
	PartialTakeProfitTaken                                                                bool
}

func persistPaperCycle(ctx context.Context, tx *sql.Tx, instance bot.Instance, decision bot.Decision, decisionID int64, now time.Time, entryRiskApproved bool) (*bot.PaperExecution, error) {
	position, exists, err := loadPaperPosition(ctx, tx, instance.ID)
	if err != nil {
		return nil, err
	}
	openTrade, err := loadOpenPaperTrade(ctx, tx, instance.ID)
	if err != nil {
		return nil, err
	}
	if openTrade == nil && decimalSign(position.NetQuantity) != 0 {
		openTrade, err = recoverLegacyPaperTrade(ctx, tx, instance, position, decisionID, now)
		if err != nil {
			return nil, err
		}
	}
	if openTrade != nil {
		unrealized, markErr := bot.MarkPaperPosition(position, decision.MarkPrice)
		if markErr != nil {
			return nil, fmt.Errorf("mark paper position: %w", markErr)
		}
		favorable, adverse, excursionErr := paperExcursions(openTrade, decision.MarkPrice)
		if excursionErr != nil {
			return nil, excursionErr
		}
		partialFraction := 0.5
		if configured, ok := paperNumber(instance.Configuration["partialTakeProfitPct"]); ok {
			partialFraction = configured
		}
		trailingStopBps, ok := paperNumber(instance.Configuration["trailingStopBps"])
		if !ok {
			trailingStopBps, _ = paperNumber(instance.Configuration["stopLossBps"])
		}
		marketRegime, _ := decision.Metrics["marketRegime"].(string)
		plan, planErr := bot.PlanManagedExit(bot.ManagedExitInput{Side: openTrade.Side, EntryPrice: openTrade.EntryPrice, Quantity: openTrade.Quantity,
			StopLoss: openTrade.StopLoss, FirstTarget: openTrade.TakeProfit, MarkPrice: decision.MarkPrice, MarketRegime: marketRegime,
			PartialTaken: openTrade.PartialTakeProfitTaken, PartialFraction: partialFraction, TrailingStopBps: trailingStopBps})
		if planErr != nil {
			return nil, fmt.Errorf("plan managed paper exit: %w", planErr)
		}
		if plan.Action == "MOVE_STOP" {
			if _, err = tx.ExecContext(ctx, `UPDATE paper_trades SET stopLoss = ?, maxFavorableExcursion = ?, maxAdverseExcursion = ?, marketContext = JSON_SET(COALESCE(marketContext, JSON_OBJECT()), '$.trailingStopActive', true), updatedAt = UTC_TIMESTAMP(3) WHERE id = ?`, plan.NewStop, favorable, adverse, openTrade.ID); err != nil {
				return nil, fmt.Errorf("advance paper trailing stop: %w", err)
			}
			if _, err = tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET unrealizedPnl = ?, lastMarkPrice = ?, updatedAt = ? WHERE tradingBotId = ?`, unrealized, decision.MarkPrice, now, instance.ID); err != nil {
				return nil, fmt.Errorf("update trailed paper position: %w", err)
			}
			return nil, nil
		}
		if plan.Action == "PARTIAL_TAKE_PROFIT" {
			closeSide := "SELL"
			if openTrade.Side == "SELL" {
				closeSide = "BUY"
			}
			feeBps, slippageBps := paperCosts(instance.Configuration)
			execution, applyErr := bot.ApplyPaperExecution(position, closeSide, plan.Quantity, decision.MarkPrice, feeBps, slippageBps)
			if applyErr != nil {
				return nil, fmt.Errorf("apply partial paper take-profit: %w", applyErr)
			}
			if err = insertPaperFill(ctx, tx, instance.ID, decisionID, execution, now); err != nil {
				return nil, err
			}
			remaining, calcErr := subtractDecimals(openTrade.Quantity, plan.Quantity)
			if calcErr != nil {
				return nil, calcErr
			}
			grossRealized, calcErr := addDecimals(openTrade.RealizedPnL, execution.RealizedPnL)
			if calcErr != nil {
				return nil, calcErr
			}
			totalFees, calcErr := addDecimals(openTrade.Fees, execution.Fee)
			if calcErr != nil {
				return nil, calcErr
			}
			exitSlippage, calcErr := paperSlippageCost(execution.FillPrice, decision.MarkPrice, execution.Quantity)
			if calcErr != nil {
				return nil, calcErr
			}
			totalSlippage, calcErr := addDecimals(openTrade.SlippageCost, exitSlippage)
			if calcErr != nil {
				return nil, calcErr
			}
			if _, err = tx.ExecContext(ctx, `UPDATE paper_trades SET quantity = ?, realizedPnl = ?, fees = ?, slippageCost = ?, stopLoss = ?, takeProfit = NULL, maxFavorableExcursion = ?, maxAdverseExcursion = ?, marketContext = JSON_SET(COALESCE(marketContext, JSON_OBJECT()), '$.partialTakeProfitTaken', true, '$.firstTargetAt', ?), updatedAt = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'OPEN'`,
				remaining, grossRealized, totalFees, totalSlippage, plan.NewStop, favorable, adverse, now, openTrade.ID); err != nil {
				return nil, fmt.Errorf("persist partial paper take-profit: %w", err)
			}
			if err = savePaperPosition(ctx, tx, instance, position, execution, decision.MarkPrice, now, exists); err != nil {
				return nil, err
			}
			return &execution, nil
		}
		reason := ""
		if plan.Action == "CLOSE" {
			reason = plan.Reason
		}
		if reason == "" {
			if _, err = tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET unrealizedPnl = ?, lastMarkPrice = ?, updatedAt = ? WHERE tradingBotId = ?`,
				unrealized, decision.MarkPrice, now, instance.ID); err != nil {
				return nil, fmt.Errorf("update paper position mark: %w", err)
			}
			if _, err = tx.ExecContext(ctx, `UPDATE paper_trades SET maxFavorableExcursion = ?, maxAdverseExcursion = ?, updatedAt = UTC_TIMESTAMP(3) WHERE id = ?`, favorable, adverse, openTrade.ID); err != nil {
				return nil, fmt.Errorf("update paper trade excursions: %w", err)
			}
			if decision.HypotheticalOrder == nil || !entryRiskApproved || instance.Configuration["pyramidingEnabled"] != true {
				return nil, nil
			}
			side, sideOK := decision.HypotheticalOrder["side"].(string)
			quantity, quantityOK := decision.HypotheticalOrder["quantity"].(string)
			feeBps, feeOK := paperNumber(decision.HypotheticalOrder["feeBps"])
			slippageBps, slippageOK := paperNumber(decision.HypotheticalOrder["slippageBps"])
			if !sideOK || !quantityOK || !feeOK || !slippageOK {
				return nil, errors.New("paper pyramid order is incomplete")
			}
			if side != openTrade.Side {
				return nil, nil
			}
			quantity, hasAllocation, capErr := capPaperPyramidQuantity(quantity, position.NetQuantity, decision.MarkPrice, instance.Configuration)
			if capErr != nil {
				return nil, capErr
			}
			if !hasAllocation {
				return nil, nil
			}
			execution, applyErr := bot.ApplyPaperExecution(position, side, quantity, decision.MarkPrice, feeBps, slippageBps)
			if applyErr != nil {
				return nil, fmt.Errorf("apply paper pyramid execution: %w", applyErr)
			}
			if err = insertPaperFill(ctx, tx, instance.ID, decisionID, execution, now); err != nil {
				return nil, err
			}
			totalFees, calcErr := addDecimals(openTrade.Fees, execution.Fee)
			if calcErr != nil {
				return nil, calcErr
			}
			entrySlippage, calcErr := paperSlippageCost(execution.FillPrice, decision.MarkPrice, execution.Quantity)
			if calcErr != nil {
				return nil, calcErr
			}
			totalSlippage, calcErr := addDecimals(openTrade.SlippageCost, entrySlippage)
			if calcErr != nil {
				return nil, calcErr
			}
			stop, take, protectionErr := plannedProtectionPrices(instance.Configuration, decision.HypotheticalOrder, side, execution.AvgEntryPrice)
			if protectionErr != nil {
				return nil, protectionErr
			}
			quantityValue, quantityOK := new(big.Rat).SetString(execution.NetQuantity)
			if !quantityOK {
				return nil, errors.New("paper pyramid quantity is invalid")
			}
			quantityValue.Abs(quantityValue)
			if _, err = tx.ExecContext(ctx, `UPDATE paper_trades SET entryPrice = ?, quantity = ?, fees = ?, slippageCost = ?, stopLoss = ?, takeProfit = ?, maxFavorableExcursion = ?, maxAdverseExcursion = ?, decisionSummary = ?, updatedAt = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'OPEN'`,
				execution.AvgEntryPrice, quantityValue.FloatString(18), totalFees, totalSlippage, stop, take, favorable, adverse, decision.Summary, openTrade.ID); err != nil {
				return nil, fmt.Errorf("update pyramided paper trade: %w", err)
			}
			if err = savePaperPosition(ctx, tx, instance, position, execution, decision.MarkPrice, now, exists); err != nil {
				return nil, err
			}
			return &execution, nil
		}
		closeSide := "SELL"
		if openTrade.Side == "SELL" {
			closeSide = "BUY"
		}
		feeBps, slippageBps := paperCosts(instance.Configuration)
		execution, applyErr := bot.ApplyPaperExecution(position, closeSide, openTrade.Quantity, decision.MarkPrice, feeBps, slippageBps)
		if applyErr != nil {
			return nil, fmt.Errorf("apply protective paper exit: %w", applyErr)
		}
		if err = insertPaperFill(ctx, tx, instance.ID, decisionID, execution, now); err != nil {
			return nil, err
		}
		grossRealized, calcErr := addDecimals(openTrade.RealizedPnL, execution.RealizedPnL)
		if calcErr != nil {
			return nil, calcErr
		}
		netRealized, calcErr := subtractDecimals(grossRealized, openTrade.Fees, execution.Fee)
		if calcErr != nil {
			return nil, calcErr
		}
		totalTradeFees, calcErr := addDecimals(openTrade.Fees, execution.Fee)
		if calcErr != nil {
			return nil, calcErr
		}
		exitSlippage, calcErr := paperSlippageCost(execution.FillPrice, decision.MarkPrice, execution.Quantity)
		if calcErr != nil {
			return nil, calcErr
		}
		totalSlippage, calcErr := addDecimals(openTrade.SlippageCost, exitSlippage)
		if calcErr != nil {
			return nil, calcErr
		}
		holdingSeconds := int64(now.Sub(openTrade.OpenedAt).Seconds())
		if _, err = tx.ExecContext(ctx, `UPDATE paper_trades SET status = 'CLOSED', exitPrice = ?, fees = ?, slippageCost = ?, realizedPnl = ?, maxFavorableExcursion = ?, maxAdverseExcursion = ?, holdingSeconds = ?, closeReason = ?, closedAt = ?, updatedAt = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'OPEN'`,
			execution.FillPrice, totalTradeFees, totalSlippage, netRealized, favorable, adverse, holdingSeconds, reason, now, openTrade.ID); err != nil {
			return nil, fmt.Errorf("close protected paper trade: %w", err)
		}
		if err = savePaperPosition(ctx, tx, instance, position, execution, decision.MarkPrice, now, exists); err != nil {
			return nil, err
		}
		return &execution, nil
	}
	if decision.HypotheticalOrder == nil || !entryRiskApproved {
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
	if err = insertPaperFill(ctx, tx, instance.ID, decisionID, execution, now); err != nil {
		return nil, err
	}
	stopLoss, _ := decision.HypotheticalOrder["stopLoss"].(string)
	takeProfit, _ := decision.HypotheticalOrder["takeProfit"].(string)
	leverage, _ := paperNumber(decision.HypotheticalOrder["leverage"])
	entrySlippage, calcErr := paperSlippageCost(execution.FillPrice, decision.MarkPrice, execution.Quantity)
	if calcErr != nil {
		return nil, calcErr
	}
	tradeID := fmt.Sprintf("paper_%s_%d", instance.ID, decisionID)
	playbookVersion, _ := decision.HypotheticalOrder["playbookVersion"].(string)
	experimentID, _ := decision.HypotheticalOrder["experimentId"].(string)
	experimentVariant, _ := decision.HypotheticalOrder["experimentVariant"].(string)
	riskPlanVersion, _ := decision.HypotheticalOrder["riskPlanVersion"].(string)
	if _, err = tx.ExecContext(ctx, `INSERT INTO paper_trades
(id, tradingBotId, strategyVersionId, symbol, side, status, entryPrice, quantity, leverage, fees, funding, slippageCost, realizedPnl, stopLoss, takeProfit, maxFavorableExcursion, maxAdverseExcursion, decisionSummary, marketContext, openedAt, createdAt, updatedAt)
VALUES (?, ?, NULLIF(?, ''), ?, ?, 'OPEN', ?, ?, ?, ?, 0, ?, 0, NULLIF(?, ''), NULLIF(?, ''), 0, 0, ?, JSON_OBJECT('partialTakeProfitTaken', false, 'playbookVersion', ?, 'experimentId', ?, 'experimentVariant', ?, 'riskPlanVersion', ?), ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		tradeID, instance.ID, instance.StrategyVersionID, instance.Symbol, execution.Side, execution.FillPrice, execution.Quantity,
		int(leverage), execution.Fee, entrySlippage, stopLoss, takeProfit, decision.Summary, playbookVersion, experimentID, experimentVariant, riskPlanVersion, now); err != nil {
		return nil, fmt.Errorf("open autonomous paper trade: %w", err)
	}
	if err = savePaperPosition(ctx, tx, instance, position, execution, decision.MarkPrice, now, exists); err != nil {
		return nil, err
	}
	return &execution, nil
}

func capPaperPyramidQuantity(requestedText, currentQuantityText, markText string, configuration map[string]any) (string, bool, error) {
	allocation, configured := paperNumber(configuration["allocationUsdt"])
	if !configured || allocation <= 0 {
		return requestedText, true, nil
	}
	requested, requestedOK := new(big.Rat).SetString(requestedText)
	current, currentOK := new(big.Rat).SetString(currentQuantityText)
	mark, markOK := new(big.Rat).SetString(markText)
	allocationValue, allocationOK := new(big.Rat).SetString(strconv.FormatFloat(allocation, 'f', 8, 64))
	if !requestedOK || !currentOK || !markOK || !allocationOK || requested.Sign() <= 0 || mark.Sign() <= 0 {
		return "", false, errors.New("paper allocation quantity is invalid")
	}
	current.Abs(current)
	remainingNotional := new(big.Rat).Sub(allocationValue, new(big.Rat).Mul(current, mark))
	if remainingNotional.Sign() <= 0 {
		return "", false, nil
	}
	maximumQuantity := new(big.Rat).Quo(remainingNotional, mark)
	if requested.Cmp(maximumQuantity) > 0 {
		requested = maximumQuantity
	}
	if requested.Sign() <= 0 {
		return "", false, nil
	}
	return requested.FloatString(18), true, nil
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

func loadOpenPaperTrade(ctx context.Context, tx *sql.Tx, botID string) (*openPaperTrade, error) {
	var trade openPaperTrade
	var partialTaken string
	err := tx.QueryRowContext(ctx, `SELECT id, side, entryPrice, quantity, fees, slippageCost,
COALESCE(CAST(stopLoss AS CHAR), ''), COALESCE(CAST(takeProfit AS CHAR), ''), openedAt,
CAST(maxFavorableExcursion AS CHAR), CAST(maxAdverseExcursion AS CHAR), CAST(realizedPnl AS CHAR),
COALESCE(JSON_UNQUOTE(JSON_EXTRACT(marketContext, '$.partialTakeProfitTaken')), 'false')
FROM paper_trades WHERE tradingBotId = ? AND status = 'OPEN' ORDER BY openedAt DESC LIMIT 1 FOR UPDATE`, botID).Scan(
		&trade.ID, &trade.Side, &trade.EntryPrice, &trade.Quantity, &trade.Fees, &trade.SlippageCost,
		&trade.StopLoss, &trade.TakeProfit, &trade.OpenedAt, &trade.MaxFavorableExcursion, &trade.MaxAdverseExcursion, &trade.RealizedPnL, &partialTaken)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load open paper trade: %w", err)
	}
	trade.PartialTakeProfitTaken = partialTaken == "true" || partialTaken == "1"
	return &trade, nil
}

func recoverLegacyPaperTrade(ctx context.Context, tx *sql.Tx, instance bot.Instance, position bot.PaperPosition, decisionID int64, now time.Time) (*openPaperTrade, error) {
	side := "BUY"
	if decimalSign(position.NetQuantity) < 0 {
		side = "SELL"
	}
	quantity, ok := new(big.Rat).SetString(position.NetQuantity)
	if !ok {
		return nil, errors.New("legacy paper quantity is invalid")
	}
	quantity.Abs(quantity)
	stop, take, err := configuredProtectionPrices(instance.Configuration, side, position.AvgEntryPrice)
	if err != nil {
		return nil, err
	}
	trade := &openPaperTrade{
		ID: fmt.Sprintf("paper_recovered_%s_%d", instance.ID, decisionID), Side: side, EntryPrice: position.AvgEntryPrice,
		Quantity: quantity.FloatString(18), Fees: "0", SlippageCost: "0", StopLoss: stop, TakeProfit: take,
		OpenedAt: now, MaxFavorableExcursion: "0", MaxAdverseExcursion: "0", RealizedPnL: "0",
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO paper_trades
(id, tradingBotId, strategyVersionId, symbol, side, status, entryPrice, quantity, leverage, fees, funding, slippageCost, realizedPnl, stopLoss, takeProfit, maxFavorableExcursion, maxAdverseExcursion, decisionSummary, marketContext, openedAt, createdAt, updatedAt)
VALUES (?, ?, NULLIF(?, ''), ?, ?, 'OPEN', ?, ?, 1, 0, 0, 0, 0, ?, ?, 0, 0, 'Recovered from pre-lifecycle PAPER ledger.', JSON_OBJECT('recovered', true), ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		trade.ID, instance.ID, instance.StrategyVersionID, instance.Symbol, trade.Side, trade.EntryPrice, trade.Quantity, trade.StopLoss, trade.TakeProfit, now)
	if err != nil {
		return nil, fmt.Errorf("recover legacy paper trade: %w", err)
	}
	return trade, nil
}

func configuredProtectionPrices(configuration map[string]any, side, entryValue string) (string, string, error) {
	return plannedProtectionPrices(configuration, nil, side, entryValue)
}

func plannedProtectionPrices(configuration, plan map[string]any, side, entryValue string) (string, string, error) {
	entry, entryOK := new(big.Rat).SetString(entryValue)
	stopBps, stopOK := paperNumber(configuration["stopLossBps"])
	takeBps, takeOK := paperNumber(configuration["takeProfitBps"])
	if plan != nil {
		if planned, ok := paperNumber(plan["stopLossBps"]); ok {
			stopBps, stopOK = planned, true
		}
		if planned, ok := paperNumber(plan["takeProfitBps"]); ok {
			takeBps, takeOK = planned, true
		}
	}
	if !entryOK || !stopOK || !takeOK || stopBps <= 0 || takeBps <= 0 {
		return "", "", errors.New("paper protection configuration is invalid")
	}
	stopRate, _ := new(big.Rat).SetString(strconv.FormatFloat(stopBps/10_000, 'f', 8, 64))
	takeRate, _ := new(big.Rat).SetString(strconv.FormatFloat(takeBps/10_000, 'f', 8, 64))
	one := big.NewRat(1, 1)
	if side == "BUY" {
		return new(big.Rat).Mul(entry, new(big.Rat).Sub(one, stopRate)).FloatString(18), new(big.Rat).Mul(entry, new(big.Rat).Add(one, takeRate)).FloatString(18), nil
	}
	return new(big.Rat).Mul(entry, new(big.Rat).Add(one, stopRate)).FloatString(18), new(big.Rat).Mul(entry, new(big.Rat).Sub(one, takeRate)).FloatString(18), nil
}

func paperProtectionTrigger(trade *openPaperTrade, markValue string) string {
	mark, markOK := new(big.Rat).SetString(markValue)
	stop, stopOK := new(big.Rat).SetString(trade.StopLoss)
	take, takeOK := new(big.Rat).SetString(trade.TakeProfit)
	if !markOK {
		return ""
	}
	if trade.Side == "BUY" {
		if stopOK && mark.Cmp(stop) <= 0 {
			return "STOP_LOSS"
		}
		if takeOK && mark.Cmp(take) >= 0 {
			return "TAKE_PROFIT"
		}
	} else {
		if stopOK && mark.Cmp(stop) >= 0 {
			return "STOP_LOSS"
		}
		if takeOK && mark.Cmp(take) <= 0 {
			return "TAKE_PROFIT"
		}
	}
	return ""
}

func paperExcursions(trade *openPaperTrade, markValue string) (string, string, error) {
	entry, entryOK := new(big.Rat).SetString(trade.EntryPrice)
	mark, markOK := new(big.Rat).SetString(markValue)
	quantity, quantityOK := new(big.Rat).SetString(trade.Quantity)
	favorable, favorableOK := new(big.Rat).SetString(trade.MaxFavorableExcursion)
	adverse, adverseOK := new(big.Rat).SetString(trade.MaxAdverseExcursion)
	if !entryOK || !markOK || !quantityOK || !favorableOK || !adverseOK {
		return "", "", errors.New("paper excursion decimal is invalid")
	}
	pnl := new(big.Rat).Mul(new(big.Rat).Sub(mark, entry), quantity)
	if trade.Side == "SELL" {
		pnl.Neg(pnl)
	}
	if pnl.Sign() > 0 && pnl.Cmp(favorable) > 0 {
		favorable.Set(pnl)
	}
	if pnl.Sign() < 0 {
		loss := new(big.Rat).Abs(pnl)
		if loss.Cmp(adverse) > 0 {
			adverse.Set(loss)
		}
	}
	return favorable.FloatString(18), adverse.FloatString(18), nil
}

func insertPaperFill(ctx context.Context, tx *sql.Tx, botID string, decisionID int64, execution bot.PaperExecution, now time.Time) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO trading_bot_paper_fills
(tradingBotId, decisionId, side, quantity, markPrice, fillPrice, notional, fee, realizedPnl, slippageBps, feeBps, occurredAt, createdAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`, botID, decisionID, execution.Side,
		execution.Quantity, execution.MarkPrice, execution.FillPrice, execution.Notional, execution.Fee, execution.RealizedPnL,
		execution.SlippageBps, execution.FeeBps, now)
	if err != nil {
		return fmt.Errorf("insert paper fill: %w", err)
	}
	return nil
}

func savePaperPosition(ctx context.Context, tx *sql.Tx, instance bot.Instance, previous bot.PaperPosition, execution bot.PaperExecution, mark string, now time.Time, exists bool) error {
	openedAt := any(nil)
	if execution.NetQuantity != "0.000000000000000000" {
		openedAt = now
	}
	var err error
	if !exists {
		_, err = tx.ExecContext(ctx, `INSERT INTO trading_bot_paper_positions
(tradingBotId, symbol, netQuantity, avgEntryPrice, realizedPnl, unrealizedPnl, totalFees, lastMarkPrice, totalFills, openedAt, lastFilledAt, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, UTC_TIMESTAMP(3), ?)`, instance.ID, instance.Symbol, execution.NetQuantity,
			execution.AvgEntryPrice, execution.CumulativePnL, execution.UnrealizedPnL, execution.TotalFees, mark, openedAt, now, now)
	} else {
		if decimalSign(previous.NetQuantity) != 0 && decimalSign(execution.NetQuantity) != 0 {
			openedAt = nil
		}
		_, err = tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET netQuantity = ?, avgEntryPrice = ?, realizedPnl = ?,
unrealizedPnl = ?, totalFees = ?, lastMarkPrice = ?, totalFills = totalFills + 1,
openedAt = CASE WHEN ? = '0.000000000000000000' THEN NULL ELSE COALESCE(?, openedAt) END, lastFilledAt = ?, updatedAt = ?
WHERE tradingBotId = ?`, execution.NetQuantity, execution.AvgEntryPrice, execution.CumulativePnL, execution.UnrealizedPnL,
			execution.TotalFees, mark, execution.NetQuantity, openedAt, now, now, instance.ID)
	}
	if err != nil {
		return fmt.Errorf("persist paper position: %w", err)
	}
	return nil
}

func paperCosts(configuration map[string]any) (float64, float64) {
	fee, slippage := bot.DefaultPaperFeeBps, bot.DefaultPaperSlippageBps
	if value, ok := paperNumber(configuration["paperFeeBps"]); ok && value >= 0 {
		fee = value
	}
	if value, ok := paperNumber(configuration["paperSlippageBps"]); ok && value >= 0 {
		slippage = value
	}
	return fee, slippage
}

func addDecimals(values ...string) (string, error) {
	total := new(big.Rat)
	for _, value := range values {
		parsed, ok := new(big.Rat).SetString(value)
		if !ok {
			return "", errors.New("paper accounting decimal is invalid")
		}
		total.Add(total, parsed)
	}
	return total.FloatString(18), nil
}

func subtractDecimals(value string, deductions ...string) (string, error) {
	result, ok := new(big.Rat).SetString(value)
	if !ok {
		return "", errors.New("paper accounting decimal is invalid")
	}
	for _, deduction := range deductions {
		parsed, valid := new(big.Rat).SetString(deduction)
		if !valid {
			return "", errors.New("paper accounting decimal is invalid")
		}
		result.Sub(result, parsed)
	}
	return result.FloatString(18), nil
}

func paperSlippageCost(fillValue, markValue, quantityValue string) (string, error) {
	fill, fillOK := new(big.Rat).SetString(fillValue)
	mark, markOK := new(big.Rat).SetString(markValue)
	quantity, quantityOK := new(big.Rat).SetString(quantityValue)
	if !fillOK || !markOK || !quantityOK {
		return "", errors.New("paper slippage decimal is invalid")
	}
	cost := new(big.Rat).Mul(new(big.Rat).Abs(new(big.Rat).Sub(fill, mark)), quantity)
	return cost.FloatString(18), nil
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

func (s *AccountStore) LoadBotStrategyFamily(ctx context.Context, botID string) (string, error) {
	var family string
	err := s.database.QueryRowContext(ctx, `SELECT s.family FROM trading_bots b
JOIN trading_strategy_versions sv ON sv.id = b.strategyVersionId
JOIN trading_strategies s ON s.id = sv.strategyId WHERE b.id = ? LIMIT 1`, botID).Scan(&family)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errors.New("autonomous strategy registry link is unavailable")
	}
	if err != nil {
		return "", fmt.Errorf("load bot strategy family: %w", err)
	}
	return family, nil
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
