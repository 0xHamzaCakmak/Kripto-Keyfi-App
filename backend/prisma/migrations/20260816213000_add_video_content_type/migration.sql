ALTER TABLE `videos`
  ADD COLUMN `duration_seconds` INTEGER NULL AFTER `duration`,
  ADD COLUMN `content_type` ENUM('long', 'short') NOT NULL DEFAULT 'long' AFTER `duration_seconds`;

UPDATE `videos`
SET `duration_seconds` = CASE
  WHEN `duration` REGEXP '^[0-9]+:[0-9]{2}$' THEN
    CAST(SUBSTRING_INDEX(`duration`, ':', 1) AS UNSIGNED) * 60
    + CAST(SUBSTRING_INDEX(`duration`, ':', -1) AS UNSIGNED)
  WHEN `duration` REGEXP '^[0-9]+:[0-9]{2}:[0-9]{2}$' THEN
    CAST(SUBSTRING_INDEX(`duration`, ':', 1) AS UNSIGNED) * 3600
    + CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(`duration`, ':', 2), ':', -1) AS UNSIGNED) * 60
    + CAST(SUBSTRING_INDEX(`duration`, ':', -1) AS UNSIGNED)
  ELSE NULL
END;

UPDATE `videos`
SET `content_type` = 'short'
WHERE (`duration_seconds` BETWEEN 1 AND 60)
   OR (`published_at` >= '2024-10-15 00:00:00' AND `duration_seconds` BETWEEN 1 AND 180);

CREATE INDEX `videos_status_content_type_published_at_idx`
  ON `videos`(`status`, `content_type`, `published_at`);
