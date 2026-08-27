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
-- Oldest-due ordering is intentionally mode-neutral. Permanent DEMO priority
-- can starve PAPER bots whenever TESTNET cycles consume all workers.
ORDER BY COALESCE(lastDecisionAt, b.createdAt), b.id
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
	// An explicitly queued PAPER close is a local, risk-reducing accounting
	// operation. It must remain available under emergency stops so an operator
	// can flatten simulated exposure without reopening general execution. DEMO /
	// TESTNET and every non-close cycle continue through the normal gates below.
	if explicitPaperManualClose(instance) {
		return bot.Gate{Ready: true, Code: "PAPER_MANUAL_CLOSE_ONLY", Message: "Explicit PAPER close may proceed while safety gates remain closed."}, nil
	}
	switch {
	case !active:
		return bot.Gate{Code: "BOT_ACCOUNT_DISABLED", Message: "Borsa hesabı devre dışı."}, nil
	case botModeRequiresConnectedAccount(instance.Mode) && connectionStatus != "CONNECTED":
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

func botModeRequiresConnectedAccount(mode string) bool { return mode == "DEMO" }

func explicitPaperManualClose(instance bot.Instance) bool {
	return instance.Mode == "PAPER" && boolValue(instance.Configuration["paperManualCloseRequested"])
}

func (s *AccountStore) LoadBotMarketAccount(ctx context.Context, userID, accountID, mode string) (bot.MarketAccount, error) {
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
	if !active || (botModeRequiresConnectedAccount(mode) && status != "CONNECTED") {
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
WHERE id = ? AND schedulerOwner = ? AND state = 'RUNNING' AND symbol = ?`, now, now, leaseUntil, instance.ID, owner, instance.Symbol)
	if err != nil {
		return bot.CycleResult{}, fmt.Errorf("heartbeat bot cycle: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected != 1 {
		return bot.CycleResult{}, errors.New("bot cycle lost its scheduler lease or market symbol changed")
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
		ruleKindBeforeMentor := decision.Metrics["aiRuleDecisionKindBeforeMentor"]
		ruleActionBeforeMentor := decision.Metrics["aiRuleActionBeforeMentor"]
		comparisonFeatures, marshalErr := json.Marshal(map[string]any{
			"ruleDecisionKind": ruleKindBeforeMentor, "ruleAction": ruleActionBeforeMentor,
			"agreement":              decision.Metrics["aiMentorAgreement"],
			"modelReportedAgreement": decision.AIObservation.AgreesWithRuleEngine,
			"invalidationLevel":      decision.AIObservation.InvalidationLevel,
			"suggestedLeverage":      decision.AIObservation.SuggestedLeverage,
			"contextPackage":         decision.Metrics,
		})
		if marshalErr != nil {
			return bot.CycleResult{}, fmt.Errorf("marshal AI comparison features: %w", marshalErr)
		}
		observerSafetyChecks, marshalErr := json.Marshal(map[string]any{
			"mode": instance.Mode, "autonomyLevel": decision.Metrics["aiAutonomyLevel"],
			"comparisonOnly":   decision.Metrics["aiMentorComparisonOnly"] == true,
			"mentorGatePassed": decision.Metrics["aiMentorGatePassed"], "riskGatePassed": riskApproved,
			"submittedToExchange": false, "orderExecutionAllowed": false, "paperFillAllowed": false,
		})
		if marshalErr != nil {
			return bot.CycleResult{}, fmt.Errorf("marshal AI observer safety checks: %w", marshalErr)
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO trading_bot_signals
(tradingBotId, userId, exchangeAccountId, decisionId, source, action, status, confidence, rationale,
 modelProvider, modelName, promptVersion, features, safetyChecks, expiresAt, decidedAt, createdAt)
VALUES (?, ?, ?, ?, 'AI_MODEL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
			instance.ID, instance.UserID, instance.ExchangeAccountID, decisionID, decision.AIObservation.Action,
			aiSignalStatus(decision.Metrics),
			strconv.FormatFloat(decision.AIObservation.Confidence, 'f', 4, 64), decision.AIObservation.Rationale,
			decision.AIObservation.Provider, decision.AIObservation.Model, decision.AIObservation.PromptVersion,
			comparisonFeatures, observerSafetyChecks, decision.AIObservation.ExpiresAt, now)
		if err != nil {
			return bot.CycleResult{}, fmt.Errorf("insert AI observed signal: %w", err)
		}
	}
	var paperExecution *bot.PaperExecution
	if instance.Mode == "PAPER" {
		// Protective exits remain independent of entry-risk rejection. The
		// explicit central execution pause is handled inside persistPaperCycle and
		// deliberately freezes both entries and open-position automation.
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
	return bot.CycleResult{DecisionID: decisionID, RiskApproved: riskApproved, PaperExecutionChanged: paperExecution != nil}, nil
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

func aiSignalStatus(metrics map[string]any) string {
	if metrics["aiMentorComparisonOnly"] == true {
		return "OBSERVED"
	}
	if metrics["aiMentorGatePassed"] == true {
		return "ACCEPTED"
	}
	return "REJECTED"
}

type openPaperTrade struct {
	ID, Symbol, Side, EntryPrice, Quantity, Fees, SlippageCost, StopLoss, TakeProfit, RealizedPnL, SignalKey string
	OpenedAt                                                                                                 time.Time
	MaxFavorableExcursion, MaxAdverseExcursion                                                               string
	PartialTakeProfitTaken                                                                                   bool
}

func persistPaperCycle(ctx context.Context, tx *sql.Tx, instance bot.Instance, decision bot.Decision, decisionID int64, now time.Time, entryRiskApproved bool) (*bot.PaperExecution, error) {
	// PAPER is a distinct runtime risk profile. Apply its default in memory as
	// well as in provisioned configuration so already-running/restored bots do
	// not need to be recreated before receiving the net-profit floor.
	instance.Configuration["paperTrainingMode"] = true
	if configured, ok := paperNumber(instance.Configuration["minimumNetProfitBps"]); !ok || configured < bot.PaperTrainingMinNetProfitBps {
		instance.Configuration["minimumNetProfitBps"] = bot.PaperTrainingMinNetProfitBps
	}
	// Central execution pause freezes automatic PAPER position management and
	// new entries. An explicit admin manual-close request is the sole exception:
	// it is risk-reducing, auditable and must remain usable while entries are
	// paused. The entry guard below still prevents a replacement position.
	manualCloseRequested := boolValue(instance.Configuration["paperManualCloseRequested"])
	if paperExecutionPaused(instance.Configuration) {
		return nil, nil
	}
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
		retirementPending := boolValue(instance.Configuration["paperFleetRetirementPending"])
		manualCloseStopBot := boolValue(instance.Configuration["paperManualCloseStopBot"])
		legacyOutsideCore, coreErr := paperTradeOutsideCoreUniverse(ctx, tx, instance.UserID, openTrade.Symbol)
		if coreErr != nil {
			return nil, coreErr
		}
		// paper_trades is the immutable lifecycle source of truth. The aggregate
		// row may still carry the symbol of a previously closed trade after a
		// Universe rotation; repair only its label before marking this position.
		if position.Symbol != openTrade.Symbol {
			if _, repairErr := tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET symbol = ?, updatedAt = UTC_TIMESTAMP(3) WHERE tradingBotId = ?`, openTrade.Symbol, instance.ID); repairErr != nil {
				return nil, fmt.Errorf("repair paper aggregate symbol: %w", repairErr)
			}
			position.Symbol = openTrade.Symbol
		}
		if instance.Symbol != openTrade.Symbol {
			return nil, fmt.Errorf("paper market symbol mismatch: bot=%s open_trade=%s", instance.Symbol, openTrade.Symbol)
		}
		if floorErr := applyPaperTrainingProfitFloor(ctx, tx, instance.Configuration, openTrade); floorErr != nil {
			return nil, floorErr
		}
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
		if legacyOutsideCore {
			// Symbols which are not part of the configured Core Universe are old
			// training debt, not merely unchecked assets. Close them at the current
			// verified mark, then rotate the flat bot into an enabled Core asset.
			plan.Action = "CLOSE"
			plan.Reason = "CORE_UNIVERSE_LEGACY_EXIT"
		}
		if retirementPending {
			// Fleet reduction is PAPER-only and always risk reducing. It uses the
			// same fill, fee, slippage and realized-PnL lifecycle as SL/TP exits;
			// no trade or performance history is deleted or rewritten.
			plan.Action = "CLOSE"
			plan.Reason = "PAPER_FLEET_RETIREMENT"
		}
		if manualCloseRequested && !retirementPending {
			plan.Action = "CLOSE"
			plan.Reason = "ADMIN_MANUAL_CLOSE"
		}
		if plan.Action == "MOVE_STOP" {
			if _, err = tx.ExecContext(ctx, `UPDATE paper_trades SET stopLoss = ?, maxFavorableExcursion = ?, maxAdverseExcursion = ?, marketContext = JSON_SET(COALESCE(marketContext, JSON_OBJECT()), '$.trailingStopActive', true), updatedAt = UTC_TIMESTAMP(3) WHERE id = ?`, plan.NewStop, favorable, adverse, openTrade.ID); err != nil {
				return nil, fmt.Errorf("advance paper trailing stop: %w", err)
			}
			if _, err = tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET symbol = ?, unrealizedPnl = ?, lastMarkPrice = ?, updatedAt = ? WHERE tradingBotId = ?`, openTrade.Symbol, unrealized, decision.MarkPrice, now, instance.ID); err != nil {
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
			if _, err = tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET symbol = ?, unrealizedPnl = ?, lastMarkPrice = ?, updatedAt = ? WHERE tradingBotId = ?`,
				openTrade.Symbol, unrealized, decision.MarkPrice, now, instance.ID); err != nil {
				return nil, fmt.Errorf("update paper position mark: %w", err)
			}
			if _, err = tx.ExecContext(ctx, `UPDATE paper_trades SET maxFavorableExcursion = ?, maxAdverseExcursion = ?, updatedAt = UTC_TIMESTAMP(3) WHERE id = ?`, favorable, adverse, openTrade.ID); err != nil {
				return nil, fmt.Errorf("update paper trade excursions: %w", err)
			}
			// PAPER evidence units stay independent: a bot never mutates an
			// already-open trade into a larger/averaged trade. Multiple bots and
			// strategies may still hold separate trades on the same coin.
			if decision.HypotheticalOrder == nil || !entryRiskApproved || boolValue(instance.Configuration["entryPaused"]) || !paperPyramidingAllowed(instance.Mode, instance.Configuration) {
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
			signalKey, _ := decision.HypotheticalOrder["signalKey"].(string)
			if duplicatePaperSignal(openTrade.SignalKey, signalKey) {
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
			if _, err = tx.ExecContext(ctx, `UPDATE paper_trades SET entryPrice = ?, quantity = ?, fees = ?, slippageCost = ?, stopLoss = ?, takeProfit = ?, maxFavorableExcursion = ?, maxAdverseExcursion = ?, decisionSummary = ?, marketContext = JSON_SET(COALESCE(marketContext, JSON_OBJECT()), '$.signalKey', ?), updatedAt = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'OPEN'`,
				execution.AvgEntryPrice, quantityValue.FloatString(18), totalFees, totalSlippage, stop, take, favorable, adverse, decision.Summary, signalKey, openTrade.ID); err != nil {
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
		if retirementPending {
			if err = archiveDrainedPaperBot(ctx, tx, instance, now); err != nil {
				return nil, err
			}
		} else if manualCloseRequested {
			if err = completeManualPaperClose(ctx, tx, instance, manualCloseStopBot, now); err != nil {
				return nil, err
			}
		}
		if legacyOutsideCore {
			if err = rotateFlatPaperBotToCore(ctx, tx, instance); err != nil {
				return nil, err
			}
		}
		return &execution, nil
	}
	if decision.HypotheticalOrder == nil || !entryRiskApproved || boolValue(instance.Configuration["entryPaused"]) {
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
	stopLoss, takeProfit, protectionErr := plannedProtectionPrices(instance.Configuration, decision.HypotheticalOrder, side, execution.FillPrice)
	if protectionErr != nil {
		return nil, protectionErr
	}
	leverage, _ := paperNumber(decision.HypotheticalOrder["leverage"])
	entrySlippage, calcErr := paperSlippageCost(execution.FillPrice, decision.MarkPrice, execution.Quantity)
	if calcErr != nil {
		return nil, calcErr
	}
	tradeID := fmt.Sprintf("paper_%s_%d", instance.ID, decisionID)
	playbookVersion, _ := decision.HypotheticalOrder["playbookVersion"].(string)
	experimentID, _ := decision.HypotheticalOrder["experimentId"].(string)
	experimentVariant, _ := decision.HypotheticalOrder["experimentVariant"].(string)
	signalExperimentID, _ := decision.HypotheticalOrder["signalExperimentId"].(string)
	signalExperimentVariant, _ := decision.HypotheticalOrder["signalExperimentVariant"].(string)
	riskPlanVersion, _ := decision.HypotheticalOrder["riskPlanVersion"].(string)
	signalKey, _ := decision.HypotheticalOrder["signalKey"].(string)
	var marketRegimeSnapshotID sql.NullInt64
	regimeErr := tx.QueryRowContext(ctx, `SELECT id FROM market_regime_snapshots WHERE symbol = ? ORDER BY observedAt DESC, id DESC LIMIT 1`, instance.Symbol).Scan(&marketRegimeSnapshotID)
	if regimeErr != nil && !errors.Is(regimeErr, sql.ErrNoRows) {
		return nil, fmt.Errorf("load paper trade market regime: %w", regimeErr)
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO paper_trades
(id, tradingBotId, strategyVersionId, marketRegimeSnapshotId, symbol, side, status, entryPrice, quantity, leverage, fees, funding, slippageCost, realizedPnl, stopLoss, takeProfit, maxFavorableExcursion, maxAdverseExcursion, decisionSummary, marketContext, openedAt, createdAt, updatedAt)
VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, 'OPEN', ?, ?, ?, ?, 0, ?, 0, NULLIF(?, ''), NULLIF(?, ''), 0, 0, ?, JSON_OBJECT('partialTakeProfitTaken', false, 'playbookVersion', ?, 'experimentId', ?, 'experimentVariant', ?, 'signalExperimentId', ?, 'signalExperimentVariant', ?, 'riskPlanVersion', ?, 'signalKey', ?), ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
		tradeID, instance.ID, instance.StrategyVersionID, marketRegimeSnapshotID, instance.Symbol, execution.Side, execution.FillPrice, execution.Quantity,
		int(leverage), execution.Fee, entrySlippage, stopLoss, takeProfit, decision.Summary, playbookVersion, experimentID, experimentVariant, signalExperimentID, signalExperimentVariant, riskPlanVersion, signalKey, now); err != nil {
		return nil, fmt.Errorf("open autonomous paper trade: %w", err)
	}
	if err = savePaperPosition(ctx, tx, instance, position, execution, decision.MarkPrice, now, exists); err != nil {
		return nil, err
	}
	return &execution, nil
}

func paperExecutionPaused(configuration map[string]any) bool {
	return boolValue(configuration["entryPaused"]) && !boolValue(configuration["paperManualCloseRequested"])
}

func completeManualPaperClose(ctx context.Context, tx *sql.Tx, instance bot.Instance, stopBot bool, now time.Time) error {
	query := `UPDATE trading_bots SET
configuration = JSON_REMOVE(configuration, '$.paperManualCloseRequested', '$.paperManualCloseStopBot', '$.paperManualCloseRequestedAt'),
version = version + 1, updatedAt = UTC_TIMESTAMP(3)
WHERE id = ? AND userId = ? AND mode = 'PAPER'`
	args := []any{instance.ID, instance.UserID}
	if stopBot {
		query = `UPDATE trading_bots SET
configuration = JSON_REMOVE(configuration, '$.paperManualCloseRequested', '$.paperManualCloseStopBot', '$.paperManualCloseRequestedAt'),
state = 'STOPPED', desiredState = 'STOPPED', schedulerOwner = NULL, leaseExpiresAt = NULL,
heartbeatAt = ?, stoppedAt = ?, stateReason = 'Admin closed PAPER position and stopped bot.',
version = version + 1, updatedAt = UTC_TIMESTAMP(3)
WHERE id = ? AND userId = ? AND mode = 'PAPER'`
		args = []any{now, now, instance.ID, instance.UserID}
	}
	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("complete manual paper close: %w", err)
	}
	affected, affectedErr := result.RowsAffected()
	if affectedErr != nil || affected != 1 {
		return errors.New("manual paper close state changed concurrently")
	}
	metadata, marshalErr := json.Marshal(map[string]any{"reason": "ADMIN_MANUAL_CLOSE", "stopBot": stopBot, "historyDeleted": false, "liveChanged": false})
	if marshalErr != nil {
		return marshalErr
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO trading_audit_logs
(id, userId, exchangeAccountId, action, entityType, entityId, metadata, createdAt)
VALUES (UUID(), ?, ?, 'AI_PAPER_POSITION_MANUALLY_CLOSED', 'TRADING_BOT', ?, ?, ?)`,
		instance.UserID, instance.ExchangeAccountID, instance.ID, metadata, now); err != nil {
		return fmt.Errorf("audit manual paper close: %w", err)
	}
	return nil
}

func archiveDrainedPaperBot(ctx context.Context, tx *sql.Tx, instance bot.Instance, now time.Time) error {
	result, err := tx.ExecContext(ctx, `UPDATE trading_bots
SET lifecycleStatus = 'ARCHIVED', state = 'STOPPED', desiredState = 'STOPPED',
schedulerOwner = NULL, leaseExpiresAt = NULL, heartbeatAt = ?, stoppedAt = ?,
stateReason = 'PAPER fleet drain completed; full trade and PnL history retained.', version = version + 1
WHERE id = ? AND userId = ? AND mode = 'PAPER'
  AND JSON_EXTRACT(configuration, '$.paperFleetRetirementPending') = TRUE`, now, now, instance.ID, instance.UserID)
	if err != nil {
		return fmt.Errorf("archive drained paper bot: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return errors.New("drained paper bot retirement state changed concurrently")
	}
	metadata, err := json.Marshal(map[string]any{"reason": "PAPER_FLEET_RETIREMENT", "historyDeleted": false, "liveChanged": false})
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO trading_audit_logs
(id, userId, exchangeAccountId, action, entityType, entityId, metadata, createdAt)
VALUES (UUID(), ?, ?, 'AI_PAPER_FLEET_BOT_DRAINED', 'TRADING_BOT', ?, ?, ?)`,
		instance.UserID, instance.ExchangeAccountID, instance.ID, metadata, now)
	if err != nil {
		return fmt.Errorf("audit drained paper bot: %w", err)
	}
	return nil
}

func paperTradeOutsideCoreUniverse(ctx context.Context, tx *sql.Tx, userID, symbol string) (bool, error) {
	var configured bool
	err := tx.QueryRowContext(ctx, `SELECT TRUE FROM trading_universe_assets WHERE userId = ? AND symbol = ? LIMIT 1`, userID, symbol).Scan(&configured)
	if errors.Is(err, sql.ErrNoRows) {
		return true, nil
	}
	if err != nil {
		return false, fmt.Errorf("load paper trade Core Universe membership: %w", err)
	}
	return !configured, nil
}

func rotateFlatPaperBotToCore(ctx context.Context, tx *sql.Tx, instance bot.Instance) error {
	var symbol string
	err := tx.QueryRowContext(ctx, `SELECT symbol FROM trading_universe_assets
WHERE userId = ? AND enabled = TRUE
ORDER BY CRC32(CONCAT(symbol, ?)), sortOrder, symbol LIMIT 1`, instance.UserID, instance.ID).Scan(&symbol)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("cannot rotate PAPER bot: Core Trading Universe has no enabled symbol")
	}
	if err != nil {
		return fmt.Errorf("select PAPER Core Universe assignment: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `UPDATE trading_bots SET symbol = ?, symbols = JSON_ARRAY(?), lastDecisionAt = NULL, version = version + 1, updatedAt = UTC_TIMESTAMP(3)
WHERE id = ? AND userId = ? AND mode = 'PAPER' AND symbol = ?`, symbol, symbol, instance.ID, instance.UserID, instance.Symbol); err != nil {
		return fmt.Errorf("rotate PAPER bot into Core Trading Universe: %w", err)
	}
	return nil
}

func duplicatePaperSignal(previous, current string) bool {
	return current != "" && current == previous
}

func paperPyramidingAllowed(mode string, configuration map[string]any) bool {
	return mode != "PAPER" && configuration["pyramidingEnabled"] == true
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
	err := tx.QueryRowContext(ctx, `SELECT symbol, netQuantity, avgEntryPrice, realizedPnl, totalFees
FROM trading_bot_paper_positions WHERE tradingBotId = ? FOR UPDATE`, botID).Scan(
		&position.Symbol, &position.NetQuantity, &position.AvgEntryPrice, &position.RealizedPnL, &position.TotalFees)
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
	err := tx.QueryRowContext(ctx, `SELECT id, symbol, side, entryPrice, quantity, fees, slippageCost,
COALESCE(CAST(stopLoss AS CHAR), ''), COALESCE(CAST(takeProfit AS CHAR), ''), openedAt,
CAST(maxFavorableExcursion AS CHAR), CAST(maxAdverseExcursion AS CHAR), CAST(realizedPnl AS CHAR),
COALESCE(JSON_UNQUOTE(JSON_EXTRACT(marketContext, '$.partialTakeProfitTaken')), 'false'),
COALESCE(JSON_UNQUOTE(JSON_EXTRACT(marketContext, '$.signalKey')), '')
FROM paper_trades WHERE tradingBotId = ? AND status = 'OPEN' ORDER BY openedAt DESC LIMIT 1 FOR UPDATE`, botID).Scan(
		&trade.ID, &trade.Symbol, &trade.Side, &trade.EntryPrice, &trade.Quantity, &trade.Fees, &trade.SlippageCost,
		&trade.StopLoss, &trade.TakeProfit, &trade.OpenedAt, &trade.MaxFavorableExcursion, &trade.MaxAdverseExcursion, &trade.RealizedPnL, &partialTaken, &trade.SignalKey)
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
		ID: fmt.Sprintf("paper_recovered_%s_%d", instance.ID, decisionID), Symbol: instance.Symbol, Side: side, EntryPrice: position.AvgEntryPrice,
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
	var stop, take *big.Rat
	if side == "BUY" {
		stop = new(big.Rat).Mul(entry, new(big.Rat).Sub(one, stopRate))
		take = new(big.Rat).Mul(entry, new(big.Rat).Add(one, takeRate))
	} else if side == "SELL" {
		stop = new(big.Rat).Mul(entry, new(big.Rat).Add(one, stopRate))
		take = new(big.Rat).Mul(entry, new(big.Rat).Sub(one, takeRate))
	} else {
		return "", "", errors.New("paper protection side is invalid")
	}
	if configuration["paperTrainingMode"] == true {
		minimumNetBps, ok := paperNumber(configuration["minimumNetProfitBps"])
		if !ok || minimumNetBps < bot.PaperTrainingMinNetProfitBps {
			minimumNetBps = bot.PaperTrainingMinNetProfitBps
		}
		feeBps, slippageBps := paperCosts(configuration)
		netTarget, targetErr := paperMinimumNetTarget(entry, side, minimumNetBps, feeBps, slippageBps)
		if targetErr != nil {
			return "", "", targetErr
		}
		if (side == "BUY" && netTarget.Cmp(take) > 0) || (side == "SELL" && netTarget.Cmp(take) < 0) {
			take = netTarget
		}
	}
	return stop.FloatString(18), take.FloatString(18), nil
}

// paperMinimumNetTarget returns the mark price which still realizes the
// requested profit after both entry/exit fees and adverse exit slippage. The
// entry argument is the actual simulated fill, so entry slippage is already
// represented and must not be deducted a second time.
func paperMinimumNetTarget(entry *big.Rat, side string, minimumNetBps, feeBps, slippageBps float64) (*big.Rat, error) {
	if entry == nil || entry.Sign() <= 0 || minimumNetBps <= 0 || feeBps < 0 || slippageBps < 0 {
		return nil, errors.New("paper minimum net target input is invalid")
	}
	one := big.NewRat(1, 1)
	// A tiny execution buffer prevents DECIMAL(36,18) rounding from placing the
	// trigger a fraction below the promised net floor.
	netRate := bpsRat(minimumNetBps + 0.01)
	feeRate := bpsRat(feeBps)
	slippageRate := bpsRat(slippageBps)
	var ratio *big.Rat
	if side == "BUY" {
		denominator := new(big.Rat).Mul(new(big.Rat).Sub(one, feeRate), new(big.Rat).Sub(one, slippageRate))
		if denominator.Sign() <= 0 {
			return nil, errors.New("paper long net target costs are invalid")
		}
		ratio = new(big.Rat).Quo(new(big.Rat).Add(new(big.Rat).Add(one, netRate), feeRate), denominator)
	} else if side == "SELL" {
		numerator := new(big.Rat).Sub(new(big.Rat).Sub(one, netRate), feeRate)
		denominator := new(big.Rat).Mul(new(big.Rat).Add(one, feeRate), new(big.Rat).Add(one, slippageRate))
		if numerator.Sign() <= 0 || denominator.Sign() <= 0 {
			return nil, errors.New("paper short net target costs are invalid")
		}
		ratio = new(big.Rat).Quo(numerator, denominator)
	} else {
		return nil, errors.New("paper minimum net target side is invalid")
	}
	return new(big.Rat).Mul(entry, ratio), nil
}

func bpsRat(value float64) *big.Rat {
	parsed, _ := new(big.Rat).SetString(strconv.FormatFloat(value/10_000, 'f', 8, 64))
	return parsed
}

func applyPaperTrainingProfitFloor(ctx context.Context, tx *sql.Tx, configuration map[string]any, trade *openPaperTrade) error {
	if configuration["paperTrainingMode"] != true || trade == nil || trade.PartialTakeProfitTaken {
		return nil
	}
	_, floor, err := configuredProtectionPrices(configuration, trade.Side, trade.EntryPrice)
	if err != nil {
		return err
	}
	current, currentOK := new(big.Rat).SetString(trade.TakeProfit)
	minimum, minimumOK := new(big.Rat).SetString(floor)
	if !minimumOK {
		return errors.New("paper minimum profit floor is invalid")
	}
	needsUpgrade := !currentOK || (trade.Side == "BUY" && current.Cmp(minimum) < 0) || (trade.Side == "SELL" && current.Cmp(minimum) > 0)
	if !needsUpgrade {
		return nil
	}
	minimumNetBps, ok := paperNumber(configuration["minimumNetProfitBps"])
	if !ok || minimumNetBps < bot.PaperTrainingMinNetProfitBps {
		minimumNetBps = bot.PaperTrainingMinNetProfitBps
	}
	if _, err := tx.ExecContext(ctx, `UPDATE paper_trades SET takeProfit = ?, marketContext = JSON_SET(COALESCE(marketContext, JSON_OBJECT()), '$.minimumNetProfitBps', ?), updatedAt = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'OPEN'`, floor, minimumNetBps, trade.ID); err != nil {
		return fmt.Errorf("upgrade paper minimum profit floor: %w", err)
	}
	trade.TakeProfit = floor
	return nil
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
		_, err = tx.ExecContext(ctx, `UPDATE trading_bot_paper_positions SET symbol = ?, netQuantity = ?, avgEntryPrice = ?, realizedPnl = ?,
unrealizedPnl = ?, totalFees = ?, lastMarkPrice = ?, totalFills = totalFills + 1,
openedAt = CASE WHEN ? = '0.000000000000000000' THEN NULL ELSE COALESCE(?, openedAt) END, lastFilledAt = ?, updatedAt = ?
WHERE tradingBotId = ?`, instance.Symbol, execution.NetQuantity, execution.AvgEntryPrice, execution.CumulativePnL, execution.UnrealizedPnL,
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
