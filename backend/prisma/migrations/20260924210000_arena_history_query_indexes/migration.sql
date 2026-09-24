CREATE INDEX `arena_decision_pair_latest_idx` ON `trading_bot_decisions` (`userId`, `exchangeAccountId`, `type`, `mode`, `symbol`, `occurredAt`, `id`);
CREATE INDEX `arena_signal_account_latest_idx` ON `trading_bot_signals` (`userId`, `exchangeAccountId`, `createdAt`, `id`);
CREATE INDEX `audit_user_action_latest_idx` ON `trading_audit_logs` (`userId`, `action`, `createdAt`);
