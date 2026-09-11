CREATE TABLE `maintenance_jobs` (
  `name` VARCHAR(80) NOT NULL,
  `nextRunAt` DATETIME(3) NOT NULL,
  `lastStartedAt` DATETIME(3) NULL,
  `lastCompletedAt` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `trading_outbox_events_createdAt_id_idx` ON `trading_outbox_events` (`createdAt`, `id`);
