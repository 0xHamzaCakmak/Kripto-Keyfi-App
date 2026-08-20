CREATE TABLE `analytics_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_name` VARCHAR(100) NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `session_id` VARCHAR(64) NULL,
  `page_path` VARCHAR(500) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_event_date` (`event_name`, `created_at`),
  INDEX `idx_user` (`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `analytics_events_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
