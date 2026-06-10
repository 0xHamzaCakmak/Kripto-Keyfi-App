import { getCurrentUser } from './userService';

export type MockAuthUser = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatar: string;
  walletAddress?: string;
  isLoggedIn: boolean;
  isEmailVerified: boolean;
  isGoogleConnected: boolean;
  isWalletConnected: boolean;
  trustScore: number;
  reputationScore: number;
  roles: string[];
  pendingRoles: string[];
  onboardingCompleted: boolean;
};

const AUTH_KEY = 'kripto-keyfi-auth-state';

function buildUser(overrides: Partial<MockAuthUser> = {}): MockAuthUser {
  const user = getCurrentUser();
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    walletAddress: overrides.isWalletConnected ? user.walletAddress : undefined,
    isLoggedIn: true,
    isEmailVerified: true,
    isGoogleConnected: false,
    isWalletConnected: false,
    trustScore: user.trustScore,
    reputationScore: user.reputationScore,
    roles: user.roles.filter((role) => role.status === 'verified').map((role) => role.id),
    pendingRoles: user.roles.filter((role) => role.status === 'pending' || role.status === 'verification_pending').map((role) => role.id),
    onboardingCompleted: false,
    ...overrides
  };
}

export function getAuthState(): MockAuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(user: MockAuthUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('kripto-keyfi-auth-change'));
  return user;
}

export function loginWithEmail(email: string, password: string) {
  if (!/.+@.+\..+/.test(email)) throw new Error('Geçerli bir e-posta adresi girin.');
  if (password.length < 8) throw new Error('Şifre en az 8 karakter olmalı.');
  return saveAuth(buildUser({ email }));
}

export function registerWithEmail(data: { fullName: string; username: string; email: string; password: string; confirmPassword: string }) {
  if (!data.fullName.trim()) throw new Error('Ad soyad boş olamaz.');
  if (!data.username.trim()) throw new Error('Kullanıcı adı boş olamaz.');
  if (!/.+@.+\..+/.test(data.email)) throw new Error('Geçerli bir e-posta adresi girin.');
  if (data.password.length < 8) throw new Error('Şifre en az 8 karakter olmalı.');
  if (data.password !== data.confirmPassword) throw new Error('Şifreler eşleşmeli.');
  return saveAuth(buildUser({ fullName: data.fullName, username: data.username, email: data.email }));
}

export function loginWithGoogleMock() {
  return saveAuth(buildUser({ isGoogleConnected: true }));
}

export function loginWithWalletMock() {
  const user = getCurrentUser();
  return saveAuth(buildUser({ isWalletConnected: true, walletAddress: user.walletAddress }));
}

export function updateAuthState(patch: Partial<MockAuthUser>) {
  const current = getAuthState() || buildUser();
  return saveAuth({ ...current, ...patch });
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event('kripto-keyfi-auth-change'));
}
