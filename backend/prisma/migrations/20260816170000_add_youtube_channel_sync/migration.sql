ALTER TABLE `videos`
  MODIFY `source` ENUM('manual', 'auto', 'admin_manual', 'creator_auto', 'kriptokeyfi_auto') NOT NULL,
  ADD COLUMN `youtube_url` VARCHAR(500) NULL AFTER `youtube_video_id`,
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `created_at`;

UPDATE `videos`
SET `youtube_url` = CONCAT('https://www.youtube.com/watch?v=', `youtube_video_id`),
    `source` = CASE
      WHEN `source` = 'manual' THEN 'admin_manual'
      ELSE 'creator_auto'
    END;

ALTER TABLE `videos`
  MODIFY `youtube_url` VARCHAR(500) NOT NULL,
  MODIFY `source` ENUM('admin_manual', 'creator_auto', 'kriptokeyfi_auto') NOT NULL,
  ADD INDEX `videos_source_status_idx`(`source`, `status`);
