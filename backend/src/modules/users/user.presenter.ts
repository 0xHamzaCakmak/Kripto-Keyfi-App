import type { Prisma } from '@prisma/client';
import type { PublicUser } from '../auth/auth.types.js';

export const publicUserSelect = {
  id: true,
  email: true,
  passwordHash: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
  emailVerifiedAt: true,
  role: true,
  status: true,
  mustChangePassword: true,
  profileCompleted: true,
  onboardingCompleted: true,
  lastLoginAt: true,
  createdAt: true,
  identities: { select: { provider: true } },
  profileRoles: { where: { role: { isActive: true } }, select: { role: { select: { slug: true, name: true } } } },
  capabilities: { select: { type: true, status: true, appliedAt: true, approvedAt: true, rejectedAt: true } },
} satisfies Prisma.UserSelect;

export type SelectedPublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export function serializePublicUser(user: SelectedPublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    emailVerified: Boolean(user.emailVerifiedAt),
    emailVerifiedAt: user.emailVerifiedAt,
    role: user.role,
    status: user.status,
    accountStatus: user.status,
    mustChangePassword: user.mustChangePassword,
    profileCompleted: user.profileCompleted,
    onboardingCompleted: user.onboardingCompleted,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    authProviders: [...(user.passwordHash ? ['PASSWORD' as const] : []), ...user.identities.map((item) => item.provider)],
    profileRoles: user.profileRoles.map((item) => item.role),
    capabilities: user.capabilities,
  };
}
