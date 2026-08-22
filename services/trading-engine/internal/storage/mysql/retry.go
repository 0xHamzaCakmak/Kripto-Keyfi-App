package mysqlstore

import (
	"context"
	"errors"
	"time"

	drivermysql "github.com/go-sql-driver/mysql"
)

const mysqlTransactionAttempts = 3

func isRetryableMySQLTransactionError(err error) bool {
	var databaseError *drivermysql.MySQLError
	return errors.As(err, &databaseError) && (databaseError.Number == 1213 || databaseError.Number == 1205)
}

func waitMySQLTransactionRetry(ctx context.Context, attempt int) error {
	timer := time.NewTimer(time.Duration(attempt) * 20 * time.Millisecond)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
