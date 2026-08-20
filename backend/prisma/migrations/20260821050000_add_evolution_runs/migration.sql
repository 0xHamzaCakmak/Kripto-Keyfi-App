-- PROMPT 14: additive, auditable Evolution runs.
CREATE TABLE `evolution_runs` (
  `id` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `sourceGenerationId` VARCHAR(191) NOT NULL,
  `targetGenerationId` VARCHAR(191) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
  `config` JSON NOT NULL,
  `evidence` JSON NULL,
  `selection` JSON NULL,
  `errorMessage` VARCHAR(1000) NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `evolution_runs_targetGenerationId_key` (`targetGenerationId`),
  INDEX `evolution_runs_createdById_status_createdAt_idx` (`createdById`, `status`, `createdAt`),
  INDEX `evolution_runs_sourceGenerationId_createdAt_idx` (`sourceGenerationId`, `createdAt`),
  CONSTRAINT `evolution_runs_sourceGenerationId_fkey` FOREIGN KEY (`sourceGenerationId`) REFERENCES `trading_generations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `evolution_runs_targetGenerationId_fkey` FOREIGN KEY (`targetGenerationId`) REFERENCES `trading_generations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
