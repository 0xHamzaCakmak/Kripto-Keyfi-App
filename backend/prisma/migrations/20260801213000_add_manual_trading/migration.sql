-- Phase 3: manual testnet order previews, idempotent submissions and audit trail.
CREATE TABLE `manual_order_previews` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(40) NOT NULL,
  `side` ENUM('BUY', 'SELL') NOT NULL,
  `type` ENUM('MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT') NOT NULL,
  `quantity` DECIMAL(36,18) NOT NULL,
  `price` DECIMAL(36,18) NULL,
  `stopPrice` DECIMAL(36,18) NULL,
  `leverage` INTEGER NOT NULL,
  `marginMode` ENUM('ISOLATED', 'CROSS') NOT NULL,
  `reduceOnly` BOOLEAN NOT NULL DEFAULT false,
  `markPrice` DECIMAL(36,18) NOT NULL,
  `estimatedNotional` DECIMAL(36,18) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `manual_order_previews_userId_expiresAt_idx` (`userId`, `expiresAt`),
  INDEX `manual_order_previews_exchangeAccountId_symbol_idx` (`exchangeAccountId`, `symbol`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `trading_orders` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `previewId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(80) NOT NULL,
  `clientOrderId` VARCHAR(36) NOT NULL,
  `exchangeOrderId` VARCHAR(100) NULL,
  `symbol` VARCHAR(40) NOT NULL,
  `side` ENUM('BUY', 'SELL') NOT NULL,
  `type` ENUM('MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT') NOT NULL,
  `quantity` DECIMAL(36,18) NOT NULL,
  `price` DECIMAL(36,18) NULL,
  `stopPrice` DECIMAL(36,18) NULL,
  `leverage` INTEGER NOT NULL,
  `marginMode` ENUM('ISOLATED', 'CROSS') NOT NULL,
  `reduceOnly` BOOLEAN NOT NULL DEFAULT false,
  `status` ENUM('SUBMITTING', 'OPEN', 'FILLED', 'CANCELED', 'FAILED') NOT NULL DEFAULT 'SUBMITTING',
  `failureCode` VARCHAR(80) NULL,
  `failureMessage` VARCHAR(500) NULL,
  `submittedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `trading_orders_previewId_key` (`previewId`),
  UNIQUE INDEX `trading_orders_clientOrderId_key` (`clientOrderId`),
  UNIQUE INDEX `trading_orders_userId_idempotencyKey_key` (`userId`, `idempotencyKey`),
  INDEX `trading_orders_exchangeAccountId_status_idx` (`exchangeAccountId`, `status`),
  INDEX `trading_orders_userId_createdAt_idx` (`userId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `trading_audit_logs` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NULL,
  `action` VARCHAR(80) NOT NULL,
  `entityType` VARCHAR(50) NOT NULL,
  `entityId` VARCHAR(100) NULL,
  `metadata` JSON NULL,
  `ipAddress` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `trading_audit_logs_userId_createdAt_idx` (`userId`, `createdAt`),
  INDEX `trading_audit_logs_exchangeAccountId_createdAt_idx` (`exchangeAccountId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `manual_order_previews` ADD CONSTRAINT `manual_order_previews_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `manual_order_previews` ADD CONSTRAINT `manual_order_previews_exchangeAccountId_fkey` FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `trading_orders` ADD CONSTRAINT `trading_orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `trading_orders` ADD CONSTRAINT `trading_orders_exchangeAccountId_fkey` FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `trading_orders` ADD CONSTRAINT `trading_orders_previewId_fkey` FOREIGN KEY (`previewId`) REFERENCES `manual_order_previews`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `trading_audit_logs` ADD CONSTRAINT `trading_audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `trading_audit_logs` ADD CONSTRAINT `trading_audit_logs_exchangeAccountId_fkey` FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
