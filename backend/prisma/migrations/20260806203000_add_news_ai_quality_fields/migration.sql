ALTER TABLE `news_ai_summaries`
  ADD COLUMN `confidence` DECIMAL(5, 4) NULL,
  ADD COLUMN `needsReview` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `wordCount` INTEGER NULL,
  ADD COLUMN `qualityFlags` JSON NULL;
