package mysqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/risk"
)

func (s *AccountStore) LoadProfile(ctx context.Context, userID, accountID string) (risk.Profile, error) {
	const query = `SELECT p.enabled, c.globalKillSwitch, p.accountKillSwitch,
CAST(p.maxOrderNotional AS CHAR), CAST(p.maxInitialMargin AS CHAR), CAST(p.maxAccountOpenNotional AS CHAR),
p.maxOpenPositions, p.maxSymbolPositions, p.minLeverage, p.maxLeverage, CAST(p.minAvailableBalance AS CHAR),
p.maxOrdersPerMinute, p.maxDailyOrders, p.allowedSymbols, p.blockedSymbols
FROM trading_risk_profiles p
JOIN trading_risk_controls c ON c.id = 'global'
WHERE p.userId = ? AND p.exchangeAccountId = ? LIMIT 1`
	var profile risk.Profile
	var allowed, blocked []byte
	err := s.database.QueryRowContext(ctx, query, userID, accountID).Scan(
		&profile.Enabled, &profile.GlobalKillSwitch, &profile.AccountKillSwitch,
		&profile.MaxOrderNotional, &profile.MaxInitialMargin, &profile.MaxAccountOpenNotional,
		&profile.MaxOpenPositions, &profile.MaxSymbolPositions, &profile.MinLeverage, &profile.MaxLeverage, &profile.MinAvailableBalance,
		&profile.MaxOrdersPerMinute, &profile.MaxDailyOrders, &allowed, &blocked,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return risk.Profile{}, errors.New("trading risk profile is missing")
	}
	if err != nil {
		return risk.Profile{}, fmt.Errorf("load trading risk profile: %w", err)
	}
	if len(allowed) > 0 {
		if err := json.Unmarshal(allowed, &profile.AllowedSymbols); err != nil {
			return risk.Profile{}, errors.New("invalid allowed symbols risk policy")
		}
	}
	if len(blocked) > 0 {
		if err := json.Unmarshal(blocked, &profile.BlockedSymbols); err != nil {
			return risk.Profile{}, errors.New("invalid blocked symbols risk policy")
		}
	}
	return profile, nil
}

func (s *AccountStore) LoadUsage(ctx context.Context, accountID string, now time.Time) (risk.Usage, error) {
	utc := now.UTC()
	dayStart := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
	var usage risk.Usage
	err := s.database.QueryRowContext(ctx, `SELECT
COALESCE(SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END), 0), COUNT(*)
FROM trading_orders WHERE exchangeAccountId = ? AND createdAt >= ?`, utc.Add(-time.Minute), accountID, dayStart).Scan(&usage.OrdersLastMinute, &usage.OrdersToday)
	if err != nil {
		return risk.Usage{}, fmt.Errorf("load trading order usage: %w", err)
	}
	return usage, nil
}

func (s *AccountStore) RecordDecision(ctx context.Context, resolved account.Resolved, order risk.OrderInput, decision risk.Decision, occurredAt time.Time) error {
	metrics, err := json.Marshal(decision.Metrics)
	if err != nil {
		return fmt.Errorf("marshal risk metrics: %w", err)
	}
	source := strings.ToUpper(strings.TrimSpace(order.Source))
	switch source {
	case "MANUAL", "SCALPING_BOT", "GRID_BOT", "SYSTEM", "RISK_ENGINE":
	default:
		source = "MANUAL"
	}
	status := decision.Status
	switch status {
	case "APPROVED", "REJECTED", "RISK_BLOCKED", "SYSTEM_BLOCKED":
	default:
		return errors.New("invalid risk decision")
	}
	transaction, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return err
	}
	defer func() { _ = transaction.Rollback() }()
	_, err = transaction.ExecContext(ctx, `INSERT INTO trading_risk_events
(userId, exchangeAccountId, tradingOrderId, source, decision, code, message, metrics, occurredAt, createdAt)
VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`, order.UserID, order.ExchangeAccountID,
		order.ID, source, status, decision.Code, decision.Message, metrics, occurredAt.UTC())
	if err != nil {
		return fmt.Errorf("insert trading risk event: %w", err)
	}
	payload, err := json.Marshal(map[string]any{
		"localOrderId": order.ID, "symbol": order.Symbol, "source": source,
		"decision": status, "code": decision.Code, "message": decision.Message, "metrics": decision.Metrics,
	})
	if err != nil {
		return err
	}
	_, err = transaction.ExecContext(ctx, `INSERT INTO trading_outbox_events
(userId, exchangeAccountId, provider, topic, eventType, aggregateType, aggregateId, deduplicationKey, payload, occurredAt, createdAt)
VALUES (?, ?, ?, 'trading.risk', ?, 'ORDER', NULLIF(?, ''), ?, ?, ?, UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE deduplicationKey = VALUES(deduplicationKey)`, resolved.Reference.UserID, resolved.Reference.ID,
		resolved.Reference.Provider, "RISK_"+status, order.ID, fmt.Sprintf("%s:risk:%s:%s", order.ID, status, decision.Code), payload, occurredAt.UTC())
	if err != nil {
		return fmt.Errorf("insert trading risk outbox event: %w", err)
	}
	return transaction.Commit()
}

var _ risk.Store = (*AccountStore)(nil)
