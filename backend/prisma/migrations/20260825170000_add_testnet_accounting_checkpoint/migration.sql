CREATE TABLE `testnet_accounting_checkpoints` (
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `number` INTEGER NOT NULL DEFAULT 1,
  `baselineWalletBalance` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `baselineUnrealizedPnl` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `note` VARCHAR(500) NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `testnet_accounting_checkpoints_userId_startedAt_idx` (`userId`, `startedAt`),
  PRIMARY KEY (`exchangeAccountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `testnet_accounting_checkpoints`
  ADD CONSTRAINT `testnet_accounting_checkpoints_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `testnet_accounting_checkpoints`
  ADD CONSTRAINT `testnet_accounting_checkpoints_exchangeAccountId_fkey`
  FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
