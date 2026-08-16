CREATE TABLE `user_video_reactions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(191) NOT NULL,
  `video_id` INTEGER NOT NULL,
  `reaction` ENUM('like', 'dislike') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `user_video_reactions_user_id_video_id_key`(`user_id`, `video_id`),
  INDEX `user_video_reactions_video_id_reaction_idx`(`video_id`, `reaction`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_video_reactions`
  ADD CONSTRAINT `user_video_reactions_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_video_reactions_video_id_fkey`
  FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
