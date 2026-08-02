import { api, setAccessToken } from './apiClient';
import { getCurrentUser } from './userService';

export type UserRole = 'ADMIN' | 'USER';
export type AccountStatus = 'ACTIVE' | 'PENDING' | 'PASSIVE' | 'SUSPENDED' | 'DELETED';
export type Capability = {
  type: 'CREATOR' | 'AUTHOR' | 'PROJECT_OWNER' | 'DEVELOPER';
  status: 'NOT_APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
};

export type ApiUser = {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  role: UserRole;
  status: AccountStatus;
  accountStatus: AccountStatus;
  mustChangePassword: boolean;
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  authProviders: Array<'PASSWORD' | 'GOOGLE'>;
  profileRoles: Array<{ slug: string; name: string }>;
  capabilities: Capability[];
};

// Kept as a compatibility name while legacy feature modules are phased out.
export type MockAuthUser = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatar: string;
  bio: string;
  walletAddress?: string;
  isLoggedIn: boolean;
  isEmailVerified: boolean;
  isGoogleConnected: boolean;
  isWalletConnected: boolean;
  trustScore: number | null;
  reputationScore: number | null;
  roles: string[];
  pendingRoles: string[];
  capabilities: Capability[];
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  accountStatus: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  backendRole?: UserRole;
};

let authState: MockAuthUser | null = null;
let restorePromise: Promise<MockAuthUser> | null = null;

function fromApiUser(apiUser: ApiUser): MockAuthUser {
  return {
    id: apiUser.id,
    fullName: apiUser.displayName?.trim() || apiUser.username || apiUser.email.split('@')[0],
    username: apiUser.username,
    email: apiUser.email,
    avatar: apiUser.avatarUrl || '',
    bio: apiUser.bio || '',
    isLoggedIn: true,
    isEmailVerified: apiUser.emailVerified,
    isGoogleConnected: apiUser.authProviders.includes('GOOGLE'),
    isWalletConnected: false,
    trustScore: null,
    reputationScore: null,
    roles: apiUser.profileRoles.map((role) => role.slug),
    pendingRoles: apiUser.capabilities.filter((item) => item.status === 'PENDING').map((item) => item.type.toLowerCase()),
    capabilities: apiUser.capabilities,
    profileCompleted: apiUser.profileCompleted,
    onboardingCompleted: apiUser.onboardingCompleted,
    accountStatus: apiUser.accountStatus,
    createdAt: apiUser.createdAt,
    lastLoginAt: apiUser.lastLoginAt,
    backendRole: apiUser.role,
  };
}

function publish(user: MockAuthUser | null) {
  authState = user;
  window.dispatchEvent(new Event('kripto-keyfi-auth-change'));
  return user;
}

export const getAuthState = () => authState;
export const clearAuthState = () => publish(null);

async function readMe() {
  const response = await api.get<{ data: { user: ApiUser } }>('/auth/me');
  return publish(fromApiUser(response.data.data.user))!;
}

export async function loginWithEmail(email: string, password: string) {
  const response = await api.post<{ data: { accessToken: string; user: ApiUser } }>('/auth/login', { email, password });
  setAccessToken(response.data.data.accessToken);
  return publish(fromApiUser(response.data.data.user))!;
}

export async function registerWithEmail(data: {
  fullName: string; username: string; email: string; password: string; confirmPassword: string;
  termsAccepted: boolean; privacyAccepted: boolean;
}) {
  const response = await api.post<{ data: { accessToken: string; user: ApiUser } }>('/auth/register', data);
  setAccessToken(response.data.data.accessToken);
  return publish(fromApiUser(response.data.data.user))!;
}

export async function loginWithGoogle(credential: string, termsAccepted = false, privacyAccepted = false) {
  const response = await api.post<{ data: { accessToken: string; user: ApiUser } }>('/auth/google', {
    credential, termsAccepted, privacyAccepted,
  });
  setAccessToken(response.data.data.accessToken);
  return publish(fromApiUser(response.data.data.user))!;
}

export async function restoreSession() {
  restorePromise ??= api.post<{ data: { accessToken: string } }>('/auth/refresh')
    .then(async (response) => {
      setAccessToken(response.data.data.accessToken);
      return readMe();
    })
    .finally(() => { restorePromise = null; });
  return restorePromise;
}

export async function updateMyProfile(input: { displayName: string; username: string; bio: string | null; avatarUrl: string | null }) {
  const response = await api.patch<{ data: { user: ApiUser } }>('/users/me', input);
  return publish(fromApiUser(response.data.data.user))!;
}

export async function logout() {
  try { await api.post('/auth/logout'); } finally {
    setAccessToken(null);
    publish(null);
  }
}

function buildWalletMock() {
  const user = getCurrentUser();
  return publish({
    ...(authState ?? {
      id: user.id, fullName: user.fullName, username: user.username, email: user.email, avatar: user.avatar, bio: user.bio,
      isLoggedIn: true, isEmailVerified: true, isGoogleConnected: false, trustScore: null, reputationScore: null,
      roles: [], pendingRoles: [], capabilities: [], profileCompleted: false, onboardingCompleted: false,
      accountStatus: 'ACTIVE' as const,
      createdAt: new Date().toISOString(), lastLoginAt: null,
    }),
    isWalletConnected: true,
    walletAddress: user.walletAddress,
  })!;
}

// Wallet authentication remains unchanged and mock-only in this phase.
export const loginWithWalletMock = () => buildWalletMock();
export const updateAuthState = (patch: Partial<MockAuthUser>) => publish({ ...(authState ?? buildWalletMock()), ...patch })!;
