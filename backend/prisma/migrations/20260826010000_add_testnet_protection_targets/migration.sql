ALTER TABLE `trading_risk_profiles`
  ADD COLUMN `testnetStopLossBps` INTEGER NOT NULL DEFAULT 300 AFTER `maxLeverage`,
  ADD COLUMN `testnetTakeProfitBps` INTEGER NOT NULL DEFAULT 300 AFTER `testnetStopLossBps`;
