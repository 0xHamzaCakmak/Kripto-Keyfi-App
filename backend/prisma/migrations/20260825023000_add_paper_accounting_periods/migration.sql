CREATE TABLE `paper_accounting_periods` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `number` INTEGER NOT NULL,
  `status` ENUM('ACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  `baselineStartingCapital` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `baselineRealizedPnl` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `baselineUnrealizedPnl` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `baselineFees` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `botIds` JSON NOT NULL,
  `botCount` INTEGER NOT NULL,
  `note` VARCHAR(500) NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `paper_accounting_periods_userId_number_key` (`userId`, `number`),
  INDEX `paper_accounting_periods_userId_status_startedAt_idx` (`userId`, `status`, `startedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `paper_accounting_periods_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `trading_generations`
  MODIFY `populationTarget` INTEGER NOT NULL DEFAULT 20;
