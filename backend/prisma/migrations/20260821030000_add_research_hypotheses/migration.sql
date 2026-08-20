-- PROMPT 12: additive, non-executing research hypotheses.
CREATE TABLE `research_hypotheses` (
  `id` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `hypothesis` VARCHAR(1500) NOT NULL,
  `evidence` JSON NOT NULL,
  `targetStrategyFamily` ENUM('GRID', 'TREND', 'SMA_CROSSOVER', 'EMA_TREND', 'MACD_TREND', 'RSI_MEAN_REVERSION', 'BOLLINGER_MEAN_REVERSION', 'DONCHIAN_BREAKOUT', 'ATR_BREAKOUT', 'MOMENTUM', 'VOLUME_SPIKE', 'FUNDING_SKEW', 'BASIS_ARBITRAGE', 'NEWS_REACTIVE', 'DCA', 'AI_LIMIT', 'MULTI_AGENT', 'CUSTOM') NOT NULL,
  `suggestedChange` JSON NOT NULL,
  `confidence` DECIMAL(5, 4) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  `provider` VARCHAR(40) NOT NULL DEFAULT 'RULE_TEMPLATE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `research_hypotheses_createdById_status_createdAt_idx` (`createdById`, `status`, `createdAt`),
  INDEX `research_hypotheses_targetStrategyFamily_status_confidence_idx` (`targetStrategyFamily`, `status`, `confidence`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
