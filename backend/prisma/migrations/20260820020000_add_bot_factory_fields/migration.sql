-- PROMPT 3: additive Bot Factory metadata. Existing manual/grid rows remain unchanged.
ALTER TABLE `trading_bots`
  MODIFY `type` ENUM('SCALPING', 'GRID', 'AUTONOMOUS') NOT NULL,
  ADD COLUMN `factoryCreationMethod` ENUM('MANUAL', 'CLONE', 'PARAMETER_VARIANT') NULL,
  ADD COLUMN `symbols` JSON NULL,
  ADD COLUMN `timeframe` VARCHAR(20) NULL;

CREATE INDEX `trading_bots_userId_factoryCreationMethod_lifecycleStatus_idx`
  ON `trading_bots`(`userId`, `factoryCreationMethod`, `lifecycleStatus`);
