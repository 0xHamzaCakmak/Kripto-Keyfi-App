ALTER TABLE `manual_order_previews`
  ADD COLUMN `positionSide` VARCHAR(10) NULL;

ALTER TABLE `trading_orders`
  ADD COLUMN `decisionId` BIGINT UNSIGNED NULL,
  ADD COLUMN `positionSide` VARCHAR(10) NULL;

CREATE INDEX `trading_orders_decisionId_idx` ON `trading_orders`(`decisionId`);

ALTER TABLE `testnet_execution_fills`
  ADD COLUMN `decisionId` BIGINT UNSIGNED NULL,
  ADD COLUMN `positionSide` VARCHAR(10) NULL;

CREATE INDEX `testnet_execution_fills_decisionId_idx` ON `testnet_execution_fills`(`decisionId`);
