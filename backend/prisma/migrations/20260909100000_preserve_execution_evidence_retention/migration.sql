-- Preserve execution/performance evidence when verbose decisions expire.
ALTER TABLE `trading_bot_paper_fills`
  DROP FOREIGN KEY `trading_bot_paper_fills_decisionId_fkey`,
  MODIFY `decisionId` BIGINT UNSIGNED NULL,
  ADD CONSTRAINT `trading_bot_paper_fills_decisionId_retention_fkey` FOREIGN KEY (`decisionId`) REFERENCES `trading_bot_decisions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `shadow_trades`
  DROP FOREIGN KEY `shadow_trades_decisionId_fkey`,
  MODIFY `decisionId` BIGINT UNSIGNED NULL,
  ADD CONSTRAINT `shadow_trades_decisionId_retention_fkey` FOREIGN KEY (`decisionId`) REFERENCES `trading_bot_decisions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX `trading_outbox_events_eventType_createdAt_id_idx` ON `trading_outbox_events` (`eventType`, `createdAt`, `id`);
