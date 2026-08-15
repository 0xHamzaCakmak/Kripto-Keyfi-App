ALTER TABLE `kol_social_accounts`
  ADD COLUMN `platformUserId` VARCHAR(64) NULL,
  ADD COLUMN `followingCount` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `contentCount` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `listedCount` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `platformVerified` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `platformCreatedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `kol_social_accounts_platform_platformUserId_key`
  ON `kol_social_accounts`(`platform`, `platformUserId`);
