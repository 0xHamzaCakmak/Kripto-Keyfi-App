CREATE TABLE `kols` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NULL, `slug` VARCHAR(100) NOT NULL,
  `displayName` VARCHAR(160) NOT NULL, `username` VARCHAR(100) NOT NULL, `avatarUrl` VARCHAR(700) NULL,
  `country` VARCHAR(80) NOT NULL, `language` VARCHAR(16) NOT NULL, `bio` TEXT NULL,
  `isVerified` BOOLEAN NOT NULL DEFAULT false, `isDemo` BOOLEAN NOT NULL DEFAULT false,
  `isPublished` BOOLEAN NOT NULL DEFAULT false, `categories` JSON NOT NULL, `useCaseScores` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `kols_userId_key`(`userId`), UNIQUE INDEX `kols_slug_key`(`slug`),
  INDEX `kols_isPublished_isVerified_idx`(`isPublished`, `isVerified`), INDEX `kols_country_language_idx`(`country`, `language`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kol_social_accounts` (
  `id` VARCHAR(191) NOT NULL, `kolId` VARCHAR(191) NOT NULL,
  `platform` ENUM('X','YOUTUBE','TELEGRAM','DISCORD','OTHER') NOT NULL, `handle` VARCHAR(160) NOT NULL,
  `profileUrl` VARCHAR(700) NULL, `followerCount` BIGINT NOT NULL DEFAULT 0, `engagementRate` DECIMAL(8,4) NULL,
  `accountAgeDays` INTEGER NULL, `sourceType` ENUM('VERIFIED_CAMPAIGN','PLATFORM_API','ADMIN_MANUAL','INFLUENCER_REPORTED','COMPANY_REPORTED','ESTIMATED','THIRD_PARTY') NOT NULL,
  `verified` BOOLEAN NOT NULL DEFAULT false, `verificationDate` DATETIME(3) NULL,
  `confidence` ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW', `sourceReference` VARCHAR(700) NULL, `measuredAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `kol_social_accounts_kolId_platform_handle_key`(`kolId`,`platform`,`handle`), INDEX `kol_social_accounts_platform_followerCount_idx`(`platform`,`followerCount`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kol_scores` (
  `id` VARCHAR(191) NOT NULL, `kolId` VARCHAR(191) NOT NULL, `overall` DECIMAL(5,2) NOT NULL,
  `trust` DECIMAL(5,2) NOT NULL, `audienceQuality` DECIMAL(5,2) NOT NULL, `engagementQuality` DECIMAL(5,2) NOT NULL,
  `marketKnowledge` DECIMAL(5,2) NOT NULL, `predictionAccuracy` DECIMAL(5,2) NOT NULL,
  `campaignPerformance` DECIMAL(5,2) NOT NULL, `transparency` DECIMAL(5,2) NOT NULL, `risk` DECIMAL(5,2) NOT NULL,
  `confidence` ENUM('LOW','MEDIUM','HIGH') NOT NULL, `sampleSize` INTEGER NOT NULL DEFAULT 0,
  `verifiedDataRatio` DECIMAL(5,4) NOT NULL, `methodologyVersion` VARCHAR(40) NOT NULL,
  `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `kol_scores_kolId_calculatedAt_idx`(`kolId`,`calculatedAt`), INDEX `kol_scores_overall_confidence_idx`(`overall`,`confidence`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kol_predictions` (
  `id` VARCHAR(191) NOT NULL, `kolId` VARCHAR(191) NOT NULL, `assetSymbol` VARCHAR(30) NOT NULL,
  `platform` ENUM('X','YOUTUBE','TELEGRAM','DISCORD','OTHER') NOT NULL, `sourceUrl` VARCHAR(700) NOT NULL,
  `sourceContent` TEXT NOT NULL, `sourceContentHash` VARCHAR(64) NULL, `sourceSnapshotRef` VARCHAR(700) NULL,
  `publishedAt` DATETIME(3) NOT NULL, `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `direction` ENUM('BULLISH','BEARISH','NEUTRAL') NOT NULL, `referencePrice` DECIMAL(36,18) NOT NULL,
  `targetPrice` DECIMAL(36,18) NULL, `invalidationPrice` DECIMAL(36,18) NULL, `timeHorizonDays` INTEGER NOT NULL,
  `confidence` DECIMAL(5,2) NULL, `evaluationDate` DATETIME(3) NULL,
  `result` ENUM('PENDING','CORRECT','PARTIALLY_CORRECT','INCORRECT','EXPIRED','INVALID') NOT NULL DEFAULT 'PENDING',
  `evaluationNotes` TEXT NULL, `evaluatedByUserId` VARCHAR(191) NULL,
  INDEX `kol_predictions_kolId_publishedAt_idx`(`kolId`,`publishedAt`), INDEX `kol_predictions_result_evaluationDate_idx`(`result`,`evaluationDate`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kol_risk_events` (
  `id` VARCHAR(191) NOT NULL, `kolId` VARCHAR(191) NOT NULL,
  `type` ENUM('SCAM_PROMOTION','RUG_PROMOTION','MISLEADING_CLAIM','UNDISCLOSED_AD','DELETED_PROMOTION','FAKE_ENGAGEMENT','SUSPICIOUS_GROWTH','COMMUNITY_COMPLAINT','CONFLICT_OF_INTEREST','OTHER') NOT NULL,
  `severity` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL, `title` VARCHAR(220) NOT NULL, `description` TEXT NOT NULL,
  `evidenceUrl` VARCHAR(700) NULL, `verified` BOOLEAN NOT NULL DEFAULT false,
  `visibility` ENUM('INTERNAL','PUBLIC') NOT NULL DEFAULT 'INTERNAL', `occurredAt` DATETIME(3) NOT NULL,
  `adminNotes` TEXT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `kol_risk_events_kolId_visibility_occurredAt_idx`(`kolId`,`visibility`,`occurredAt`), INDEX `kol_risk_events_type_severity_idx`(`type`,`severity`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kol_audience_metrics` (
  `id` VARCHAR(191) NOT NULL, `kolId` VARCHAR(191) NOT NULL,
  `platform` ENUM('X','YOUTUBE','TELEGRAM','DISCORD','OTHER') NOT NULL, `totalFollowers` BIGINT NOT NULL,
  `estimatedRealAudience` BIGINT NULL, `estimatedBotPercentage` DECIMAL(5,2) NULL, `engagementRate` DECIMAL(8,4) NULL,
  `averageViews` BIGINT NULL, `averageComments` INTEGER NULL, `averageShares` INTEGER NULL, `averageLikes` INTEGER NULL,
  `suspiciousGrowth` BOOLEAN NOT NULL DEFAULT false, `distribution` JSON NULL,
  `sourceType` ENUM('VERIFIED_CAMPAIGN','PLATFORM_API','ADMIN_MANUAL','INFLUENCER_REPORTED','COMPANY_REPORTED','ESTIMATED','THIRD_PARTY') NOT NULL,
  `verified` BOOLEAN NOT NULL DEFAULT false, `confidence` ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
  `sourceReference` VARCHAR(700) NULL, `measuredAt` DATETIME(3) NOT NULL,
  INDEX `kol_audience_metrics_kolId_platform_measuredAt_idx`(`kolId`,`platform`,`measuredAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `companies` (
  `id` VARCHAR(191) NOT NULL, `name` VARCHAR(180) NOT NULL, `website` VARCHAR(500) NULL, `sector` VARCHAR(100) NULL,
  `country` VARCHAR(80) NOT NULL, `verified` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `company_members` (
  `companyId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('OWNER','MANAGER','ANALYST') NOT NULL DEFAULT 'ANALYST', INDEX `company_members_userId_idx`(`userId`), PRIMARY KEY (`companyId`,`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campaigns` (
  `id` VARCHAR(191) NOT NULL, `companyId` VARCHAR(191) NOT NULL, `name` VARCHAR(180) NOT NULL, `project` VARCHAR(180) NOT NULL,
  `description` TEXT NULL, `goal` VARCHAR(80) NOT NULL, `budget` DECIMAL(18,2) NOT NULL, `currency` VARCHAR(12) NOT NULL,
  `countryTargets` JSON NOT NULL, `languageTargets` JSON NOT NULL, `audienceTargets` JSON NULL, `categories` JSON NOT NULL,
  `startDate` DATETIME(3) NOT NULL, `endDate` DATETIME(3) NOT NULL,
  `status` ENUM('DRAFT','PLANNED','ACTIVE','PAUSED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `kpi` VARCHAR(80) NOT NULL, `conversionTarget` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  INDEX `campaigns_companyId_status_idx`(`companyId`,`status`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campaign_influencers` (
  `id` VARCHAR(191) NOT NULL, `campaignId` VARCHAR(191) NOT NULL, `kolId` VARCHAR(191) NOT NULL,
  `agreedPrice` DECIMAL(18,2) NOT NULL, `currency` VARCHAR(12) NOT NULL, `deliverable` VARCHAR(120) NOT NULL,
  `status` ENUM('INVITED','ACCEPTED','ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'INVITED',
  `startDate` DATETIME(3) NULL, `completionDate` DATETIME(3) NULL, `notes` TEXT NULL,
  UNIQUE INDEX `campaign_influencers_campaignId_kolId_key`(`campaignId`,`kolId`), INDEX `campaign_influencers_kolId_status_idx`(`kolId`,`status`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campaign_tracking_links` (
  `id` VARCHAR(191) NOT NULL, `campaignId` VARCHAR(191) NOT NULL, `campaignInfluencerId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(80) NOT NULL, `destinationUrl` VARCHAR(900) NOT NULL, `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX `campaign_tracking_links_code_key`(`code`),
  INDEX `campaign_tracking_links_campaignId_campaignInfluencerId_idx`(`campaignId`,`campaignInfluencerId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `campaign_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `campaignId` VARCHAR(191) NOT NULL, `trackingLinkId` VARCHAR(191) NOT NULL,
  `eventType` ENUM('IMPRESSION','CLICK','REGISTRATION','EMAIL_VERIFIED','KYC','DEPOSIT','TRADE','WALLET_CONNECT','PURCHASE','SUBSCRIPTION','CUSTOM_CONVERSION') NOT NULL,
  `attributionIdHash` VARCHAR(64) NULL, `idempotencyKey` VARCHAR(191) NOT NULL, `value` DECIMAL(18,2) NULL,
  `currency` VARCHAR(12) NULL, `source` VARCHAR(80) NOT NULL, `metadata` JSON NULL,
  `occurredAt` DATETIME(3) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `campaign_events_idempotencyKey_key`(`idempotencyKey`), INDEX `campaign_events_campaignId_eventType_occurredAt_idx`(`campaignId`,`eventType`,`occurredAt`),
  INDEX `campaign_events_trackingLinkId_occurredAt_idx`(`trackingLinkId`,`occurredAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kol_audit_logs` (
  `id` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL, `action` VARCHAR(100) NOT NULL,
  `entityType` VARCHAR(80) NOT NULL, `entityId` VARCHAR(120) NOT NULL, `beforeData` JSON NULL, `afterData` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `kol_audit_logs_entityType_entityId_createdAt_idx`(`entityType`,`entityId`,`createdAt`),
  INDEX `kol_audit_logs_actorId_createdAt_idx`(`actorId`,`createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `kols` ADD CONSTRAINT `kols_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `kol_social_accounts` ADD CONSTRAINT `kol_social_accounts_kolId_fkey` FOREIGN KEY (`kolId`) REFERENCES `kols`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `kol_scores` ADD CONSTRAINT `kol_scores_kolId_fkey` FOREIGN KEY (`kolId`) REFERENCES `kols`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `kol_predictions` ADD CONSTRAINT `kol_predictions_kolId_fkey` FOREIGN KEY (`kolId`) REFERENCES `kols`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `kol_risk_events` ADD CONSTRAINT `kol_risk_events_kolId_fkey` FOREIGN KEY (`kolId`) REFERENCES `kols`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `kol_audience_metrics` ADD CONSTRAINT `kol_audience_metrics_kolId_fkey` FOREIGN KEY (`kolId`) REFERENCES `kols`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `company_members` ADD CONSTRAINT `company_members_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `company_members` ADD CONSTRAINT `company_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaign_influencers` ADD CONSTRAINT `campaign_influencers_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaign_influencers` ADD CONSTRAINT `campaign_influencers_kolId_fkey` FOREIGN KEY (`kolId`) REFERENCES `kols`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `campaign_tracking_links` ADD CONSTRAINT `campaign_tracking_links_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaign_tracking_links` ADD CONSTRAINT `campaign_tracking_links_campaignInfluencerId_fkey` FOREIGN KEY (`campaignInfluencerId`) REFERENCES `campaign_influencers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaign_events` ADD CONSTRAINT `campaign_events_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `campaign_events` ADD CONSTRAINT `campaign_events_trackingLinkId_fkey` FOREIGN KEY (`trackingLinkId`) REFERENCES `campaign_tracking_links`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `kol_audit_logs` ADD CONSTRAINT `kol_audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
