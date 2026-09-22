CREATE TABLE `manual_order_batches` (
  `id` VARCHAR(36) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `exchangeAccountId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(30) NOT NULL,
  `plan` JSON NOT NULL,
  `leaseToken` VARCHAR(36) NULL,
  `leaseExpiresAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `manual_order_batches_status_leaseExpiresAt_idx` (`status`, `leaseExpiresAt`),
  INDEX `manual_order_batches_userId_exchangeAccountId_createdAt_idx` (`userId`, `exchangeAccountId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
