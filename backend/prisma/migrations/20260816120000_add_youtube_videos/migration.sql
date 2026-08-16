CREATE TABLE `youtube_channels` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `channel_id` VARCHAR(64) NOT NULL,
  `uploads_playlist_id` VARCHAR(64) NOT NULL,
  `channel_name` VARCHAR(255) NULL,
  `channel_url` VARCHAR(500) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `is_own_channel` BOOLEAN NOT NULL DEFAULT false,
  `status` ENUM('active', 'paused') NOT NULL DEFAULT 'active',
  `last_synced_at` DATETIME(3) NULL,
  `added_by` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `youtube_channels_channel_id_key`(`channel_id`),
  INDEX `youtube_channels_status_idx`(`status`),
  INDEX `youtube_channels_added_by_idx`(`added_by`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `videos` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `youtube_video_id` VARCHAR(32) NOT NULL,
  `channel_id` INTEGER NULL,
  `channel_name` VARCHAR(255) NULL,
  `title` VARCHAR(500) NULL,
  `description` TEXT NULL,
  `thumbnail_url` VARCHAR(500) NULL,
  `duration` VARCHAR(16) NULL,
  `published_at` DATETIME(3) NULL,
  `source` ENUM('manual', 'auto') NOT NULL,
  `status` ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
  `added_by` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `videos_youtube_video_id_key`(`youtube_video_id`),
  INDEX `videos_channel_id_idx`(`channel_id`),
  INDEX `videos_status_published_at_idx`(`status`, `published_at`),
  INDEX `videos_added_by_idx`(`added_by`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `youtube_channels` ADD CONSTRAINT `youtube_channels_added_by_fkey` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `videos` ADD CONSTRAINT `videos_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `youtube_channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `videos` ADD CONSTRAINT `videos_added_by_fkey` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
