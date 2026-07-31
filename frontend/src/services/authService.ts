import { api, setAccessToken } from './apiClient';
import { getCurrentUser } from './userService';

export type UserRole = 'ADMIN' | 'USER';
export type ApiUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: 'ACTIVE' | 'PASSIVE' | 'SUSPENDED';
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

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
  backendRole?: UserRole;
};

let authState: MockAuthUser | null = null;
let restorePromise: Promise<MockAuthUser> | null = null;

function fromApiUser(apiUser: ApiUser): MockAuthUser {
  const fallback = getCurrentUser();
  const displayName = apiUser.name?.trim() || apiUser.email.split('@')[0];
  return {
    id: apiUser.id,
    fullName: displayName,
    username: displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'user',
    email: apiUser.email,
    avatar: fallback.avatar,
    isLoggedIn: true,
    isEmailVerified: true,
    isGoogleConnected: false,
    isWalletConnected: false,
    trustScore: 0,
    reputationScore: 0,
    roles: [apiUser.role.toLowerCase()],
    pendingRoles: [],
    onboardingCompleted: true,
    backendRole: apiUser.role,
  };
}

function publish(user: MockAuthUser | null) {
  authState = user;
  window.dispatchEvent(new Event('kripto-keyfi-auth-change'));
  return user;
}

export const getAuthState = () => authState;

export async function loginWithEmail(email: string, password: string) {
  const response = await api.post<{ data: { accessToken: string; user: ApiUser } }>('/auth/login', { email, password });
  setAccessToken(response.data.data.accessToken);
  return publish(fromApiUser(response.data.data.user))!;
}

export async function restoreSession() {
  restorePromise ??= api.post<{ data: { accessToken: string; user: ApiUser } }>('/auth/refresh')
    .then((response) => {
      setAccessToken(response.data.data.accessToken);
      return publish(fromApiUser(response.data.data.user))!;
    })
    .finally(() => { restorePromise = null; });
  return restorePromise;
}

export async function logout() {
  try { await api.post('/auth/logout'); } finally {
    setAccessToken(null);
    publish(null);
  }
}

function buildMockUser(overrides: Partial<MockAuthUser> = {}) {
  const user = getCurrentUser();
  return publish({
    id: user.id, fullName: user.fullName, username: user.username, email: user.email, avatar: user.avatar,
    isLoggedIn: true, isEmailVerified: true, isGoogleConnected: false, isWalletConnected: false,
    trustScore: user.trustScore, reputationScore: user.reputationScore,
    roles: user.roles.filter((role) => role.status === 'verified').map((role) => role.id),
    pendingRoles: user.roles.filter((role) => role.status === 'pending' || role.status === 'verification_pending').map((role) => role.id),
    onboardingCompleted: false, ...overrides,
  })!;
}

export function registerWithEmail(data: { fullName: string; username: string; email: string; password: string; confirmPassword: string }) {
  if (!data.fullName.trim() || !data.username.trim()) throw new Error('Ad soyad ve kullanıcı adı boş olamaz.');
  if (!/.+@.+\..+/.test(data.email) || data.password.length < 8 || data.password !== data.confirmPassword) throw new Error('Kayıt bilgilerini kontrol edin.');
  return buildMockUser({ fullName: data.fullName, username: data.username, email: data.email });
}

export const loginWithGoogleMock = () => buildMockUser({ isGoogleConnected: true });
export const loginWithWalletMock = () => buildMockUser({ isWalletConnected: true, walletAddress: getCurrentUser().walletAddress });
export const updateAuthState = (patch: Partial<MockAuthUser>) => buildMockUser({ ...(authState ?? {}), ...patch });
