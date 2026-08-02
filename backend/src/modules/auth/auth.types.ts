import type { UserCapabilityStatus, UserCapabilityType, UserRole, UserStatus } from '@prisma/client';

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  role: UserRole;
  status: UserStatus;
  accountStatus: UserStatus;
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  authProviders: Array<'PASSWORD' | 'GOOGLE'>;
  profileRoles: Array<{ slug: string; name: string }>;
  capabilities: Array<{ type: UserCapabilityType; status: UserCapabilityStatus; appliedAt: Date; approvedAt: Date | null; rejectedAt: Date | null }>;
};

export type RequestMetadata = { ipAddress: string | null; userAgent: string | null };
export type AuthResult = { accessToken: string; user: PublicUser };
