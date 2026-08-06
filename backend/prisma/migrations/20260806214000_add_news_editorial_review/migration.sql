ALTER TABLE `news_articles`
  ADD COLUMN `editorialReviewedAt` DATETIME(3) NULL;

CREATE INDEX `news_articles_sourceId_editorialReviewedAt_idx`
  ON `news_articles`(`sourceId`, `editorialReviewedAt`);
