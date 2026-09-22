DELETE FROM `bot_pnl_entries` WHERE `sourceId` LIKE 'fill:%';

INSERT INTO `bot_pnl_entries` (`exchangeAccountId`,`sourceId`,`userId`,`botId`,`occurredAt`,`net`,`feesComplete`)
SELECT f.`exchangeAccountId`,CONCAT('fill:',f.`symbol`,':',f.`tradeId`),f.`userId`,f.`tradingBotId`,f.`occurredAt`,
  f.`realizedPnl`-CASE WHEN f.`commissionAsset` IN ('USDT','USDC') THEN f.`commission` ELSE 0 END,
  CASE WHEN f.`commission`=0 OR f.`commissionAsset` IN ('USDT','USDC') THEN TRUE ELSE FALSE END
FROM `testnet_execution_fills` f
INNER JOIN `trading_bots` b ON b.`id`=f.`tradingBotId`
LEFT JOIN `bot_pnl_periods` p ON p.`exchangeAccountId`=f.`exchangeAccountId` AND p.`userId`=f.`userId`
WHERE b.`mode`='DEMO' AND b.`type`<>'GRID' AND f.`reduceOnly`=TRUE
  AND f.`occurredAt`>='2026-06-30 21:00:00.000'
  AND (p.`resetAt` IS NULL OR f.`occurredAt`>p.`resetAt`);
