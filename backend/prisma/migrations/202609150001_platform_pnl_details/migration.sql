ALTER TABLE `bot_pnl_entries`
  ADD COLUMN `symbol` VARCHAR(40) NULL,
  ADD COLUMN `leverage` INTEGER NULL,
  ADD COLUMN `tradeNotional` DECIMAL(36,18) NULL,
  ADD COLUMN `source` VARCHAR(30) NULL;

UPDATE `bot_pnl_entries`
SET `symbol` = SUBSTRING_INDEX(SUBSTRING_INDEX(`sourceId`, ':', 2), ':', -1)
WHERE `sourceId` LIKE 'fill:%' OR `sourceId` LIKE 'grid:%';
