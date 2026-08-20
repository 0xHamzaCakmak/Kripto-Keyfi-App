package mysqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/arena"
)

func (s *AccountStore) LoadActivePaperBots(ctx context.Context) ([]arena.Bot, error) {
	rows, err := s.database.QueryContext(ctx, `SELECT id, strategyVersionId, symbol, symbols, timeframe,
CAST(startingPaperBalance AS CHAR), configuration
FROM trading_bots
WHERE type = 'AUTONOMOUS' AND mode = 'PAPER' AND lifecycleStatus IN ('TESTING', 'PAPER')
  AND strategyVersionId IS NOT NULL AND timeframe IS NOT NULL
ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("load arena paper bots: %w", err)
	}
	defer rows.Close()
	bots := make([]arena.Bot, 0)
	for rows.Next() {
		var bot arena.Bot
		var symbolsJSON sql.NullString
		var parametersJSON []byte
		if err := rows.Scan(
			&bot.ID, &bot.StrategyVersionID, &bot.Symbol, &symbolsJSON, &bot.Timeframe,
			&bot.StartingBalance, &parametersJSON,
		); err != nil {
			return nil, fmt.Errorf("scan arena paper bot: %w", err)
		}
		if symbolsJSON.Valid {
			if err := json.Unmarshal([]byte(symbolsJSON.String), &bot.Symbols); err != nil {
				return nil, fmt.Errorf("decode arena bot symbols: %w", err)
			}
		}
		if len(bot.Symbols) == 0 {
			bot.Symbols = []string{bot.Symbol}
		}
		if err := json.Unmarshal(parametersJSON, &bot.Parameters); err != nil {
			return nil, fmt.Errorf("decode arena bot parameters: %w", err)
		}
		bots = append(bots, bot)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate arena paper bots: %w", err)
	}
	return bots, nil
}

func (s *AccountStore) RecordArenaBotError(ctx context.Context, botID, message string, occurredAt time.Time) error {
	_, err := s.database.ExecContext(ctx, `UPDATE trading_bots
SET lastErrorCode = 'ARENA_CYCLE_ERROR', lastErrorMessage = LEFT(?, 500), updatedAt = UTC_TIMESTAMP(3)
WHERE id = ? AND type = 'AUTONOMOUS'`, message, botID)
	if err != nil {
		return fmt.Errorf("record arena bot error: %w", err)
	}
	return nil
}

var _ arena.BotStore = (*AccountStore)(nil)
