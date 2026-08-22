package mysqlstore

import (
	"errors"
	"testing"

	drivermysql "github.com/go-sql-driver/mysql"
)

func TestRetryableMySQLTransactionErrors(t *testing.T) {
	for _, number := range []uint16{1205, 1213} {
		if !isRetryableMySQLTransactionError(&drivermysql.MySQLError{Number: number}) {
			t.Fatalf("mysql error %d must be retryable", number)
		}
	}
	if isRetryableMySQLTransactionError(&drivermysql.MySQLError{Number: 1062}) || isRetryableMySQLTransactionError(errors.New("other")) {
		t.Fatal("non-transaction errors must not be retried")
	}
}
