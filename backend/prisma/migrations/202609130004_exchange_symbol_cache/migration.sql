CREATE TABLE `exchange_symbol_cache` (
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(40) NOT NULL,
  `baseAsset` VARCHAR(20) NOT NULL,
  `quoteAsset` VARCHAR(20) NOT NULL,
  `tickSize` DECIMAL(36,18) NOT NULL,
  `stepSize` DECIMAL(36,18) NOT NULL,
  `minQuantity` DECIMAL(36,18) NOT NULL,
  `maxQuantity` DECIMAL(36,18) NOT NULL,
  `minNotional` DECIMAL(36,18) NOT NULL,
  `maxLeverage` INTEGER NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`exchangeAccountId`, `symbol`),
  INDEX `exchange_symbol_cache_account_active_symbol_idx` (`exchangeAccountId`, `isActive`, `symbol`),
  INDEX `exchange_symbol_cache_last_seen_idx` (`lastSeenAt`),
  CONSTRAINT `exchange_symbol_cache_account_fkey`
    FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
