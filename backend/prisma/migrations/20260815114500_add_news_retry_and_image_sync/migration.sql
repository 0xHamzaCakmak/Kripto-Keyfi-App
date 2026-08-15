ALTER TABLE `news_articles`
  ADD COLUMN `nextLocalizationAttemptAt` DATETIME(3) NULL,
  ADD COLUMN `sourceImageUrl` VARCHAR(1000) NULL,
  ADD COLUMN `imageSyncError` VARCHAR(500) NULL,
  ADD COLUMN `imageSyncAttempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `imageSyncNextAttemptAt` DATETIME(3) NULL;

UPDATE `news_articles`
SET `sourceImageUrl` = `coverImageUrl`
WHERE `coverImageUrl` IS NOT NULL;

UPDATE `news_articles`
SET `nextLocalizationAttemptAt` = CURRENT_TIMESTAMP(3)
WHERE `aiStatus` IN ('REVIEW_REQUIRED', 'FAILED')
  AND `manualEditedAt` IS NULL;

CREATE INDEX `news_articles_aiStatus_nextLocalizationAttemptAt_idx`
  ON `news_articles`(`aiStatus`, `nextLocalizationAttemptAt`);

CREATE INDEX `news_articles_imageSyncNextAttemptAt_idx`
  ON `news_articles`(`imageSyncNextAttemptAt`);
