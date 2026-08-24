CREATE TABLE `trading_universe_assets` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(40) NOT NULL,
  `baseAsset` VARCHAR(20) NOT NULL,
  `displayName` VARCHAR(80) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `sortOrder` INTEGER NOT NULL,
  `marketCap` DECIMAL(36, 2) NULL,
  `volume24h` DECIMAL(36, 2) NULL,
  `marketRank` INTEGER NULL,
  `volumeChange24h` DECIMAL(12, 6) NULL,
  `intelligenceSource` VARCHAR(40) NULL,
  `intelligenceUpdatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `trading_universe_assets_userId_symbol_key` (`userId`, `symbol`),
  INDEX `trading_universe_assets_userId_enabled_sortOrder_idx` (`userId`, `enabled`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `trading_universe_assets`
  ADD CONSTRAINT `trading_universe_assets_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
