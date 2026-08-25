ALTER TABLE `trading_risk_profiles`
  ADD COLUMN `minLeverage` INTEGER NOT NULL DEFAULT 5 AFTER `maxSymbolPositions`;
