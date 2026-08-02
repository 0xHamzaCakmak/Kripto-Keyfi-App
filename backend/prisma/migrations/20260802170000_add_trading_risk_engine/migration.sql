ALTER TABLE `trading_orders`
  ADD COLUMN `source` ENUM('MANUAL', 'SCALPING_BOT', 'GRID_BOT', 'SYSTEM', 'RISK_ENGINE') NOT NULL DEFAULT 'MANUAL' AFTER `reduceOnly`;

CREATE TABLE `trading_risk_profiles` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `accountKillSwitch` BOOLEAN NOT NULL DEFAULT FALSE,
  `killSwitchReason` VARCHAR(500) NULL,
  `maxOrderNotional` DECIMAL(36,18) NOT NULL DEFAULT 100,
  `maxInitialMargin` DECIMAL(36,18) NOT NULL DEFAULT 50,
  `maxAccountOpenNotional` DECIMAL(36,18) NOT NULL DEFAULT 500,
  `maxOpenPositions` INTEGER NOT NULL DEFAULT 5,
  `maxSymbolPositions` INTEGER NOT NULL DEFAULT 1,
  `maxLeverage` INTEGER NOT NULL DEFAULT 5,
  `minAvailableBalance` DECIMAL(36,18) NOT NULL DEFAULT 20,
  `maxOrdersPerMinute` INTEGER NOT NULL DEFAULT 10,
  `maxDailyOrders` INTEGER NOT NULL DEFAULT 100,
  `maxDailyLoss` DECIMAL(36,18) NULL,
  `allowedSymbols` JSON NULL,
  `blockedSymbols` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `trading_risk_profiles_exchangeAccountId_key` (`exchangeAccountId`),
  INDEX `trading_risk_profiles_userId_idx` (`userId`),
  INDEX `trading_risk_profiles_enabled_accountKillSwitch_idx` (`enabled`, `accountKillSwitch`),
  PRIMARY KEY (`id`),
  CONSTRAINT `trading_risk_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `trading_risk_profiles_exchangeAccountId_fkey` FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `trading_risk_controls` (
  `id` VARCHAR(40) NOT NULL DEFAULT 'global',
  `globalKillSwitch` BOOLEAN NOT NULL DEFAULT FALSE,
  `reason` VARCHAR(500) NULL,
  `activatedBy` VARCHAR(100) NULL,
  `activatedAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `trading_risk_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `tradingOrderId` VARCHAR(191) NULL,
  `source` ENUM('MANUAL', 'SCALPING_BOT', 'GRID_BOT', 'SYSTEM', 'RISK_ENGINE') NOT NULL,
  `decision` ENUM('APPROVED', 'REJECTED', 'RISK_BLOCKED', 'SYSTEM_BLOCKED') NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `metrics` JSON NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `trading_risk_events_userId_occurredAt_idx` (`userId`, `occurredAt`),
  INDEX `trading_risk_events_exchangeAccountId_occurredAt_idx` (`exchangeAccountId`, `occurredAt`),
  INDEX `trading_risk_events_tradingOrderId_idx` (`tradingOrderId`),
  INDEX `trading_risk_events_decision_occurredAt_idx` (`decision`, `occurredAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `trading_risk_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `trading_risk_events_exchangeAccountId_fkey` FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `trading_risk_events_tradingOrderId_fkey` FOREIGN KEY (`tradingOrderId`) REFERENCES `trading_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `trading_risk_controls` (`id`, `globalKillSwitch`, `updatedAt`)
VALUES ('global', FALSE, UTC_TIMESTAMP(3));

INSERT INTO `trading_risk_profiles` (`id`, `userId`, `exchangeAccountId`, `createdAt`, `updatedAt`)
SELECT CONCAT('risk_', `id`), `userId`, `id`, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
FROM `exchange_accounts`;
