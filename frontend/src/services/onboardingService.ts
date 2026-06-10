import { updateAuthState } from './authService';

const ONBOARDING_KEY = 'kripto-keyfi-onboarding';

export function completeOnboarding(selections: string[]) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ selections, completedAt: new Date().toISOString() }));
  return updateAuthState({ onboardingCompleted: true });
}

export function getOnboardingSelections(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}').selections || [];
  } catch {
    return [];
  }
}
