import { ApiError } from '../../utils/api-error.js';

type ExecutionSafetyInput = {
  executionEngine: 'TYPESCRIPT' | 'GO';
  reduceOnly: boolean;
};

/**
 * Risk-increasing exchange writes must be owned by the Go executor so the
 * immutable, fail-closed Risk Engine runs immediately before submission.
 * TypeScript remains available only for risk-reducing emergency exits.
 */
export function assertCentralRiskExecution(input: ExecutionSafetyInput) {
  if (input.executionEngine === 'TYPESCRIPT' && !input.reduceOnly) {
    throw new ApiError(
      409,
      'Risk artıran emirler merkezi Risk Engine üzerinden gönderilmelidir. Hesabı kontrollü GO executor cutover akışına geçirin.',
      'CENTRAL_RISK_ENGINE_REQUIRED',
    );
  }
}
