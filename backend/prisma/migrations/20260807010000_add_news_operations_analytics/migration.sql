ALTER TABLE `news_sources`
  ADD COLUMN `aiEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `minimumManualReviews` INTEGER NOT NULL DEFAULT 20;

ALTER TABLE `news_articles`
  ADD COLUMN `aiStatus` ENUM('WAITING', 'PROCESSING', 'READY', 'REVIEW_REQUIRED', 'FAILED') NOT NULL DEFAULT 'WAITING',
  ADD COLUMN `localizationStartedAt` DATETIME(3) NULL,
  ADD COLUMN `manualEditedAt` DATETIME(3) NULL;

UPDATE `news_articles` a
LEFT JOIN `news_ai_summaries` s ON s.`articleId` = a.`id`
SET a.`aiStatus` = CASE
  WHEN a.`localizationError` IS NOT NULL AND a.`localizationAttempts` >= 5 THEN 'FAILED'
  WHEN s.`needsReview` = true THEN 'REVIEW_REQUIRED'
  WHEN a.`titleTr` IS NOT NULL AND a.`summaryTr` IS NOT NULL THEN 'READY'
  ELSE 'WAITING'
END;

CREATE TABLE `news_analytics_events` (
  `id` VARCHAR(191) NOT NULL,
  `type` ENUM('NEWS_SUMMARY_VIEW', 'NEWS_SOURCE_CLICK', 'RELATED_NEWS_CLICK', 'CATEGORY_CLICK', 'WEB_VITAL') NOT NULL,
  `articleId` VARCHAR(191) NULL,
  `sourceSlug` VARCHAR(80) NULL,
  `category` VARCHAR(80) NULL,
  `summaryWordCount` INTEGER NULL,
  `durationMs` INTEGER NULL,
  `scrollDepth` INTEGER NULL,
  `targetArticleId` VARCHAR(191) NULL,
  `metricName` VARCHAR(20) NULL,
  `metricValue` DECIMAL(12, 3) NULL,
  `pageType` VARCHAR(40) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `news_analytics_events_type_createdAt_idx` (`type`, `createdAt`),
  INDEX `news_analytics_events_articleId_createdAt_idx` (`articleId`, `createdAt`),
  INDEX `news_analytics_events_metricName_createdAt_idx` (`metricName`, `createdAt`),
  CONSTRAINT `news_analytics_events_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `news_articles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `news_worker_health` (
  `id` VARCHAR(40) NOT NULL,
  `lastRunAt` DATETIME(3) NULL,
  `lastSuccessfulAt` DATETIME(3) NULL,
  `pendingCount` INTEGER NOT NULL DEFAULT 0,
  `processingCount` INTEGER NOT NULL DEFAULT 0,
  `errorCount` INTEGER NOT NULL DEFAULT 0,
  `rateLimitCount` INTEGER NOT NULL DEFAULT 0,
  `lastError` VARCHAR(500) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
