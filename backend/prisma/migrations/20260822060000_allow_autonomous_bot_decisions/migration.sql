-- Additive runtime compatibility for Bot Factory decisions.
-- Existing SCALPING/GRID decision rows remain unchanged.
ALTER TABLE `trading_bot_decisions`
  MODIFY `type` ENUM('SCALPING', 'GRID', 'AUTONOMOUS') NOT NULL;
