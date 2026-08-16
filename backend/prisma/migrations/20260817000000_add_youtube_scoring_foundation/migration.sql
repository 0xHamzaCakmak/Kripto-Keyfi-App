CREATE TABLE `youtube_channel_metrics_snapshots` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `channel_id` INTEGER NOT NULL,
  `snapshot_date` DATE NOT NULL,
  `subscriber_count` INTEGER NULL,
  `total_view_count` BIGINT NULL,
  `video_count` INTEGER NULL,
  `avg_views_recent` INTEGER NULL,
  `avg_likes_recent` INTEGER NULL,
  `avg_comments_recent` INTEGER NULL,
  `uploads_last_90_days` INTEGER NOT NULL,

  UNIQUE INDEX `youtube_channel_metrics_snapshots_channel_id_snapshot_date_key`(`channel_id`, `snapshot_date`),
  INDEX `youtube_channel_metrics_snapshots_snapshot_date_idx`(`snapshot_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `youtube_score_weights` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reach_weight` DECIMAL(4, 2) NOT NULL DEFAULT 20.00,
  `engagement_weight` DECIMAL(4, 2) NOT NULL DEFAULT 30.00,
  `view_power_weight` DECIMAL(4, 2) NOT NULL DEFAULT 25.00,
  `consistency_weight` DECIMAL(4, 2) NOT NULL DEFAULT 15.00,
  `growth_weight` DECIMAL(4, 2) NOT NULL DEFAULT 10.00,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `updated_by` VARCHAR(191) NULL,

  INDEX `youtube_score_weights_updated_by_idx`(`updated_by`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `youtube_channel_scores` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `channel_id` INTEGER NOT NULL,
  `total_score` DECIMAL(5, 2) NULL,
  `reach_score` DECIMAL(5, 2) NULL,
  `engagement_score` DECIMAL(5, 2) NULL,
  `view_power_score` DECIMAL(5, 2) NULL,
  `consistency_score` DECIMAL(5, 2) NULL,
  `growth_score` DECIMAL(5, 2) NULL,
  `calculated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `youtube_channel_scores_channel_id_key`(`channel_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `youtube_channel_metrics_snapshots`
  ADD CONSTRAINT `youtube_channel_metrics_snapshots_channel_id_fkey`
  FOREIGN KEY (`channel_id`) REFERENCES `youtube_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `youtube_score_weights`
  ADD CONSTRAINT `youtube_score_weights_updated_by_fkey`
  FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `youtube_channel_scores`
  ADD CONSTRAINT `youtube_channel_scores_channel_id_fkey`
  FOREIGN KEY (`channel_id`) REFERENCES `youtube_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `youtube_score_weights`
  (`reach_weight`, `engagement_weight`, `view_power_weight`, `consistency_weight`, `growth_weight`, `updated_at`)
VALUES
  (20.00, 30.00, 25.00, 15.00, 10.00, CURRENT_TIMESTAMP(3));
