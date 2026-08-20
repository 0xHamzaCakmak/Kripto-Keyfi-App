-- PROMPT 10: additive Trade Memory context on the existing PaperTrade ledger.
ALTER TABLE `paper_trades`
  ADD COLUMN `stopLoss` DECIMAL(36, 18) NULL,
  ADD COLUMN `takeProfit` DECIMAL(36, 18) NULL,
  ADD COLUMN `maxFavorableExcursion` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  ADD COLUMN `maxAdverseExcursion` DECIMAL(36, 18) NOT NULL DEFAULT 0,
  ADD COLUMN `holdingSeconds` INTEGER NULL,
  ADD COLUMN `marketContext` JSON NULL,
  ADD COLUMN `closeReason` VARCHAR(80) NULL,
  ADD COLUMN `aiConfidence` DECIMAL(5, 4) NULL,
  ADD COLUMN `decisionSummary` VARCHAR(1000) NULL;

CREATE INDEX `paper_trades_tradingBotId_status_realizedPnl_idx`
  ON `paper_trades`(`tradingBotId`, `status`, `realizedPnl`);
CREATE INDEX `paper_trades_strategyVersionId_status_realizedPnl_idx`
  ON `paper_trades`(`strategyVersionId`, `status`, `realizedPnl`);
CREATE INDEX `paper_trades_marketRegimeSnapshotId_status_realizedPnl_idx`
  ON `paper_trades`(`marketRegimeSnapshotId`, `status`, `realizedPnl`);
CREATE INDEX `paper_trades_symbol_side_status_realizedPnl_idx`
  ON `paper_trades`(`symbol`, `side`, `status`, `realizedPnl`);
