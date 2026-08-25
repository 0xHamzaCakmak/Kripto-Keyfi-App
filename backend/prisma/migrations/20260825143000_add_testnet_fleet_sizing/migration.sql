ALTER TABLE `trading_risk_profiles`
  ADD COLUMN `testnetBotAllocationUsdt` DECIMAL(36,18) NOT NULL DEFAULT 100 AFTER `paperMaxOpenPositions`,
  ADD COLUMN `testnetMinInitialMarginUsdt` DECIMAL(36,18) NOT NULL DEFAULT 20 AFTER `testnetBotAllocationUsdt`;
