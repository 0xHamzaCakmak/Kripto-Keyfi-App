CREATE TABLE `bot_pnl_periods` (
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `resetAt` DATETIME(3) NULL,
  PRIMARY KEY (`exchangeAccountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `bot_pnl_entries` (
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `botId` VARCHAR(191) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `net` DECIMAL(36,18) NOT NULL,
  `feesComplete` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`exchangeAccountId`, `sourceId`),
  INDEX `bot_pnl_entries_user_account_date` (`userId`, `exchangeAccountId`, `occurredAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `bot_pnl_entries` (`exchangeAccountId`,`sourceId`,`userId`,`botId`,`occurredAt`,`net`,`feesComplete`)
SELECT f.`exchangeAccountId`,CONCAT('fill:',f.`symbol`,':',f.`tradeId`),f.`userId`,f.`tradingBotId`,f.`occurredAt`,
  f.`realizedPnl`-CASE WHEN f.`commissionAsset` IN ('USDT','USDC') THEN f.`commission` ELSE 0 END,
  CASE WHEN f.`commission`=0 OR f.`commissionAsset` IN ('USDT','USDC') THEN TRUE ELSE FALSE END
FROM `testnet_execution_fills` f INNER JOIN `trading_bots` b ON b.`id`=f.`tradingBotId`
WHERE b.`mode`='DEMO' AND b.`type`<>'GRID' AND f.`reduceOnly`=TRUE AND f.`occurredAt`>='2026-06-30 21:00:00.000';
