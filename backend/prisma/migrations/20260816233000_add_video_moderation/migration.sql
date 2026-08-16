ALTER TABLE `videos`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `deleted_by` VARCHAR(191) NULL,
  ADD COLUMN `title_override` VARCHAR(500) NULL,
  ADD COLUMN `description_override` TEXT NULL,
  ADD COLUMN `warning_label` VARCHAR(50) NULL,
  ADD COLUMN `warning_note` TEXT NULL,
  ADD COLUMN `warning_visible_to_users` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `warned_by` VARCHAR(191) NULL,
  ADD COLUMN `warned_at` DATETIME(3) NULL,
  ADD COLUMN `moderated_by` VARCHAR(191) NULL,
  ADD COLUMN `moderated_at` DATETIME(3) NULL,
  ADD INDEX `videos_deleted_at_idx`(`deleted_at`),
  ADD INDEX `videos_deleted_by_idx`(`deleted_by`),
  ADD INDEX `videos_warned_by_idx`(`warned_by`),
  ADD INDEX `videos_moderated_by_idx`(`moderated_by`);

ALTER TABLE `videos`
  ADD CONSTRAINT `videos_deleted_by_fkey` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `videos_warned_by_fkey` FOREIGN KEY (`warned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `videos_moderated_by_fkey` FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
