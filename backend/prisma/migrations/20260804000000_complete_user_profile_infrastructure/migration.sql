ALTER TABLE `users`
  MODIFY `status` ENUM('ACTIVE', 'PENDING', 'PASSIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `bio` VARCHAR(500) NULL,
  ADD COLUMN `profileCompleted` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `onboardingCompleted` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `user_capabilities` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` ENUM('CREATOR', 'AUTHOR', 'PROJECT_OWNER', 'DEVELOPER') NOT NULL,
  `status` ENUM('NOT_APPLIED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `approvedAt` DATETIME(3) NULL,
  `rejectedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `user_capabilities_userId_type_key` (`userId`, `type`),
  INDEX `user_capabilities_type_status_idx` (`type`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `user_capabilities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
