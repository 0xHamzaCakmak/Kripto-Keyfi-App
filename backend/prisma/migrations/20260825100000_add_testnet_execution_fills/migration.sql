CREATE TABLE `testnet_execution_fills` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `tradingBotId` VARCHAR(191) NOT NULL,
  `strategyVersionId` VARCHAR(191) NULL,
  `tradeId` VARCHAR(100) NOT NULL,
  `exchangeOrderId` VARCHAR(100) NOT NULL,
  `clientOrderId` VARCHAR(36) NOT NULL,
  `symbol` VARCHAR(40) NOT NULL,
  `side` ENUM('BUY', 'SELL') NOT NULL,
  `orderType` ENUM('MARKET', 'LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET') NOT NULL,
  `reduceOnly` BOOLEAN NOT NULL DEFAULT false,
  `price` DECIMAL(36,18) NOT NULL,
  `quantity` DECIMAL(36,18) NOT NULL,
  `quoteQuantity` DECIMAL(36,18) NOT NULL,
  `realizedPnl` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `commission` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `commissionAsset` VARCHAR(20) NOT NULL,
  `netRealizedPnl` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `maker` BOOLEAN NOT NULL DEFAULT false,
  `occurredAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `testnet_execution_fills_exchangeAccountId_symbol_tradeId_key` (`exchangeAccountId`, `symbol`, `tradeId`),
  INDEX `testnet_execution_fills_tradingBotId_occurredAt_idx` (`tradingBotId`, `occurredAt`),
  INDEX `testnet_execution_fills_strategyVersionId_occurredAt_idx` (`strategyVersionId`, `occurredAt`),
  INDEX `testnet_execution_fills_userId_occurredAt_idx` (`userId`, `occurredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `testnet_execution_fills` ADD CONSTRAINT `testnet_execution_fills_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `testnet_execution_fills` ADD CONSTRAINT `testnet_execution_fills_exchangeAccountId_fkey` FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `testnet_execution_fills` ADD CONSTRAINT `testnet_execution_fills_tradingBotId_fkey` FOREIGN KEY (`tradingBotId`) REFERENCES `trading_bots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `testnet_execution_fills` ADD CONSTRAINT `testnet_execution_fills_strategyVersionId_fkey` FOREIGN KEY (`strategyVersionId`) REFERENCES `trading_strategy_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
