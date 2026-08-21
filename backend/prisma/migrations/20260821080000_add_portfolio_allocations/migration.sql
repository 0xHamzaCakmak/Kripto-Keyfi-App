CREATE TABLE `portfolio_allocations` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `mode` ENUM('SHADOW', 'PAPER', 'DEMO') NOT NULL DEFAULT 'PAPER',
  `capital` DECIMAL(36, 18) NOT NULL,
  `allocatedCapital` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  `reservePct` DECIMAL(8, 6) NOT NULL,
  `botAllocations` JSON NOT NULL,
  `symbolAllocations` JSON NOT NULL,
  `riskSnapshot` JSON NOT NULL,
  `config` JSON NOT NULL,
  `deterministic` BOOLEAN NOT NULL DEFAULT true,
  `orderSubmitted` BOOLEAN NOT NULL DEFAULT false,
  `liveActivated` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `portfolio_allocations_userId_createdAt_idx` (`userId`, `createdAt`),
  INDEX `portfolio_allocations_exchangeAccountId_mode_createdAt_idx` (`exchangeAccountId`, `mode`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `portfolio_allocations`
  ADD CONSTRAINT `portfolio_allocations_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `portfolio_allocations_exchangeAccountId_fkey`
    FOREIGN KEY (`exchangeAccountId`) REFERENCES `exchange_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
