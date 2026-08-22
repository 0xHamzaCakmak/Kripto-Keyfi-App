-- Additive compatibility for system-generated TESTNET orders. Existing manual
-- orders retain their preview foreign key and uniqueness guarantees.
ALTER TABLE `trading_orders` MODIFY `previewId` VARCHAR(191) NULL;
