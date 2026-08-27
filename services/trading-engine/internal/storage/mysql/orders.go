package mysqlstore

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/domain"
	"github.com/kriptokeyfi/kripto-keyfi/services/trading-engine/internal/execution"
)

func (s *AccountStore) Claim(ctx context.Context, userID, accountID, orderID, idempotencyKey, clientOrderID string, attemptedAt time.Time) (execution.StoredOrder, execution.ClaimResult, error) {
	transaction, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return execution.StoredOrder{}, "", fmt.Errorf("begin order claim: %w", err)
	}
	defer func() { _ = transaction.Rollback() }()
	const query = `SELECT id, userId, exchangeAccountId, idempotencyKey, clientOrderId,
COALESCE(exchangeOrderId, ''), symbol, side, type, CAST(quantity AS CHAR),
COALESCE(CAST(price AS CHAR), ''), COALESCE(CAST(stopPrice AS CHAR), ''), leverage, COALESCE(positionSide, ''),
marginMode, reduceOnly, source, status, executionAttemptedAt, executionEngine
FROM trading_orders WHERE id = ? AND userId = ? AND exchangeAccountId = ? FOR UPDATE`
	var order execution.StoredOrder
	var attempted sql.NullTime
	var engine string
	err = transaction.QueryRowContext(ctx, query, orderID, userID, accountID).Scan(
		&order.ID, &order.UserID, &order.ExchangeAccountID, &order.IdempotencyKey, &order.ClientOrderID,
		&order.ExchangeOrderID, &order.Symbol, &order.Side, &order.Type, &order.Quantity,
		&order.Price, &order.StopPrice, &order.Leverage, &order.PositionSide, &order.MarginMode, &order.ReduceOnly, &order.Source,
		&order.Status, &attempted, &engine,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return execution.StoredOrder{}, "", errors.New("trading order not found")
	}
	if err != nil {
		return execution.StoredOrder{}, "", fmt.Errorf("read order claim: %w", err)
	}
	if engine != "GO" || order.IdempotencyKey != idempotencyKey || order.ClientOrderID != clientOrderID {
		return execution.StoredOrder{}, "", errors.New("order executor or command identity mismatch")
	}
	if order.ExchangeOrderID != "" && (order.Status == domain.OrderOpen || order.Status == domain.OrderFilled || order.Status == domain.OrderPartiallyFilled) {
		if err := transaction.Commit(); err != nil {
			return execution.StoredOrder{}, "", err
		}
		return order, execution.ClaimCompletedReplay, nil
	}
	if attempted.Valid {
		_, err = transaction.ExecContext(ctx, `UPDATE trading_orders SET status = 'RECONCILIATION_REQUIRED', failureCode = 'RECONCILIATION_REQUIRED', failureMessage = 'Execution attempt already exists; exchange reconciliation is required.' WHERE id = ?`, order.ID)
		if err != nil {
			return execution.StoredOrder{}, "", err
		}
		if err := transaction.Commit(); err != nil {
			return execution.StoredOrder{}, "", err
		}
		order.Status = domain.OrderReconciliationRequired
		return order, execution.ClaimReconciliationRequired, nil
	}
	if order.Status != domain.OrderSubmitting {
		return execution.StoredOrder{}, "", fmt.Errorf("order cannot be claimed from status %s", order.Status)
	}
	result, err := transaction.ExecContext(ctx, `UPDATE trading_orders SET executionAttemptedAt = ? WHERE id = ? AND executionAttemptedAt IS NULL`, attemptedAt.UTC(), order.ID)
	if err != nil {
		return execution.StoredOrder{}, "", err
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		return execution.StoredOrder{}, "", errors.New("order execution claim was not acquired")
	}
	if err := transaction.Commit(); err != nil {
		return execution.StoredOrder{}, "", err
	}
	return order, execution.ClaimAcquired, nil
}

func (s *AccountStore) Complete(ctx context.Context, stored execution.StoredOrder, result domain.Order, completedAt time.Time) error {
	status := result.Status
	if status != domain.OrderFilled && status != domain.OrderPartiallyFilled {
		status = domain.OrderOpen
	}
	update, err := s.database.ExecContext(ctx, `UPDATE trading_orders SET exchangeOrderId = ?, status = ?, submittedAt = ?, failureCode = NULL, failureMessage = NULL WHERE id = ? AND executionEngine = 'GO'`, result.ExchangeOrderID, status, completedAt.UTC(), stored.ID)
	if err != nil {
		return fmt.Errorf("complete trading order: %w", err)
	}
	affected, err := update.RowsAffected()
	if err != nil || affected != 1 {
		return errors.New("completed trading order was not persisted")
	}
	return nil
}

func (s *AccountStore) Fail(ctx context.Context, stored execution.StoredOrder, failure domain.ExchangeError, failedAt time.Time) error {
	status := domain.OrderFailed
	if failure.Reconciliation {
		status = domain.OrderReconciliationRequired
	}
	_, err := s.database.ExecContext(ctx, `UPDATE trading_orders SET status = ?, failureCode = ?, failureMessage = ?, updatedAt = ? WHERE id = ? AND executionEngine = 'GO'`, status, failure.Code, failure.Message, failedAt.UTC(), stored.ID)
	if err != nil {
		return fmt.Errorf("fail trading order: %w", err)
	}
	return nil
}

var _ execution.OrderStore = (*AccountStore)(nil)

func (s *AccountStore) ClaimCancel(ctx context.Context, userID, accountID, exchangeOrderID, idempotencyKey, clientOrderID string, attemptedAt time.Time) (execution.StoredOrder, execution.ClaimResult, error) {
	transaction, err := s.database.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return execution.StoredOrder{}, "", err
	}
	defer func() { _ = transaction.Rollback() }()
	const query = `SELECT id, userId, exchangeAccountId, idempotencyKey, clientOrderId,
COALESCE(exchangeOrderId, ''), symbol, side, type, CAST(quantity AS CHAR),
COALESCE(CAST(price AS CHAR), ''), COALESCE(CAST(stopPrice AS CHAR), ''), leverage, COALESCE(positionSide, ''),
marginMode, reduceOnly, source, status, cancelIdempotencyKey, cancelClientOrderId, cancelAttemptedAt
FROM trading_orders WHERE userId = ? AND exchangeAccountId = ? AND exchangeOrderId = ? FOR UPDATE`
	var order execution.StoredOrder
	var storedIdempotency, storedClient sql.NullString
	var attempted sql.NullTime
	err = transaction.QueryRowContext(ctx, query, userID, accountID, exchangeOrderID).Scan(
		&order.ID, &order.UserID, &order.ExchangeAccountID, &order.IdempotencyKey, &order.ClientOrderID,
		&order.ExchangeOrderID, &order.Symbol, &order.Side, &order.Type, &order.Quantity, &order.Price,
		&order.StopPrice, &order.Leverage, &order.PositionSide, &order.MarginMode, &order.ReduceOnly, &order.Source, &order.Status,
		&storedIdempotency, &storedClient, &attempted,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return execution.StoredOrder{}, "", errors.New("local trading order not found for cancellation")
	}
	if err != nil {
		return execution.StoredOrder{}, "", err
	}
	if order.Status == domain.OrderCanceled {
		if err := transaction.Commit(); err != nil {
			return execution.StoredOrder{}, "", err
		}
		return order, execution.ClaimCompletedReplay, nil
	}
	if storedIdempotency.Valid && (storedIdempotency.String != idempotencyKey || storedClient.String != clientOrderID) {
		return execution.StoredOrder{}, "", errors.New("different cancellation command already owns this order")
	}
	if attempted.Valid {
		_, err = transaction.ExecContext(ctx, `UPDATE trading_orders SET status = 'RECONCILIATION_REQUIRED', failureCode = 'RECONCILIATION_REQUIRED', failureMessage = 'Cancellation attempt already exists; exchange reconciliation is required.' WHERE id = ?`, order.ID)
		if err != nil {
			return execution.StoredOrder{}, "", err
		}
		if err := transaction.Commit(); err != nil {
			return execution.StoredOrder{}, "", err
		}
		return order, execution.ClaimReconciliationRequired, nil
	}
	if order.Status != domain.OrderOpen && order.Status != domain.OrderPartiallyFilled {
		return execution.StoredOrder{}, "", fmt.Errorf("order cannot be canceled from status %s", order.Status)
	}
	_, err = transaction.ExecContext(ctx, `UPDATE trading_orders SET status = 'CANCELING', cancelIdempotencyKey = ?, cancelClientOrderId = ?, cancelAttemptedAt = ? WHERE id = ?`, idempotencyKey, clientOrderID, attemptedAt.UTC(), order.ID)
	if err != nil {
		return execution.StoredOrder{}, "", err
	}
	if err := transaction.Commit(); err != nil {
		return execution.StoredOrder{}, "", err
	}
	order.Status = domain.OrderCanceling
	return order, execution.ClaimAcquired, nil
}

func (s *AccountStore) CompleteCancel(ctx context.Context, order execution.StoredOrder, completedAt time.Time) error {
	_, err := s.database.ExecContext(ctx, `UPDATE trading_orders SET status = 'CANCELED', failureCode = NULL, failureMessage = NULL, updatedAt = ? WHERE id = ?`, completedAt.UTC(), order.ID)
	return err
}

func (s *AccountStore) FailCancel(ctx context.Context, order execution.StoredOrder, failure domain.ExchangeError, failedAt time.Time) error {
	status := domain.OrderOpen
	if failure.Reconciliation {
		status = domain.OrderReconciliationRequired
	}
	_, err := s.database.ExecContext(ctx, `UPDATE trading_orders SET status = ?, failureCode = ?, failureMessage = ?, updatedAt = ? WHERE id = ?`, status, failure.Code, failure.Message, failedAt.UTC(), order.ID)
	return err
}
