-- PROMPT 13: additive mutation lineage; parent bots are never updated.
CREATE TABLE `bot_mutations` (
  `id` VARCHAR(191) NOT NULL,
  `parentBotId` VARCHAR(191) NOT NULL,
  `childBotId` VARCHAR(191) NOT NULL,
  `generationId` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `diff` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `bot_mutations_childBotId_key` (`childBotId`),
  INDEX `bot_mutations_parentBotId_createdAt_idx` (`parentBotId`, `createdAt`),
  INDEX `bot_mutations_generationId_createdAt_idx` (`generationId`, `createdAt`),
  CONSTRAINT `bot_mutations_parentBotId_fkey` FOREIGN KEY (`parentBotId`) REFERENCES `trading_bots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `bot_mutations_childBotId_fkey` FOREIGN KEY (`childBotId`) REFERENCES `trading_bots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `bot_mutations_generationId_fkey` FOREIGN KEY (`generationId`) REFERENCES `trading_generations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
