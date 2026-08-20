-- Autonomous Trading core domain foundation.
-- This migration is additive: existing manual orders, grid bots, exchange
-- accounts, paper fills and risk profiles are preserved unchanged.

CREATE TABLE `trading_strategies` (
  `id` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `family` ENUM('GRID', 'TREND', 'SMA_CROSSOVER', 'EMA_TREND', 'MACD_TREND', 'RSI_MEAN_REVERSION', 'BOLLINGER_MEAN_REVERSION', 'DONCHIAN_BREAKOUT', 'ATR_BREAKOUT', 'MOMENTUM', 'VOLUME_SPIKE', 'FUNDING_SKEW', 'BASIS_ARBITRAGE', 'NEWS_REACTIVE', 'DCA', 'AI_LIMIT', 'MULTI_AGENT', 'CUSTOM') NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(1000) NULL,
  `status` ENUM('DRAFT', 'CANDIDATE', 'TESTING', 'PAPER', 'REJECTED', 'CHALLENGER', 'CHAMPION', 'LIVE_ELIGIBLE', 'LIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `trading_strategies_createdById_name_key`(`createdById`, `name`),
  INDEX `trading_strategies_family_status_idx`(`family`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `trading_strategies_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `trading_strategy_versions` (
  `id` VARCHAR(191) NOT NULL,
  `strategyId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `parameterSchema` JSON NOT NULL,
  `defaultParameters` JSON NOT NULL,
  `allowedMarkets` JSON NULL,
  `supportedTimeframes` JSON NULL,
  `status` ENUM('DRAFT', 'CANDIDATE', 'TESTING', 'PAPER', 'REJECTED', 'CHALLENGER', 'CHAMPION', 'LIVE_ELIGIBLE', 'LIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `trading_strategy_versions_strategyId_version_key`(`strategyId`, `version`),
  INDEX `trading_strategy_versions_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `trading_strategy_versions_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`),
  CONSTRAINT `trading_strategy_versions_strategyId_fkey` FOREIGN KEY (`strategyId`) REFERENCES `trading_strategies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `trading_strategy_versions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `trading_generations` (
  `id` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `number` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'RUNNING', 'EVALUATING', 'COMPLETED', 'FAILED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `populationTarget` INTEGER NOT NULL DEFAULT 100,
  `metadata` JSON NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `trading_generations_createdById_number_key`(`createdById`, `number`),
  INDEX `trading_generations_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `trading_generations_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `trading_bots`
  ADD COLUMN `strategyVersionId` VARCHAR(191) NULL,
  ADD COLUMN `generationId` VARCHAR(191) NULL,
  ADD COLUMN `parentBotId` VARCHAR(191) NULL,
  ADD COLUMN `riskProfileId` VARCHAR(191) NULL,
  ADD COLUMN `lifecycleStatus` ENUM('DRAFT', 'CANDIDATE', 'TESTING', 'PAPER', 'REJECTED', 'CHALLENGER', 'CHAMPION', 'LIVE_ELIGIBLE', 'LIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `startingPaperBalance` DECIMAL(36,18) NOT NULL DEFAULT 100,
  ADD INDEX `trading_bots_strategyVersionId_lifecycleStatus_idx`(`strategyVersionId`, `lifecycleStatus`),
  ADD INDEX `trading_bots_generationId_lifecycleStatus_idx`(`generationId`, `lifecycleStatus`),
  ADD INDEX `trading_bots_parentBotId_idx`(`parentBotId`),
  ADD INDEX `trading_bots_riskProfileId_idx`(`riskProfileId`),
  ADD CONSTRAINT `trading_bots_strategyVersionId_fkey` FOREIGN KEY (`strategyVersionId`) REFERENCES `trading_strategy_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `trading_bots_generationId_fkey` FOREIGN KEY (`generationId`) REFERENCES `trading_generations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `trading_bots_parentBotId_fkey` FOREIGN KEY (`parentBotId`) REFERENCES `trading_bots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `trading_bots_riskProfileId_fkey` FOREIGN KEY (`riskProfileId`) REFERENCES `trading_risk_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `market_regime_snapshots` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `symbol` VARCHAR(40) NOT NULL,
  `timeframe` VARCHAR(20) NOT NULL,
  `regime` ENUM('TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'BREAKOUT', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'CHAOTIC', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  `confidence` DECIMAL(5,4) NOT NULL DEFAULT 0,
  `features` JSON NULL,
  `observedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `market_regime_snapshots_symbol_timeframe_observedAt_idx`(`symbol`, `timeframe`, `observedAt`),
  INDEX `market_regime_snapshots_regime_observedAt_idx`(`regime`, `observedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `paper_trades` (
  `id` VARCHAR(191) NOT NULL,
  `tradingBotId` VARCHAR(191) NOT NULL,
  `strategyVersionId` VARCHAR(191) NULL,
  `marketRegimeSnapshotId` BIGINT UNSIGNED NULL,
  `symbol` VARCHAR(40) NOT NULL,
  `side` ENUM('BUY', 'SELL') NOT NULL,
  `status` ENUM('OPEN', 'CLOSED', 'LIQUIDATED', 'CANCELED') NOT NULL DEFAULT 'OPEN',
  `entryPrice` DECIMAL(36,18) NOT NULL,
  `exitPrice` DECIMAL(36,18) NULL,
  `quantity` DECIMAL(36,18) NOT NULL,
  `leverage` INTEGER NOT NULL DEFAULT 1,
  `fees` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `funding` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `slippageCost` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `realizedPnl` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `openedAt` DATETIME(3) NOT NULL,
  `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `paper_trades_tradingBotId_openedAt_idx`(`tradingBotId`, `openedAt`),
  INDEX `paper_trades_strategyVersionId_openedAt_idx`(`strategyVersionId`, `openedAt`),
  INDEX `paper_trades_symbol_status_openedAt_idx`(`symbol`, `status`, `openedAt`),
  INDEX `paper_trades_marketRegimeSnapshotId_idx`(`marketRegimeSnapshotId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `paper_trades_tradingBotId_fkey` FOREIGN KEY (`tradingBotId`) REFERENCES `trading_bots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paper_trades_strategyVersionId_fkey` FOREIGN KEY (`strategyVersionId`) REFERENCES `trading_strategy_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `paper_trades_marketRegimeSnapshotId_fkey` FOREIGN KEY (`marketRegimeSnapshotId`) REFERENCES `market_regime_snapshots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bot_metrics` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tradingBotId` VARCHAR(191) NOT NULL,
  `strategyVersionId` VARCHAR(191) NULL,
  `marketRegimeSnapshotId` BIGINT UNSIGNED NULL,
  `startingBalance` DECIMAL(36,18) NOT NULL,
  `currentEquity` DECIMAL(36,18) NOT NULL,
  `realizedPnl` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `unrealizedPnl` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `netPnl` DECIMAL(36,18) NOT NULL DEFAULT 0,
  `totalTrades` INTEGER NOT NULL DEFAULT 0,
  `wins` INTEGER NOT NULL DEFAULT 0,
  `losses` INTEGER NOT NULL DEFAULT 0,
  `maxDrawdown` DECIMAL(12,6) NOT NULL DEFAULT 0,
  `score` DECIMAL(8,4) NULL,
  `metrics` JSON NULL,
  `snapshotAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `bot_metrics_tradingBotId_snapshotAt_idx`(`tradingBotId`, `snapshotAt`),
  INDEX `bot_metrics_strategyVersionId_snapshotAt_idx`(`strategyVersionId`, `snapshotAt`),
  INDEX `bot_metrics_marketRegimeSnapshotId_snapshotAt_idx`(`marketRegimeSnapshotId`, `snapshotAt`),
  INDEX `bot_metrics_score_snapshotAt_idx`(`score`, `snapshotAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `bot_metrics_tradingBotId_fkey` FOREIGN KEY (`tradingBotId`) REFERENCES `trading_bots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `bot_metrics_strategyVersionId_fkey` FOREIGN KEY (`strategyVersionId`) REFERENCES `trading_strategy_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `bot_metrics_marketRegimeSnapshotId_fkey` FOREIGN KEY (`marketRegimeSnapshotId`) REFERENCES `market_regime_snapshots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `champion_candidates` (
  `id` VARCHAR(191) NOT NULL,
  `tradingBotId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'ELIGIBLE', 'PROMOTED', 'REJECTED', 'DEMOTED') NOT NULL DEFAULT 'PENDING',
  `score` DECIMAL(8,4) NULL,
  `evidence` JSON NULL,
  `evaluatedAt` DATETIME(3) NULL,
  `promotedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `champion_candidates_tradingBotId_createdAt_idx`(`tradingBotId`, `createdAt`),
  INDEX `champion_candidates_status_score_idx`(`status`, `score`),
  PRIMARY KEY (`id`),
  CONSTRAINT `champion_candidates_tradingBotId_fkey` FOREIGN KEY (`tradingBotId`) REFERENCES `trading_bots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
