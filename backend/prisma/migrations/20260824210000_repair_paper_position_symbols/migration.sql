-- paper_trades owns the active trade lifecycle. Repair aggregate rows that
-- retained a previously closed symbol after a bot rotated through its Universe.
UPDATE `trading_bots` AS `bot`
SET `bot`.`symbol` = (
  SELECT `trade`.`symbol`
  FROM `paper_trades` AS `trade`
  WHERE `trade`.`tradingBotId` = `bot`.`id`
    AND `trade`.`status` = 'OPEN'
  ORDER BY `trade`.`openedAt` DESC
  LIMIT 1
),
`bot`.`symbols` = JSON_ARRAY((
  SELECT `trade`.`symbol`
  FROM `paper_trades` AS `trade`
  WHERE `trade`.`tradingBotId` = `bot`.`id`
    AND `trade`.`status` = 'OPEN'
  ORDER BY `trade`.`openedAt` DESC
  LIMIT 1
)),
`bot`.`version` = `bot`.`version` + 1
WHERE `bot`.`mode` = 'PAPER'
  AND EXISTS (
    SELECT 1 FROM `paper_trades` AS `trade`
    WHERE `trade`.`tradingBotId` = `bot`.`id`
      AND `trade`.`status` = 'OPEN'
      AND `trade`.`symbol` <> `bot`.`symbol`
  );

UPDATE `trading_bot_paper_positions` AS `position`
JOIN `trading_bots` AS `bot` ON `bot`.`id` = `position`.`tradingBotId`
SET `position`.`symbol` = COALESCE(
  (
    SELECT `trade`.`symbol`
    FROM `paper_trades` AS `trade`
    WHERE `trade`.`tradingBotId` = `position`.`tradingBotId`
      AND `trade`.`status` = 'OPEN'
    ORDER BY `trade`.`openedAt` DESC
    LIMIT 1
  ),
  `bot`.`symbol`
),
`position`.`updatedAt` = UTC_TIMESTAMP(3)
WHERE `position`.`symbol` <> COALESCE(
  (
    SELECT `trade`.`symbol`
    FROM `paper_trades` AS `trade`
    WHERE `trade`.`tradingBotId` = `position`.`tradingBotId`
      AND `trade`.`status` = 'OPEN'
    ORDER BY `trade`.`openedAt` DESC
    LIMIT 1
  ),
  `bot`.`symbol`
);
