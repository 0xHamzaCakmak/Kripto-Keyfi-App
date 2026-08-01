ALTER TABLE `exchange_accounts`
  ADD COLUMN `executionEngine` ENUM('TYPESCRIPT', 'GO') NOT NULL DEFAULT 'TYPESCRIPT';

ALTER TABLE `trading_orders`
  MODIFY COLUMN `status` ENUM(
    'PENDING', 'SUBMITTING', 'OPEN', 'PARTIALLY_FILLED', 'FILLED',
    'CANCELING', 'CANCELED', 'CLOSING', 'FAILED', 'RECONCILIATION_REQUIRED'
  ) NOT NULL DEFAULT 'SUBMITTING',
  ADD COLUMN `executionEngine` ENUM('TYPESCRIPT', 'GO') NOT NULL DEFAULT 'TYPESCRIPT',
  ADD COLUMN `executionAttemptedAt` DATETIME(3) NULL,
  ADD COLUMN `cancelIdempotencyKey` VARCHAR(80) NULL,
  ADD COLUMN `cancelClientOrderId` VARCHAR(36) NULL,
  ADD COLUMN `cancelAttemptedAt` DATETIME(3) NULL;

CREATE INDEX `trading_orders_executionEngine_status_idx`
  ON `trading_orders`(`executionEngine`, `status`);

CREATE UNIQUE INDEX `trading_orders_userId_cancelIdempotencyKey_key`
  ON `trading_orders`(`userId`, `cancelIdempotencyKey`);
