package mysqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/account"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/exchange"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/reconciliation"
)

func (s *AccountStore) ListReconciliationAccounts(ctx context.Context) ([]account.Resolved, error) {
	const query = `SELECT id, userId, provider, environment, accountType,
apiKeyEncrypted, apiSecretEncrypted, COALESCE(passphraseEncrypted, ''), executionEngine, connectionStatus
FROM exchange_accounts
WHERE isActive = TRUE AND connectionStatus IN ('CONNECTED', 'DEGRADED') AND provider = 'BINANCE'
ORDER BY id`
	rows, err := s.database.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list reconciliation accounts: %w", err)
	}
	defer rows.Close()
	result := make([]account.Resolved, 0)
	for rows.Next() {
		var resolved account.Resolved
		var apiKeyEncrypted, apiSecretEncrypted, passphraseEncrypted string
		if err := rows.Scan(
			&resolved.Reference.ID, &resolved.Reference.UserID, &resolved.Reference.Provider,
			&resolved.Reference.Environment, &resolved.Reference.AccountType,
			&apiKeyEncrypted, &apiSecretEncrypted, &passphraseEncrypted,
			&resolved.Engine, &resolved.ConnectionStatus,
		); err != nil {
			return nil, fmt.Errorf("scan reconciliation account: %w", err)
		}
		apiKey, err := s.vault.Decrypt(apiKeyEncrypted)
		if err != nil {
			return nil, errors.New("decrypt reconciliation credentials: api key authentication failed")
		}
		apiSecret, err := s.vault.Decrypt(apiSecretEncrypted)
		if err != nil {
			return nil, errors.New("decrypt reconciliation credentials: secret authentication failed")
		}
		resolved.Credentials = exchange.Credentials{APIKey: apiKey, APISecret: apiSecret}
		if passphraseEncrypted != "" {
			resolved.Credentials.Passphrase, err = s.vault.Decrypt(passphraseEncrypted)
			if err != nil {
				return nil, errors.New("decrypt reconciliation credentials: passphrase authentication failed")
			}
		}
		result = append(result, resolved)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate reconciliation accounts: %w", err)
	}
	return result, nil
}

func (s *AccountStore) ListReconciliationOrders(ctx context.Context, accountID string) ([]reconciliation.PendingOrder, error) {
	const query = `SELECT id, userId, exchangeAccountId, clientOrderId, symbol, status, executionAttemptedAt
FROM trading_orders
WHERE exchangeAccountId = ? AND executionEngine = 'GO'
AND status IN ('SUBMITTING', 'OPEN', 'PARTIALLY_FILLED', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED')
ORDER BY createdAt`
	rows, err := s.database.QueryContext(ctx, query, accountID)
	if err != nil {
		return nil, fmt.Errorf("list reconciliation orders: %w", err)
	}
	defer rows.Close()
	result := make([]reconciliation.PendingOrder, 0)
	for rows.Next() {
		var item reconciliation.PendingOrder
		var attempted sql.NullTime
		if err := rows.Scan(&item.ID, &item.UserID, &item.ExchangeAccountID, &item.ClientOrderID, &item.Symbol, &item.Status, &attempted); err != nil {
			return nil, fmt.Errorf("scan reconciliation order: %w", err)
		}
		item.ExecutionAttempted = attempted.Valid
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *AccountStore) ApplyReconciledOrder(ctx context.Context, local reconciliation.PendingOrder, remote domain.Order, reconciledAt time.Time) (bool, error) {
	transaction, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return false, err
	}
	defer func() { _ = transaction.Rollback() }()
	var current domain.OrderStatus
	var currentExchangeID string
	err = transaction.QueryRowContext(ctx, `SELECT status, COALESCE(exchangeOrderId, '') FROM trading_orders WHERE id = ? AND executionEngine = 'GO' FOR UPDATE`, local.ID).Scan(&current, &currentExchangeID)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if domain.IsTerminalOrderStatus(current) {
		return false, transaction.Commit()
	}
	if remote.Status == domain.OrderReconciliationRequired || remote.Status == "" {
		return false, errors.New("cannot persist unresolved exchange order state")
	}
	if current == remote.Status && currentExchangeID == remote.ExchangeOrderID {
		return false, transaction.Commit()
	}
	_, err = transaction.ExecContext(ctx, `UPDATE trading_orders SET exchangeOrderId = NULLIF(?, ''), status = ?,
submittedAt = CASE WHEN ? <> '' THEN COALESCE(submittedAt, ?) ELSE submittedAt END,
failureCode = NULL, failureMessage = NULL, updatedAt = ? WHERE id = ? AND executionEngine = 'GO'`,
		remote.ExchangeOrderID, remote.Status, remote.ExchangeOrderID, reconciledAt.UTC(), reconciledAt.UTC(), local.ID)
	if err != nil {
		return false, err
	}
	payload, err := json.Marshal(map[string]any{
		"localOrderId": local.ID, "clientOrderId": local.ClientOrderID, "symbol": local.Symbol,
		"previousStatus": current, "status": remote.Status, "exchangeOrderId": remote.ExchangeOrderID,
		"executedQuantity": remote.ExecutedQuantity,
	})
	if err != nil {
		return false, err
	}
	_, err = transaction.ExecContext(ctx, `INSERT INTO trading_outbox_events
(userId, exchangeAccountId, provider, topic, eventType, aggregateType, aggregateId, deduplicationKey, payload, occurredAt, createdAt)
VALUES (?, ?, 'BINANCE', 'trading.order', 'ORDER_RECONCILED', 'ORDER', ?, ?, ?, ?, UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE deduplicationKey = VALUES(deduplicationKey)`,
		local.UserID, local.ExchangeAccountID, local.ID,
		fmt.Sprintf("%s:reconciled:%s:%s", local.ID, remote.Status, remote.ExecutedQuantity), payload, reconciledAt.UTC())
	if err != nil {
		return false, err
	}
	if err := transaction.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

func (s *AccountStore) MarkAccountDegraded(ctx context.Context, resolved account.Resolved, reason string, occurredAt time.Time) error {
	transaction, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return err
	}
	defer func() { _ = transaction.Rollback() }()
	if _, err = transaction.ExecContext(ctx, `UPDATE exchange_accounts SET connectionStatus = 'DEGRADED', lastSyncAt = ? WHERE id = ? AND executionEngine = 'GO'`, occurredAt.UTC(), resolved.Reference.ID); err != nil {
		return err
	}
	payload, _ := json.Marshal(map[string]any{"status": "DEGRADED", "reason": reason})
	_, err = transaction.ExecContext(ctx, `INSERT INTO trading_outbox_events
(userId, exchangeAccountId, provider, topic, eventType, aggregateType, aggregateId, deduplicationKey, payload, occurredAt, createdAt)
VALUES (?, ?, ?, 'trading.account', 'ACCOUNT_DEGRADED', 'ACCOUNT', ?, ?, ?, ?, UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE deduplicationKey = VALUES(deduplicationKey)`, resolved.Reference.UserID, resolved.Reference.ID,
		resolved.Reference.Provider, resolved.Reference.ID, fmt.Sprintf("%s:degraded:%d", resolved.Reference.ID, occurredAt.Unix()/30), payload, occurredAt.UTC())
	if err != nil {
		return err
	}
	return transaction.Commit()
}

func (s *AccountStore) MarkAccountHealthy(ctx context.Context, resolved account.Resolved, occurredAt time.Time) error {
	_, err := s.database.ExecContext(ctx, `UPDATE exchange_accounts SET
connectionStatus = CASE WHEN connectionStatus = 'DEGRADED' THEN 'CONNECTED' ELSE connectionStatus END,
lastSyncAt = ? WHERE id = ?`, occurredAt.UTC(), resolved.Reference.ID)
	return err
}

var _ reconciliation.Store = (*AccountStore)(nil)
