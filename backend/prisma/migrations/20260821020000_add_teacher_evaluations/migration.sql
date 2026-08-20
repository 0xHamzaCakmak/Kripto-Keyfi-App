-- PROMPT 11: additive, recommendation-only Teacher evaluations.
CREATE TABLE `teacher_evaluations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tradingBotId` VARCHAR(191) NULL,
  `strategyId` VARCHAR(191) NULL,
  `observation` VARCHAR(1000) NOT NULL,
  `severity` VARCHAR(20) NOT NULL,
  `confidence` DECIMAL(5, 4) NOT NULL,
  `metricEvidence` JSON NOT NULL,
  `recommendedAction` JSON NOT NULL,
  `analyzer` VARCHAR(40) NOT NULL DEFAULT 'RULE_BASED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `teacher_evaluations_tradingBotId_createdAt_idx` (`tradingBotId`, `createdAt`),
  INDEX `teacher_evaluations_strategyId_createdAt_idx` (`strategyId`, `createdAt`),
  INDEX `teacher_evaluations_severity_createdAt_idx` (`severity`, `createdAt`),
  CONSTRAINT `teacher_evaluations_tradingBotId_fkey` FOREIGN KEY (`tradingBotId`) REFERENCES `trading_bots` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `teacher_evaluations_strategyId_fkey` FOREIGN KEY (`strategyId`) REFERENCES `trading_strategies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
