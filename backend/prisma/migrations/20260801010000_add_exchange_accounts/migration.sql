CREATE TABLE `exchange_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `provider` ENUM('BINANCE', 'BYBIT') NOT NULL,
  `environment` ENUM('TESTNET', 'DEMO') NOT NULL,
  `accountType` ENUM('USDT_M', 'UNIFIED') NOT NULL,
  `apiKeyEncrypted` TEXT NOT NULL,
  `apiSecretEncrypted` TEXT NOT NULL,
  `passphraseEncrypted` TEXT NULL,
  `apiKeyHint` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `connectionStatus` ENUM('CONNECTED', 'ERROR', 'DISABLED') NOT NULL DEFAULT 'CONNECTED',
  `canTrade` BOOLEAN NOT NULL DEFAULT false,
  `withdrawalEnabled` BOOLEAN NOT NULL DEFAULT false,
  `lastConnectedAt` DATETIME(3) NULL,
  `lastSyncAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `exchange_accounts_userId_name_key`(`userId`, `name`),
  INDEX `exchange_accounts_userId_provider_idx`(`userId`, `provider`),
  INDEX `exchange_accounts_connectionStatus_idx`(`connectionStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `exchange_accounts`
  ADD CONSTRAINT `exchange_accounts_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
