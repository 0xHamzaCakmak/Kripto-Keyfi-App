-- Phase 4: durable, idempotent exchange events consumed by the Node SSE gateway.
CREATE TABLE `trading_outbox_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `provider` ENUM('BINANCE', 'BYBIT') NOT NULL,
  `topic` VARCHAR(80) NOT NULL,
  `eventType` VARCHAR(80) NOT NULL,
  `aggregateType` VARCHAR(50) NULL,
  `aggregateId` VARCHAR(120) NULL,
  `deduplicationKey` VARCHAR(191) NOT NULL,
  `payload` JSON NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `publishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `trading_outbox_events_deduplicationKey_key` (`deduplicationKey`),
  INDEX `trading_outbox_events_userId_id_idx` (`userId`, `id`),
  INDEX `trading_outbox_events_exchangeAccountId_id_idx` (`exchangeAccountId`, `id`),
  INDEX `trading_outbox_events_publishedAt_id_idx` (`publishedAt`, `id`),
  CONSTRAINT `trading_outbox_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `trading_outbox_events_exchangeAccountId_fkey` FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
