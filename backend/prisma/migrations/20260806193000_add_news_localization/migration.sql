ALTER TABLE `news_articles`
  ADD COLUMN `titleTr` VARCHAR(500) NULL,
  ADD COLUMN `summaryTr` TEXT NULL,
  ADD COLUMN `localizedAt` DATETIME(3) NULL,
  ADD COLUMN `localizationError` VARCHAR(500) NULL,
  ADD COLUMN `localizationAttempts` INTEGER NOT NULL DEFAULT 0;
