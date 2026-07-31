import type { UserRole, UserStatus } from '@prisma/client';

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type RequestMetadata = { ipAddress: string | null; userAgent: string | null };
export type AuthResult = { accessToken: string; user: PublicUser };

