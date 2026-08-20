export const autonomousTradingStatuses = [
  'DRAFT',
  'CANDIDATE',
  'TESTING',
  'PAPER',
  'REJECTED',
  'CHALLENGER',
  'CHAMPION',
  'LIVE_ELIGIBLE',
  'LIVE',
  'PAUSED',
  'ARCHIVED',
] as const;

export type AutonomousTradingStatus = (typeof autonomousTradingStatuses)[number];

export const marketRegimes = [
  'TRENDING_UP',
  'TRENDING_DOWN',
  'RANGING',
  'BREAKOUT',
  'HIGH_VOLATILITY',
  'LOW_VOLATILITY',
  'CHAOTIC',
  'UNKNOWN',
] as const;

export type MarketRegime = (typeof marketRegimes)[number];

export const autonomousBotModes = ['PAPER', 'SHADOW'] as const;
export type AutonomousBotMode = (typeof autonomousBotModes)[number];

export const DEFAULT_AUTONOMOUS_BOT_MODE: AutonomousBotMode = 'PAPER';
export const LIVE_TRADING_DEFAULT_ENABLED = false as const;

export function isAutonomousTradingStatus(value: string): value is AutonomousTradingStatus {
  return autonomousTradingStatuses.includes(value as AutonomousTradingStatus);
}

export function isMarketRegime(value: string): value is MarketRegime {
  return marketRegimes.includes(value as MarketRegime);
}
