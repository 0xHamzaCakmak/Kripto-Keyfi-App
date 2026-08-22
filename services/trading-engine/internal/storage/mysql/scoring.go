package mysqlstore

import (
	"context"
	"errors"
	"fmt"
	"time"
)

func (s *AccountStore) SaveBotScore(ctx context.Context, botID string, snapshotAt time.Time, score float64, breakdown []byte) error {
	result, err := s.database.ExecContext(ctx, `UPDATE bot_metrics
SET score = ?, metrics = JSON_SET(COALESCE(metrics, JSON_OBJECT()), '$.scoreBreakdown', CAST(? AS JSON))
WHERE id = (SELECT id FROM (SELECT id FROM bot_metrics WHERE tradingBotId = ? ORDER BY snapshotAt DESC, id DESC LIMIT 1) latest_metric)`, score, breakdown, botID)
	if err != nil {
		return fmt.Errorf("save risk-adjusted bot score: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read bot score update result: %w", err)
	}
	if affected != 1 {
		return errors.New("bot metric snapshot was not found or is ambiguous")
	}
	return nil
}
