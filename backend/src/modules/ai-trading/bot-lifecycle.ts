import { ApiError } from '../../utils/api-error.js';
import type { AutonomousTradingStatus } from './core-domain.js';

const allowedTransitions: Record<AutonomousTradingStatus, readonly AutonomousTradingStatus[]> = {
  DRAFT: ['CANDIDATE', 'REJECTED', 'ARCHIVED'],
  CANDIDATE: ['TESTING', 'REJECTED', 'ARCHIVED'],
  TESTING: ['PAPER', 'REJECTED', 'PAUSED', 'ARCHIVED'],
  PAPER: ['CHALLENGER', 'REJECTED', 'PAUSED', 'ARCHIVED'],
  REJECTED: ['ARCHIVED'],
  CHALLENGER: ['CHAMPION', 'REJECTED', 'PAUSED', 'ARCHIVED'],
  CHAMPION: ['LIVE_ELIGIBLE', 'PAUSED', 'ARCHIVED'],
  LIVE_ELIGIBLE: ['LIVE', 'PAUSED', 'ARCHIVED'],
  LIVE: ['PAUSED', 'ARCHIVED'],
  PAUSED: ['PAPER', 'ARCHIVED'],
  ARCHIVED: [],
};

export function canTransitionBotLifecycle(
  from: AutonomousTradingStatus,
  to: AutonomousTradingStatus,
  liveTradingEnabled = false,
) {
  if (to === 'LIVE' && !liveTradingEnabled) return false;
  return allowedTransitions[from].includes(to);
}

export function assertBotLifecycleTransition(
  from: AutonomousTradingStatus,
  to: AutonomousTradingStatus,
  liveTradingEnabled = false,
) {
  if (to === 'LIVE' && !liveTradingEnabled) {
    throw new ApiError(403, 'Live trading is disabled for Bot Factory.', 'AUTONOMOUS_LIVE_DISABLED');
  }
  if (!canTransitionBotLifecycle(from, to, liveTradingEnabled)) {
    throw new ApiError(409, `${from} -> ${to} lifecycle transition is invalid.`, 'INVALID_BOT_LIFECYCLE_TRANSITION');
  }
}
