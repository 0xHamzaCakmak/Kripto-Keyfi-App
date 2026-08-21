CREATE TABLE `shadow_trades` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tradingBotId` VARCHAR(191) NOT NULL,
  `decisionId` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(30) NOT NULL,
  `side` ENUM('BUY', 'SELL') NULL,
  `quantity` DECIMAL(36, 18) NULL,
  `markPrice` DECIMAL(36, 18) NOT NULL,
  `simulatedFillPrice` DECIMAL(36, 18) NULL,
  `notional` DECIMAL(36, 18) NULL,
  `fee` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `realizedPnl` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `netQuantity` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `avgEntryPrice` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `cumulativePnl` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `totalFees` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `unrealizedPnl` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `slippageBps` DECIMAL(12, 4) NULL,
  `feeBps` DECIMAL(12, 4) NULL,
  `stopPrice` DECIMAL(36, 18) NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `shadow_trades_decisionId_key` (`decisionId`),
  INDEX `shadow_trades_tradingBotId_occurredAt_idx` (`tradingBotId`, `occurredAt`),
  INDEX `shadow_trades_action_occurredAt_idx` (`action`, `occurredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `shadow_trades`
  ADD CONSTRAINT `shadow_trades_tradingBotId_fkey`
    FOREIGN KEY (`tradingBotId`) REFERENCES `trading_bots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `shadow_trades_decisionId_fkey`
    FOREIGN KEY (`decisionId`) REFERENCES `trading_bot_decisions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
