-- PAPER/TRAINING concurrency is intentionally independent from Futures
-- Testnet/LIVE account limits. Existing profiles receive the requested
-- simulation capacity; no live-facing limit is changed.
ALTER TABLE `trading_risk_profiles`
  ADD COLUMN `paperMaxOpenPositions` INTEGER NOT NULL DEFAULT 100 AFTER `maxOpenPositions`;
