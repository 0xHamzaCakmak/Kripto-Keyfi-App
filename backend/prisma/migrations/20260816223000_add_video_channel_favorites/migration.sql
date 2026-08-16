CREATE TABLE `user_favorite_channels` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(191) NOT NULL,
  `channel_id` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `user_favorite_channels_user_id_channel_id_key`(`user_id`, `channel_id`),
  INDEX `user_favorite_channels_channel_id_idx`(`channel_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_favorite_channels`
  ADD CONSTRAINT `user_favorite_channels_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_favorite_channels_channel_id_fkey`
    FOREIGN KEY (`channel_id`) REFERENCES `youtube_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
