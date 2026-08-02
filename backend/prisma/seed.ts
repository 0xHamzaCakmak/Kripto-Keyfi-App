import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { hashPassword } from '../src/security/password.js';

type SeedClient = Pick<PrismaClient, 'user'>;

export async function seedAdmin(client: SeedClient, input: { email: string; password: string; name: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await client.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { created: false, id: existing.id };
  const passwordHash = await hashPassword(input.password);
  const user = await client.user.create({
    data: { email, username: 'admin', passwordHash, name: input.name.trim(), role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    select: { id: true },
  });
  return { created: true, id: user.id };
}

async function main() {
  const input = z.object({
    INITIAL_ADMIN_EMAIL: z.string().email(),
    INITIAL_ADMIN_PASSWORD: z.string().min(12),
    INITIAL_ADMIN_NAME: z.string().trim().min(1),
  }).parse(process.env);
  const client = new PrismaClient();
  try {
    const result = await seedAdmin(client, {
      email: input.INITIAL_ADMIN_EMAIL, password: input.INITIAL_ADMIN_PASSWORD, name: input.INITIAL_ADMIN_NAME,
    });
    console.info(result.created ? 'Initial admin created.' : 'Initial admin already exists; no changes made.');
  } finally {
    await client.$disconnect();
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((error: unknown) => {
    console.error('Admin seed failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  });
}
