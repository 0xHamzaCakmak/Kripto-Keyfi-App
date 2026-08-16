import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import type { PublicUser } from '../auth/auth.types.js';
import type { UpdateMeInput } from './user.schema.js';
import { publicUserSelect, serializePublicUser } from './user.presenter.js';

export const countUsers = () => prisma.user.count({ where: { status: { not: UserStatus.DELETED } } });

export async function updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, username: true, bio: true } });
  if (!current) throw new ApiError(404, 'Kullanıcı bulunamadı.', 'USER_NOT_FOUND');

  const displayName = input.displayName ?? current.name;
  const username = input.username ?? current.username;
  const bio = input.bio === undefined ? current.bio : input.bio;
  const profileCompleted = Boolean(displayName?.trim() && username.trim() && bio?.trim());

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName === undefined ? {} : { name: input.displayName }),
        ...(input.username === undefined ? {} : { username: input.username }),
        ...(input.bio === undefined ? {} : { bio: input.bio || null }),
        ...(input.avatarUrl === undefined ? {} : { avatarUrl: input.avatarUrl }),
        profileCompleted,
      },
      select: publicUserSelect,
    });
    return serializePublicUser(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'Bu kullanıcı adı daha önce alınmış.', 'USERNAME_ALREADY_EXISTS');
    }
    throw error;
  }
}
