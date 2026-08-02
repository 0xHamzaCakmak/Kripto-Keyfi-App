ALTER TABLE `users`
  MODIFY `passwordHash` VARCHAR(191) NULL,
  ADD COLUMN `username` VARCHAR(30) NULL,
  ADD COLUMN `avatarUrl` VARCHAR(500) NULL,
  ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `termsAcceptedAt` DATETIME(3) NULL,
  ADD COLUMN `privacyAcceptedAt` DATETIME(3) NULL;

UPDATE `users`
SET `username` = CONCAT('user_', LEFT(MD5(`id`), 12))
WHERE `username` IS NULL;

ALTER TABLE `users`
  MODIFY `username` VARCHAR(30) NOT NULL,
  ADD UNIQUE INDEX `users_username_key` (`username`);

CREATE TABLE `user_identities` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `provider` ENUM('GOOGLE') NOT NULL,
  `providerSubject` VARCHAR(255) NOT NULL,
  `emailAtLink` VARCHAR(320) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `user_identities_provider_providerSubject_key` (`provider`, `providerSubject`),
  INDEX `user_identities_userId_provider_idx` (`userId`, `provider`),
  PRIMARY KEY (`id`),
  CONSTRAINT `user_identities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `profile_roles` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(60) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `profile_roles_slug_key` (`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_profile_roles` (
  `userId` VARCHAR(191) NOT NULL,
  `roleId` VARCHAR(191) NOT NULL,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `user_profile_roles_roleId_idx` (`roleId`),
  PRIMARY KEY (`userId`, `roleId`),
  CONSTRAINT `user_profile_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_profile_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `profile_roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
