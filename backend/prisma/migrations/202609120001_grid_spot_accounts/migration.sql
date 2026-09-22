ALTER TABLE `exchange_accounts` MODIFY `accountType` ENUM('USDT_M', 'UNIFIED', 'SPOT') NOT NULL;
ALTER TABLE `trading_risk_profiles` ADD COLUMN `entryPaused` BOOLEAN NOT NULL DEFAULT false;
