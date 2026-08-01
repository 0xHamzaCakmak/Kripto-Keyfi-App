import { ExchangeConnectionStatus, UserRole, UserStatus } from '@prisma/client';
import type { ExchangeAccountType, ExchangeEnvironment, ExchangeProvider } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestUser = {
  id: string; email: string; passwordHash: string; name: string; role: UserRole; status: UserStatus;
  mustChangePassword: boolean; lastLoginAt: Date | null; createdAt: Date; updatedAt: Date;
};
type TestSession = {
  id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null;
  ipAddress: string | null; userAgent: string | null; createdAt: Date; updatedAt: Date;
};

const users: TestUser[] = [];
const sessions: TestSession[] = [];
type TestExchangeAccount = {
  id: string; userId: string; name: string; provider: ExchangeProvider; environment: ExchangeEnvironment;
  accountType: ExchangeAccountType; apiKeyEncrypted: string; apiSecretEncrypted: string; passphraseEncrypted: string | null;
  apiKeyHint: string; description: string | null; isActive: boolean; connectionStatus: ExchangeConnectionStatus;
  canTrade: boolean; withdrawalEnabled: boolean; lastConnectedAt: Date | null; lastSyncAt: Date | null;
  createdAt: Date; updatedAt: Date;
};
const exchangeAccounts: TestExchangeAccount[] = [];

const selectUser = (user: TestUser) => {
  return {
    id: user.id, email: user.email, name: user.name, role: user.role, status: user.status,
    mustChangePassword: user.mustChangePassword, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt,
  };
};

const prismaMock = {
  user: {
    findUnique: vi.fn(async ({ where, select }: { where: { id?: string; email?: string }; select?: unknown }) => {
      const user = users.find((item) => item.id === where.id || item.email === where.email) ?? null;
      return user && select ? selectUser(user) : user;
    }),
    update: vi.fn(async ({ where, data, select }: { where: { id: string }; data: Partial<TestUser>; select?: unknown }) => {
      const user = users.find((item) => item.id === where.id)!;
      Object.assign(user, data, { updatedAt: new Date() });
      return select ? selectUser(user) : user;
    }),
    count: vi.fn(async () => users.length),
  },
  refreshSession: {
    create: vi.fn(async ({ data }: { data: Omit<TestSession, 'createdAt' | 'updatedAt' | 'revokedAt'> & { revokedAt?: Date | null } }) => {
      const session = { ...data, revokedAt: data.revokedAt ?? null, createdAt: new Date(), updatedAt: new Date() };
      sessions.push(session);
      return session;
    }),
    findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: unknown }) => {
      const session = sessions.find((item) => item.id === where.id);
      if (!session) return null;
      const user = users.find((item) => item.id === session.userId)!;
      return include ? { ...session, user: selectUser(user) } : session;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; userId?: string; tokenHash?: string; revokedAt?: null }; data: { revokedAt: Date } }) => {
      const matches = sessions.filter((item) => item.id === where.id && (!where.userId || item.userId === where.userId) && (!where.tokenHash || item.tokenHash === where.tokenHash) && (where.revokedAt !== null || item.revokedAt === null));
      matches.forEach((item) => { item.revokedAt = data.revokedAt; });
      return { count: matches.length };
    }),
  },
  exchangeAccount: {
    count: vi.fn(async ({ where }: { where: { userId?: string; isActive?: boolean; connectionStatus?: ExchangeConnectionStatus } }) =>
      exchangeAccounts.filter((item) => (!where.userId || item.userId === where.userId) && (where.isActive === undefined || item.isActive === where.isActive) && (!where.connectionStatus || item.connectionStatus === where.connectionStatus)).length),
    findMany: vi.fn(async ({ where, select }: { where: { userId: string }; select: Record<string, boolean> }) =>
      exchangeAccounts.filter((item) => item.userId === where.userId).map((item) => selectFields(item, select))),
    create: vi.fn(async ({ data, select }: { data: Partial<TestExchangeAccount>; select: Record<string, boolean> }) => {
      const now = new Date();
      const account = {
        id: `exchange-${exchangeAccounts.length + 1}`, passphraseEncrypted: null, description: null,
        isActive: true, connectionStatus: ExchangeConnectionStatus.CONNECTED, lastSyncAt: null,
        createdAt: now, updatedAt: now, ...data,
      } as TestExchangeAccount;
      exchangeAccounts.push(account);
      return selectFields(account, select);
    }),
    findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
      exchangeAccounts.find((item) => item.id === where.id && item.userId === where.userId) ?? null),
    update: vi.fn(async ({ where, data, select }: { where: { id: string }; data: Partial<TestExchangeAccount>; select?: Record<string, boolean> }) => {
      const account = exchangeAccounts.find((item) => item.id === where.id)!;
      Object.assign(account, data, { updatedAt: new Date() });
      return select ? selectFields(account, select) : account;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const index = exchangeAccounts.findIndex((item) => item.id === where.id);
      return exchangeAccounts.splice(index, 1)[0];
    }),
  },
  $transaction: vi.fn(async (input: unknown) => typeof input === 'function' ? (input as (client: typeof prismaMock) => unknown)(prismaMock) : Promise.all(input as Promise<unknown>[])),
  $queryRaw: vi.fn(async () => [{ ok: 1 }]),
};

function selectFields<T extends object>(value: T, select: Record<string, boolean>) {
  return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, value[key as keyof T]]));
}

vi.mock('../src/database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../src/security/password.js', () => ({
  verifyPassword: vi.fn(async (hash: string, password: string) => hash === password),
}));
vi.mock('../src/security/tokens.js', () => ({
  hashToken: (token: string) => `hash:${token}`,
  signAccessToken: vi.fn(async ({ sub, role, sid }: { sub: string; role: UserRole; sid: string }) => `access:${role}:${sub}:${sid}`),
  signRefreshToken: vi.fn(async ({ sub, sid }: { sub: string; sid: string }) => `refresh:${sub}:${sid}`),
  verifyAccessToken: vi.fn(async (token: string) => {
    const [kind, role, sub, sid] = token.split(':');
    if (kind !== 'access' || !role || !sub || !sid) throw new Error('invalid');
    return { role: role as UserRole, sub, sid };
  }),
  verifyRefreshToken: vi.fn(async (token: string) => {
    const [kind, sub, sid] = token.split(':');
    if (kind !== 'refresh' || !sub || !sid) throw new Error('invalid');
    return { sub, sid };
  }),
}));
vi.mock('../src/modules/trading/exchanges/exchange-adapter.factory.js', () => ({
  createExchangeAdapter: vi.fn(() => ({
    validateCredentials: vi.fn(async () => ({ canTrade: true, withdrawalEnabled: false })),
    getBalances: vi.fn(async () => [{ walletType: 'USD_M_FUTURES' as const, asset: 'USDT', walletBalance: '100', availableBalance: '90', unrealizedPnl: '0' }]),
  })),
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

function addUser(overrides: Partial<TestUser> = {}) {
  const user: TestUser = {
    id: `user-${users.length + 1}`, email: `user${users.length + 1}@example.com`, passwordHash: 'correct-password',
    name: 'Test User', role: UserRole.USER, status: UserStatus.ACTIVE, mustChangePassword: false,
    lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  users.push(user);
  return user;
}

const cookieValue = (response: request.Response) => {
  const setCookie = response.headers['set-cookie'];
  const line = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return line!.split(';')[0];
};

beforeEach(() => { users.splice(0); sessions.splice(0); exchangeAccounts.splice(0); vi.clearAllMocks(); });

describe('authentication and admin API', () => {
  it('logs an active admin in with the correct credentials', async () => {
    addUser({ role: UserRole.ADMIN, email: 'admin@example.com' });
    const response = await request(app).post('/api/auth/login').send({ email: 'ADMIN@example.com', password: 'correct-password' });
    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe('ADMIN');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('never returns passwordHash in a login response', async () => {
    addUser({ role: UserRole.ADMIN, email: 'private@example.com' });
    const response = await request(app).post('/api/auth/login').send({ email: 'private@example.com', password: 'correct-password' });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('rejects a wrong password', async () => {
    addUser({ email: 'active@example.com' });
    expect((await request(app).post('/api/auth/login').send({ email: 'active@example.com', password: 'wrong-password' })).status).toBe(401);
  });

  it('rejects a passive user', async () => {
    addUser({ email: 'passive@example.com', status: UserStatus.PASSIVE });
    expect((await request(app).post('/api/auth/login').send({ email: 'passive@example.com', password: 'correct-password' })).status).toBe(403);
  });

  it('returns 401 for /me without a token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('forbids a normal user on the dashboard', async () => {
    const normal = addUser();
    expect((await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer access:USER:${normal.id}:session`)).status).toBe(403);
  });

  it('allows an admin on the dashboard', async () => {
    addUser();
    const admin = addUser({ role: UserRole.ADMIN });
    const response = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer access:ADMIN:${admin.id}:session`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ userCount: 2, activeBotCount: 0, connectedExchangeCount: 0 });
  });

  it('protects the trading module and keeps live trading disabled', async () => {
    const normal = addUser();
    const admin = addUser({ role: UserRole.ADMIN });

    const forbidden = await request(app).get('/api/admin/trading/overview')
      .set('Authorization', `Bearer access:USER:${normal.id}:session`);
    expect(forbidden.status).toBe(403);

    const response = await request(app).get('/api/admin/trading/overview')
      .set('Authorization', `Bearer access:ADMIN:${admin.id}:session`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      moduleStatus: 'PHASE_FOUR_REALTIME_READY',
      engineStatus: 'PRIVATE_STREAM_READY',
      liveTradingEnabled: false,
      globalKillSwitch: false,
    });
  });

  it('creates and lists an owned testnet exchange account without leaking credentials', async () => {
    const admin = addUser({ role: UserRole.ADMIN });
    const authorization = `Bearer access:ADMIN:${admin.id}:session`;
    const response = await request(app).post('/api/admin/trading/exchange-accounts')
      .set('Authorization', authorization)
      .send({
        name: 'Binance Test', provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M',
        apiKey: 'test-api-key-1234', apiSecret: 'test-api-secret-5678',
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ name: 'Binance Test', apiKeyHint: 'test********1234', canTrade: true });
    expect(JSON.stringify(response.body)).not.toContain('test-api-secret-5678');
    expect(JSON.stringify(response.body)).not.toContain('apiSecretEncrypted');

    const list = await request(app).get('/api/admin/trading/exchange-accounts').set('Authorization', authorization);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain('Encrypted');
  });

  it('forbids a normal user from listing exchange accounts', async () => {
    const normal = addUser();
    const response = await request(app).get('/api/admin/trading/exchange-accounts')
      .set('Authorization', `Bearer access:USER:${normal.id}:session`);
    expect(response.status).toBe(403);
  });

  it('rotates refresh tokens and rejects the previous token', async () => {
    addUser({ role: UserRole.ADMIN, email: 'admin@example.com' });
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'correct-password' });
    const oldCookie = cookieValue(login);
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(rotated.status).toBe(200);
    expect(cookieValue(rotated)).not.toBe(oldCookie);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', oldCookie)).status).toBe(401);
  });

  it('revokes the refresh session on idempotent logout', async () => {
    addUser({ email: 'logout@example.com' });
    const login = await request(app).post('/api/auth/login').send({ email: 'logout@example.com', password: 'correct-password' });
    const cookie = cookieValue(login);
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });
});
