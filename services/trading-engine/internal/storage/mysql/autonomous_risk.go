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
)

func evaluateAutonomousPaperRisk(ctx context.Context, tx *sql.Tx, instance bot.Instance, decision bot.Decision, now time.Time) (autonomousrisk.Decision, error) {
	order := decision.HypotheticalOrder
	intent := autonomousrisk.Intent{Mode: instance.Mode, Side: textValue(order["side"]), MarginMode: textValue(order["marginMode"]), EntryPrice: decision.MarkPrice,
		StopLoss: textValue(order["stopLoss"]), TakeProfit: textValue(order["takeProfit"]), Quantity: textValue(order["quantity"]), Leverage: intValue(order["leverage"])}
	var policy autonomousrisk.Policy
	var starting, netQuantity, realized, unrealized, fees, lastMark string
	var lastFill sql.NullTime
	err := tx.QueryRowContext(ctx, `SELECT p.enabled, c.globalKillSwitch, p.accountKillSwitch,
CAST(p.maxRiskPerTradePct AS CHAR), CAST(p.maxDailyLossPct AS CHAR), CAST(p.maxWeeklyLossPct AS CHAR), CAST(p.maxDrawdownPct AS CHAR),
p.maxLeverage, p.maxOpenPositions, CAST(p.maxAccountOpenNotional AS CHAR), CAST(p.maxSymbolOpenNotional AS CHAR),
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
		&policy.MaxLeverage, &policy.MaxConcurrentPositions, &policy.MaxTotalExposure, &policy.MaxSymbolExposure,
		&policy.MaxPositionSize, &policy.MinRiskReward, &policy.StopLossRequired, &policy.MarginModePolicy,
		&policy.CooldownSeconds, &policy.MaxConsecutiveLosses, &starting, &netQuantity, &realized, &unrealized, &fees, &lastMark, &lastFill)
	if errors.Is(err, sql.ErrNoRows) {
		return autonomousrisk.Decision{}, errors.New("autonomous risk profile is unavailable")
	}
	if err != nil {
		return autonomousrisk.Decision{}, fmt.Errorf("load autonomous risk profile: %w", err)
	}
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

	quantity, qok := decimalRat(intent.Quantity)
	entry, eok := decimalRat(intent.EntryPrice)
	net, nok := decimalRat(netQuantity)
	if !qok || !eok || !nok {
		return autonomousrisk.Decision{}, errors.New("autonomous intent decimal is invalid")
	}
	intent.RiskReducing = (net.Sign() > 0 && intent.Side == "SELL" && quantity.Cmp(absRat(net)) <= 0) || (net.Sign() < 0 && intent.Side == "BUY" && quantity.Cmp(absRat(net)) <= 0)
	intent.OpensNewPosition = net.Sign() == 0
	orderNotional := new(big.Rat).Mul(quantity, entry)

	var openPositions int
	var totalExposure, symbolExposure string
	exposureQuery := `SELECT COUNT(*),
COALESCE(CAST(SUM(ABS(pos.netQuantity) * pos.lastMarkPrice) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN pos.symbol = ? THEN ABS(pos.netQuantity) * pos.lastMarkPrice ELSE 0 END) AS CHAR), '0')
FROM trading_bot_paper_positions pos JOIN trading_bots b ON b.id = pos.tradingBotId
WHERE b.exchangeAccountId = ? AND pos.netQuantity <> 0`
	if instance.Mode == "SHADOW" {
		exposureQuery = `SELECT COUNT(*),
COALESCE(CAST(SUM(ABS(latest.netQuantity) * latest.markPrice) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN b.symbol = ? THEN ABS(latest.netQuantity) * latest.markPrice ELSE 0 END) AS CHAR), '0')
FROM shadow_trades latest JOIN trading_bots b ON b.id = latest.tradingBotId
WHERE b.exchangeAccountId = ? AND b.mode = 'SHADOW' AND latest.netQuantity <> 0
AND latest.id = (SELECT current.id FROM shadow_trades current WHERE current.tradingBotId = latest.tradingBotId ORDER BY current.id DESC LIMIT 1)`
	}
	if err := tx.QueryRowContext(ctx, exposureQuery, instance.Symbol, instance.ExchangeAccountID).Scan(&openPositions, &totalExposure, &symbolExposure); err != nil {
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
FROM trading_bot_paper_fills f JOIN trading_bots b ON b.id = f.tradingBotId WHERE b.exchangeAccountId = ?`
	if instance.Mode == "SHADOW" {
		lossQuery = `SELECT
COALESCE(CAST(SUM(CASE WHEN f.occurredAt >= ? AND f.realizedPnl < 0 THEN -f.realizedPnl ELSE 0 END) AS CHAR), '0'),
COALESCE(CAST(SUM(CASE WHEN f.occurredAt >= ? AND f.realizedPnl < 0 THEN -f.realizedPnl ELSE 0 END) AS CHAR), '0')
FROM shadow_trades f JOIN trading_bots b ON b.id = f.tradingBotId WHERE b.exchangeAccountId = ? AND b.mode = 'SHADOW'`
	}
	if err := tx.QueryRowContext(ctx, lossQuery, dayStart, weekStart, instance.ExchangeAccountID).Scan(&dailyLoss, &weeklyLoss); err != nil {
		return autonomousrisk.Decision{}, fmt.Errorf("load autonomous losses: %w", err)
	}
	drawdown := "0"
	err = tx.QueryRowContext(ctx, `SELECT CAST(maxDrawdown AS CHAR) FROM bot_metrics WHERE tradingBotId = ? ORDER BY snapshotAt DESC, id DESC LIMIT 1`, instance.ID).Scan(&drawdown)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return autonomousrisk.Decision{}, fmt.Errorf("load autonomous drawdown: %w", err)
	}
	consecutive, err := consecutivePaperLosses(ctx, tx, instance.ID, policy.MaxConsecutiveLosses)
	if instance.Mode == "SHADOW" {
		consecutive, err = consecutiveShadowLosses(ctx, tx, instance.ID, policy.MaxConsecutiveLosses)
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
		OpenPositions: openPositions, ConsecutiveLosses: consecutive, Now: now}
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

func consecutiveShadowLosses(ctx context.Context, tx *sql.Tx, botID string, limit int) (int, error) {
	rows, err := tx.QueryContext(ctx, `SELECT CAST(realizedPnl - fee AS CHAR) FROM shadow_trades
WHERE tradingBotId = ? AND action = 'WOULD_CLOSE' AND realizedPnl - fee <> 0 ORDER BY occurredAt DESC, id DESC LIMIT ?`, botID, limit)
	if err != nil {
		return 0, fmt.Errorf("load consecutive autonomous shadow losses: %w", err)
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return 0, err
		}
		number, ok := decimalRat(value)
		if !ok {
			return 0, errors.New("invalid autonomous shadow loss")
		}
		if number.Sign() >= 0 {
			break
		}
		count++
	}
	return count, rows.Err()
}

func consecutivePaperLosses(ctx context.Context, tx *sql.Tx, botID string, limit int) (int, error) {
	rows, err := tx.QueryContext(ctx, `SELECT CAST(realizedPnl AS CHAR) FROM trading_bot_paper_fills WHERE tradingBotId = ? AND realizedPnl <> 0 ORDER BY occurredAt DESC, id DESC LIMIT ?`, botID, limit)
	if err != nil {
		return 0, fmt.Errorf("load consecutive autonomous losses: %w", err)
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return 0, err
		}
		number, ok := decimalRat(value)
		if !ok {
			return 0, errors.New("invalid autonomous loss")
		}
		if number.Sign() >= 0 {
			break
		}
		count++
	}
	return count, rows.Err()
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
