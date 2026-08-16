ALTER TABLE `user_capabilities`
  MODIFY `status` ENUM('NOT_APPLIED', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `youtube_channels`
  ADD COLUMN `owner_user_id` VARCHAR(191) NULL AFTER `added_by`,
  ADD UNIQUE INDEX `youtube_channels_owner_user_id_key`(`owner_user_id`);

ALTER TABLE `videos`
  ADD COLUMN `creator_id` VARCHAR(191) NULL AFTER `added_by`,
  ADD INDEX `videos_creator_id_idx`(`creator_id`);

ALTER TABLE `youtube_channels`
  ADD CONSTRAINT `youtube_channels_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `videos`
  ADD CONSTRAINT `videos_creator_id_fkey` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
