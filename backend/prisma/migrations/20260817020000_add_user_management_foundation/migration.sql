ALTER TABLE `users`
  ADD COLUMN `created_by_admin_id` VARCHAR(191) NULL,
  ADD COLUMN `notes` TEXT NULL,
  ADD INDEX `users_created_by_admin_id_idx` (`created_by_admin_id`),
  ADD CONSTRAINT `users_created_by_admin_id_fkey`
    FOREIGN KEY (`created_by_admin_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `user_admin_audit_logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(191) NOT NULL,
  `admin_id` VARCHAR(191) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `changes` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `user_admin_audit_logs_user_id_created_at_idx` (`user_id`, `created_at`),
  INDEX `user_admin_audit_logs_admin_id_created_at_idx` (`admin_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `user_admin_audit_logs_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `user_admin_audit_logs_admin_id_fkey`
    FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
