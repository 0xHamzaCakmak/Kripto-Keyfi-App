-- PROMPT 15: additive, PAPER/CANDIDATE crossover lineage.
ALTER TABLE `trading_bots`
  MODIFY `factoryCreationMethod` ENUM('MANUAL', 'CLONE', 'PARAMETER_VARIANT', 'CROSSOVER') NULL;

CREATE TABLE `bot_crossovers` (
  `id` VARCHAR(191) NOT NULL,
  `parentABotId` VARCHAR(191) NOT NULL,
  `parentBBotId` VARCHAR(191) NOT NULL,
  `childBotId` VARCHAR(191) NOT NULL,
  `generationId` VARCHAR(191) NOT NULL,
  `inheritedFields` JSON NOT NULL,
  `generatedFields` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `bot_crossovers_childBotId_key` (`childBotId`),
  INDEX `bot_crossovers_parentABotId_createdAt_idx` (`parentABotId`, `createdAt`),
  INDEX `bot_crossovers_parentBBotId_createdAt_idx` (`parentBBotId`, `createdAt`),
  INDEX `bot_crossovers_generationId_createdAt_idx` (`generationId`, `createdAt`),
  CONSTRAINT `bot_crossovers_parentABotId_fkey` FOREIGN KEY (`parentABotId`) REFERENCES `trading_bots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `bot_crossovers_parentBBotId_fkey` FOREIGN KEY (`parentBBotId`) REFERENCES `trading_bots` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `bot_crossovers_childBotId_fkey` FOREIGN KEY (`childBotId`) REFERENCES `trading_bots` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `bot_crossovers_generationId_fkey` FOREIGN KEY (`generationId`) REFERENCES `trading_generations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
