package mysqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/autonomousrisk"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/bot"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/entrycheck"
)

const (
	paperTrainingMaxConcurrentPositions = 100
	testnetLiveMaxConcurrentPositions   = 15
)

func evaluateAutonomousPaperRisk(ctx context.Context, tx *sql.Tx, instance bot.Instance, decision bot.Decision, now time.Time) (autonomousrisk.Decision, error) {
	order := decision.HypotheticalOrder
	intent := autonomousrisk.Intent{Mode: instance.Mode, Side: textValue(order["side"]), MarginMode: textValue(order["marginMode"]), EntryPrice: decision.MarkPrice,
		StopLoss: textValue(order["stopLoss"]), TakeProfit: textValue(order["takeProfit"]), Quantity: textValue(order["quantity"]), Leverage: intValue(order["leverage"]),
		EntryEvidence: entrycheck.Input{Regime: textValue(order["marketRegime"]), HigherTimeframeAligned: boolValue(order["higherTimeframeAligned"]),
			ConfirmedTimeframes: intValue(order["confirmedTimeframes"]), DerivativesAligned: boolValue(order["derivativesAligned"]), ContinuousTraining: boolValue(order["continuousTrainingEntry"])},
		ExecutionMode: instance.Mode, ObservationApproved: boolValue(instance.Configuration["observationApproved"])}
	// DEMO is the persisted marker for explicitly activated TESTNET execution.
	// The immutable autonomous policy is evaluated with PAPER semantics first;
	// the central exchange-aware risk engine evaluates the resulting order again.
	if instance.Mode == "DEMO" {
		intent.Mode = "PAPER"
	}
	var policy autonomousrisk.Policy
	var paperMaxOpenPositions int
	var starting, netQuantity, realized, unrealized, fees, lastMark string
	var lastFill sql.NullTime
	err := tx.QueryRowContext(ctx, `SELECT p.enabled, c.globalKillSwitch, p.accountKillSwitch,
CAST(p.maxRiskPerTradePct AS CHAR), CAST(p.maxDailyLossPct AS CHAR), CAST(p.maxWeeklyLossPct AS CHAR), CAST(p.maxDrawdownPct AS CHAR),
p.maxLeverage, p.maxOpenPositions, p.paperMaxOpenPositions, CAST(p.maxAccountOpenNotional AS CHAR), CAST(p.maxSymbolOpenNotional AS CHAR),
CAST(p.maxOrderNotional AS CHAR), CAST(p.minRiskRewardRatio AS CHAR), p.stopLossRequired, p.marginModePolicy,
p.cooldownSeconds, p.maxConsecutiveLosses, CAST(b.startingPaperBalance AS CHAR),
COALESCE(CAST(pos.netQuantity AS CHAR), '0'), COALESCE(CAST(pos.realizedPnl AS CHAR), '0'),
COALESCE(CAST(pos.unrealizedPnl AS CHAR), '0'), COALESCE(CAST(pos.totalFees AS CHAR), '0'),
COALESCE(CAST(pos.lastMarkPrice AS CHAR), '0'), pos.lastFilledAt
FROM trading_bots b
JOIN trading_risk_profiles p ON p.id = b.riskProfileId AND p.exchangeAccountId = b.exchangeAccountId
JOIN trading_risk_controls c ON c.id = 'global'
LEFT JOIN trading_bot_paper_positions pos ON pos.tradingBotId = b.id
WHERE b.id = ? AND b.userId = ? FOR UPDATE`, instance.ID, instance.UserID).Scan(
		&policy.Enabled, &policy.GlobalKillSwitch, &policy.AccountKillSwitch,
		&policy.MaxRiskPerTradePct, &policy.MaxDailyLossPct, &policy.MaxWeeklyLossPct, &policy.MaxDrawdownPct,
		&policy.MaxLeverage, &policy.MaxConcurrentPositions, &paperMaxOpenPositions, &policy.MaxTotalExposure, &policy.MaxSymbolExposure,
		&policy.MaxPositionSize, &policy.MinRiskReward, &policy.StopLossRequired, &policy.MarginModePolicy,
		&policy.CooldownSeconds, &policy.MaxConsecutiveLosses, &starting, &netQuantity, &realized, &unrealized, &fees, &lastMark, &lastFill)
	if errors.Is(err, sql.ErrNoRows) {
		return autonomousrisk.Decision{}, errors.New("autonomous risk profile is unavailable")
	}
	if err != nil {
		return autonomousrisk.Decision{}, fmt.Errorf("load autonomous risk profile: %w", err)
	}
	policy = autonomousPolicyForMode(policy, instance.Mode, paperMaxOpenPositions)
	if instance.Mode == "SHADOW" {
		shadowErr := tx.QueryRowContext(ctx, `SELECT CAST(netQuantity AS CHAR), CAST(cumulativePnl AS CHAR),
CAST(unrealizedPnl AS CHAR), CAST(totalFees AS CHAR), CAST(markPrice AS CHAR), occurredAt
FROM shadow_trades WHERE tradingBotId = ? ORDER BY id DESC LIMIT 1`, instance.ID).Scan(
			&netQuantity, &realized, &unrealized, &fees, &lastMark, &lastFill)
		if shadowErr != nil && !errors.Is(shadowErr, sql.ErrNoRows) {
			return autonomousrisk.Decision{}, fmt.Errorf("load autonomous shadow position: %w", shadowErr)
		}
		if errors.Is(shadowErr, sql.ErrNoRows) {
			netQuantity, realized, unrealized, fees, lastMark = "0", "0", "0", "0", "0"
			lastFill = sql.NullTime{}
		}
	}
	// A bot's configured allocation is the cash allocation boundary. PAPER
	// stores leveraged notional, so its position-size boundary is allocation x
	// leverage; TESTNET/live continue to use the stricter persisted boundary.
	if allocation, ok := numericBotConfiguration(instance.Configuration["allocationUsdt"]); ok && allocation > 0 {
		configuredLimit := allocation
		if instance.Mode == "PAPER" {
			configuredLimit *= float64(maxIntValue(intent.Leverage, 1))
			policy.MaxPositionSize = ratText(new(big.Rat).SetFloat64(configuredLimit))
			policy.CooldownSeconds = 0
			if configuredRisk, riskOK := numericBotConfiguration(instance.Configuration["paperMaxRiskPerTradePct"]); riskOK && configuredRisk >= 0.01 && configuredRisk <= 0.20 {
				policy.MaxRiskPerTradePct = ratText(new(big.Rat).SetFloat64(configuredRisk))
			}
		} else {
			configured := ratText(new(big.Rat).SetFloat64(configuredLimit))
			if current, currentOK := decimalRat(policy.MaxPositionSize); currentOK {
				limit, _ := decimalRat(configured)
				if current.Cmp(limit) > 0 {
					policy.MaxPositionSize = configured
				}
			}
		}
	}
	if instance.Mode == "PAPER" {
		// PAPER concurrency is a training fleet limit, not a claim on the shared
		// TESTNET/live account notional. Size its aggregate/symbol exposure from
		// the already risk-capped per-bot allocation so 100 independent bots can
		// collect evidence without weakening per-trade checks or live policies.
		policy = paperTrainingExposurePolicy(policy)
	}

	quantity, qok := decimalRat(intent.Quantity)
	entry, eok := decimalRat(intent.EntryPrice)
	net, nok := decimalRat(netQuantity)
	if !qok || !eok || !nok {
		return autonomousrisk.Decision{}, errors.New("autonomous intent decimal is invalid")
	}
	intent.RiskReducing = (net.Sign() > 0 && intent.Side == "SELL" && quantity.Cmp(absRat(net)) <= 0) || (net.Sign() < 0 && intent.Side == "BUY" && quantity.Cmp(absRat(net)) <= 0)
	intent.OpensNewPosition = net.Sign() == 0
	if !intent.RiskReducing {
		var universeEnabled bool
		universeErr := tx.QueryRowContext(ctx, `SELECT enabled FROM trading_universe_assets WHERE userId = ? AND symbol = ? LIMIT 1`, instance.UserID, instance.Symbol).Scan(&universeEnabled)
		if universeErr != nil && !errors.Is(universeErr, sql.ErrNoRows) {
			return autonomousrisk.Decision{}, fmt.Errorf("load Core Trading Universe policy: %w", universeErr)
		}
		if !coreUniverseAllowsExposure(intent.RiskReducing, universeErr == nil, universeEnabled) {
			result := autonomousrisk.Decision{Status: "REJECTED", Code: "RISK_SYMBOL_OUTSIDE_CORE_UNIVERSE", Message: "New autonomous exposure is disabled for this Core Trading Universe symbol.", Metrics: map[string]any{"symbol": instance.Symbol, "riskReducing": false}}
			if recordErr := recordAutonomousRiskDecision(ctx, tx, instance, result, now); recordErr != nil {
				return autonomousrisk.Decision{}, recordErr
			}
			return result, nil
		}
	}
	orderNotional := new(big.Rat).Mul(quantity, entry)

	var openPositions int
	var totalExposure, symbolExposure string
	exposureQuery := `SELECT COUNT(*),
COALESCE(CAST(SUM(ABS(pos.netQuantity) * pos.lastMarkPrice) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN pos.symbol = ? THEN ABS(pos.netQuantity) * pos.lastMarkPrice ELSE 0 END) AS CHAR), '0')
FROM trading_bot_paper_positions pos JOIN trading_bots b ON b.id = pos.tradingBotId
WHERE b.exchangeAccountId = ? AND b.mode = 'PAPER' AND pos.netQuantity <> 0`
	exposureScope := instance.ExchangeAccountID
	if instance.Mode == "DEMO" {
		exposureQuery = `SELECT COUNT(*),
COALESCE(CAST(SUM(ABS(pos.netQuantity) * pos.lastMarkPrice) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN pos.symbol = ? THEN ABS(pos.netQuantity) * pos.lastMarkPrice ELSE 0 END) AS CHAR), '0')
FROM trading_bot_paper_positions pos JOIN trading_bots b ON b.id = pos.tradingBotId
WHERE b.exchangeAccountId = ? AND b.mode = 'DEMO' AND pos.netQuantity <> 0`
		exposureScope = instance.ExchangeAccountID
	}
	if instance.Mode == "SHADOW" {
		exposureQuery = `SELECT COUNT(*),
COALESCE(CAST(SUM(ABS(latest.netQuantity) * latest.markPrice) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN b.symbol = ? THEN ABS(latest.netQuantity) * latest.markPrice ELSE 0 END) AS CHAR), '0')
FROM shadow_trades latest JOIN trading_bots b ON b.id = latest.tradingBotId
WHERE b.exchangeAccountId = ? AND b.mode = 'SHADOW' AND latest.netQuantity <> 0
AND latest.id = (SELECT current.id FROM shadow_trades current WHERE current.tradingBotId = latest.tradingBotId ORDER BY current.id DESC LIMIT 1)`
		exposureScope = instance.ExchangeAccountID
	}
	if err := tx.QueryRowContext(ctx, exposureQuery, instance.Symbol, exposureScope).Scan(&openPositions, &totalExposure, &symbolExposure); err != nil {
		return autonomousrisk.Decision{}, fmt.Errorf("load autonomous exposure: %w", err)
	}
	projectedTotal, ok := addDecimal(totalExposure, ratText(orderNotional))
	if !ok {
		return autonomousrisk.Decision{}, errors.New("autonomous total exposure is invalid")
	}
	projectedSymbol, ok := addDecimal(symbolExposure, ratText(orderNotional))
	if !ok {
		return autonomousrisk.Decision{}, errors.New("autonomous symbol exposure is invalid")
	}
	projectedPosition := ratText(orderNotional)
	if net.Sign() != 0 {
		currentNotional := new(big.Rat).Mul(absRat(net), entry)
		projectedPosition = ratText(new(big.Rat).Add(currentNotional, orderNotional))
	}
	if intent.RiskReducing {
		projectedTotal, projectedSymbol, projectedPosition = totalExposure, symbolExposure, ratText(new(big.Rat).Mul(absRat(net), entry))
	}

	dayStart := time.Date(now.UTC().Year(), now.UTC().Month(), now.UTC().Day(), 0, 0, 0, 0, time.UTC)
	weekStart := dayStart.AddDate(0, 0, -int(dayStart.Weekday()+6)%7)
	var dailyLoss, weeklyLoss string
	lossQuery := `SELECT
COALESCE(CAST(SUM(CASE WHEN f.occurredAt >= ? AND f.realizedPnl < 0 THEN -f.realizedPnl ELSE 0 END) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN f.occurredAt >= ? AND f.realizedPnl < 0 THEN -f.realizedPnl ELSE 0 END) AS CHAR), '0')
FROM trading_bot_paper_fills f JOIN trading_bots b ON b.id = f.tradingBotId WHERE b.id = ?`
	lossScope := instance.ID
	if instance.Mode == "DEMO" {
		lossQuery = `SELECT
COALESCE(CAST(SUM(CASE WHEN f.occurredAt >= ? AND f.realizedPnl < 0 THEN -f.realizedPnl ELSE 0 END) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN f.occurredAt >= ? AND f.realizedPnl < 0 THEN -f.realizedPnl ELSE 0 END) AS CHAR), '0')
FROM trading_bot_paper_fills f JOIN trading_bots b ON b.id = f.tradingBotId WHERE b.exchangeAccountId = ? AND b.mode = 'DEMO'`
		lossScope = instance.ExchangeAccountID
	}
	if instance.Mode == "SHADOW" {
		lossQuery = `SELECT
COALESCE(CAST(SUM(CASE WHEN f.occurredAt >= ? AND f.realizedPnl < 0 THEN -f.realizedPnl ELSE 0 END) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN f.occurredAt >= ? AND f.realizedPnl < 0 THEN -f.realizedPnl ELSE 0 END) AS CHAR), '0')
FROM shadow_trades f JOIN trading_bots b ON b.id = f.tradingBotId WHERE b.exchangeAccountId = ? AND b.mode = 'SHADOW'`
		lossScope = instance.ExchangeAccountID
	}
	if err := tx.QueryRowContext(ctx, lossQuery, dayStart, weekStart, lossScope).Scan(&dailyLoss, &weeklyLoss); err != nil {
		return autonomousrisk.Decision{}, fmt.Errorf("load autonomous losses: %w", err)
	}
	drawdown := "0"
	err = tx.QueryRowContext(ctx, `SELECT CAST(maxDrawdown AS CHAR) FROM bot_metrics WHERE tradingBotId = ? ORDER BY snapshotAt DESC, id DESC LIMIT 1`, instance.ID).Scan(&drawdown)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return autonomousrisk.Decision{}, fmt.Errorf("load autonomous drawdown: %w", err)
	}
	consecutive, consecutiveAt, err := consecutivePaperLosses(ctx, tx, instance.ID, policy.MaxConsecutiveLosses)
	if instance.Mode == "SHADOW" {
		consecutive, consecutiveAt, err = consecutiveShadowLosses(ctx, tx, instance.ID, policy.MaxConsecutiveLosses)
	}
	if err != nil {
		return autonomousrisk.Decision{}, err
	}
	equity, ok := addMany(starting, realized, unrealized)
	if !ok {
		return autonomousrisk.Decision{}, errors.New("autonomous equity is invalid")
	}
	equity, ok = subtractDecimal(equity, fees)
	if !ok {
		return autonomousrisk.Decision{}, errors.New("autonomous fees are invalid")
	}
	snapshot := autonomousrisk.Snapshot{Equity: equity, DailyLoss: dailyLoss, WeeklyLoss: weeklyLoss, DrawdownPct: drawdown,
		ProjectedTotalExposure: projectedTotal, ProjectedSymbolExposure: projectedSymbol, ProjectedPositionSize: projectedPosition,
		OpenPositions: openPositions, ConsecutiveLosses: consecutive, ConsecutiveLossAt: consecutiveAt, Now: now}
	if lastFill.Valid {
		snapshot.LastFillAt = &lastFill.Time
	}
	result := autonomousrisk.Evaluate(policy, intent, snapshot)
	if err := recordAutonomousRiskDecision(ctx, tx, instance, result, now); err != nil {
		return autonomousrisk.Decision{}, err
	}
	_ = lastMark
	return result, nil
}

func maxIntValue(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func coreUniverseAllowsExposure(riskReducing, configured, enabled bool) bool {
	return riskReducing || (configured && enabled)
}

func autonomousPolicyForMode(policy autonomousrisk.Policy, mode string, paperConfigured int) autonomousrisk.Policy {
	if mode == "PAPER" {
		// PAPER has an independent persisted profile. The shared account limit
		// remains the Futures Testnet/LIVE limit and is never widened here.
		policy.MaxConcurrentPositions = paperConfigured
		if policy.MaxConcurrentPositions < 1 {
			policy.MaxConcurrentPositions = 1
		}
		if policy.MaxConcurrentPositions > paperTrainingMaxConcurrentPositions {
			policy.MaxConcurrentPositions = paperTrainingMaxConcurrentPositions
		}
		return policy
	}
	// A shared account profile must not raise TESTNET/LIVE autonomous
	// concurrency when PAPER is configured aggressively.
	if policy.MaxConcurrentPositions > testnetLiveMaxConcurrentPositions {
		policy.MaxConcurrentPositions = testnetLiveMaxConcurrentPositions
	}
	return policy
}

func paperTrainingExposurePolicy(policy autonomousrisk.Policy) autonomousrisk.Policy {
	perPosition, ok := decimalRat(policy.MaxPositionSize)
	if !ok || perPosition.Sign() <= 0 || policy.MaxConcurrentPositions < 1 {
		return policy
	}
	trainingCapacity := new(big.Rat).Mul(perPosition, big.NewRat(int64(policy.MaxConcurrentPositions), 1))
	capacityText := ratText(trainingCapacity)
	if current, valid := decimalRat(policy.MaxTotalExposure); !valid || current.Cmp(trainingCapacity) < 0 {
		policy.MaxTotalExposure = capacityText
	}
	if current, valid := decimalRat(policy.MaxSymbolExposure); !valid || current.Cmp(trainingCapacity) < 0 {
		policy.MaxSymbolExposure = capacityText
	}
	return policy
}

func consecutiveShadowLosses(ctx context.Context, tx *sql.Tx, botID string, limit int) (int, *time.Time, error) {
	rows, err := tx.QueryContext(ctx, `SELECT CAST(realizedPnl - fee AS CHAR), occurredAt FROM shadow_trades
WHERE tradingBotId = ? AND action = 'WOULD_CLOSE' AND realizedPnl - fee <> 0 ORDER BY occurredAt DESC, id DESC LIMIT ?`, botID, limit)
	if err != nil {
		return 0, nil, fmt.Errorf("load consecutive autonomous shadow losses: %w", err)
	}
	defer rows.Close()
	count := 0
	var latest *time.Time
	for rows.Next() {
		var value string
		var occurredAt time.Time
		if err := rows.Scan(&value, &occurredAt); err != nil {
			return 0, nil, err
		}
		number, ok := decimalRat(value)
		if !ok {
			return 0, nil, errors.New("invalid autonomous shadow loss")
		}
		if number.Sign() >= 0 {
			break
		}
		if latest == nil {
			value := occurredAt
			latest = &value
		}
		count++
	}
	return count, latest, rows.Err()
}

func consecutivePaperLosses(ctx context.Context, tx *sql.Tx, botID string, limit int) (int, *time.Time, error) {
	rows, err := tx.QueryContext(ctx, `SELECT CAST(realizedPnl AS CHAR), occurredAt FROM trading_bot_paper_fills WHERE tradingBotId = ? AND realizedPnl <> 0 ORDER BY occurredAt DESC, id DESC LIMIT ?`, botID, limit)
	if err != nil {
		return 0, nil, fmt.Errorf("load consecutive autonomous losses: %w", err)
	}
	defer rows.Close()
	count := 0
	var latest *time.Time
	for rows.Next() {
		var value string
		var occurredAt time.Time
		if err := rows.Scan(&value, &occurredAt); err != nil {
			return 0, nil, err
		}
		number, ok := decimalRat(value)
		if !ok {
			return 0, nil, errors.New("invalid autonomous loss")
		}
		if number.Sign() >= 0 {
			break
		}
		if latest == nil {
			value := occurredAt
			latest = &value
		}
		count++
	}
	return count, latest, rows.Err()
}

func recordAutonomousRiskDecision(ctx context.Context, tx *sql.Tx, instance bot.Instance, decision autonomousrisk.Decision, now time.Time) error {
	metadata, err := json.Marshal(map[string]any{"status": decision.Status, "code": decision.Code, "message": decision.Message, "metrics": decision.Metrics, "mode": instance.Mode, "immutable": true, "submittedToExchange": false})
	if err != nil {
		return err
	}
	action := "AUTONOMOUS_RISK_REJECTED"
	if decision.Approved {
		action = "AUTONOMOUS_RISK_APPROVED"
	} else if decision.Status == "SYSTEM_BLOCKED" {
		action = "AUTONOMOUS_RISK_BLOCKED"
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO trading_audit_logs (id, userId, exchangeAccountId, action, entityType, entityId, metadata, createdAt)
VALUES (UUID(), ?, ?, ?, 'TRADING_BOT', ?, ?, ?)`, instance.UserID, instance.ExchangeAccountID, action, instance.ID, metadata, now)
	return err
}

func textValue(value any) string { result, _ := value.(string); return strings.TrimSpace(result) }
func intValue(value any) int {
	switch number := value.(type) {
	case int:
		return number
	case float64:
		return int(number)
	default:
		return 0
	}
}
func boolValue(value any) bool { result, _ := value.(bool); return result }
func numericBotConfiguration(value any) (float64, bool) {
	switch number := value.(type) {
	case int:
		return float64(number), true
	case float64:
		return number, true
	default:
		return 0, false
	}
}
func decimalRat(value string) (*big.Rat, bool) {
	return new(big.Rat).SetString(strings.TrimSpace(value))
}
func ratText(value *big.Rat) string {
	return strings.TrimRight(strings.TrimRight(value.FloatString(18), "0"), ".")
}
func absRat(value *big.Rat) *big.Rat { return new(big.Rat).Abs(value) }
func addDecimal(left, right string) (string, bool) {
	l, lok := decimalRat(left)
	r, rok := decimalRat(right)
	if !lok || !rok {
		return "", false
	}
	return ratText(new(big.Rat).Add(l, r)), true
}
func subtractDecimal(left, right string) (string, bool) {
	l, lok := decimalRat(left)
	r, rok := decimalRat(right)
	if !lok || !rok {
		return "", false
	}
	return ratText(new(big.Rat).Sub(l, r)), true
}
func addMany(values ...string) (string, bool) {
	total := new(big.Rat)
	for _, value := range values {
		parsed, ok := decimalRat(value)
		if !ok {
			return "", false
		}
		total.Add(total, parsed)
	}
	return ratText(total), true
}
