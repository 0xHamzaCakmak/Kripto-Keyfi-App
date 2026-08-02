import { ExchangeConnectionStatus, Prisma, UserRole, UserStatus } from '@prisma/client';
import type { AuthProvider, ExchangeAccountType, ExchangeEnvironment, ExchangeProvider } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestUser = {
  id: string; email: string; passwordHash: string | null; name: string; username: string; avatarUrl: string | null; bio: string | null;
  emailVerifiedAt: Date | null; termsAcceptedAt: Date | null; privacyAcceptedAt: Date | null;
  role: UserRole; status: UserStatus;
  mustChangePassword: boolean; profileCompleted: boolean; onboardingCompleted: boolean; lastLoginAt: Date | null; createdAt: Date; updatedAt: Date;
};
type TestSession = {
  id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null;
  ipAddress: string | null; userAgent: string | null; createdAt: Date; updatedAt: Date;
};

const users: TestUser[] = [];
const sessions: TestSession[] = [];
const identities: Array<{ userId: string; provider: AuthProvider; providerSubject: string; emailAtLink: string }> = [];
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
    id: user.id, email: user.email, passwordHash: user.passwordHash, name: user.name, username: user.username,
    avatarUrl: user.avatarUrl, bio: user.bio, emailVerifiedAt: user.emailVerifiedAt, role: user.role, status: user.status,
    mustChangePassword: user.mustChangePassword, profileCompleted: user.profileCompleted, onboardingCompleted: user.onboardingCompleted,
    lastLoginAt: user.lastLoginAt, createdAt: user.createdAt,
    identities: identities.filter((item) => item.userId === user.id).map((item) => ({ provider: item.provider })),
    profileRoles: [],
    capabilities: [],
  };
};

const prismaMock = {
  user: {
    findUnique: vi.fn(async ({ where, select }: { where: { id?: string; email?: string; username?: string }; select?: unknown }) => {
      const user = users.find((item) => item.id === where.id || item.email === where.email || item.username === where.username) ?? null;
      return user && select ? selectUser(user) : user;
    }),
    create: vi.fn(async ({ data, select }: { data: Partial<TestUser> & { identities?: { create: { provider: AuthProvider; providerSubject: string; emailAtLink: string } } }; select?: unknown }) => {
      const now = new Date();
      const nestedIdentity = data.identities?.create;
      const user = { id: `user-${users.length + 1}`, mustChangePassword: false, bio: null, profileCompleted: false, onboardingCompleted: false, lastLoginAt: null, createdAt: now, updatedAt: now, ...data } as TestUser;
      delete (user as TestUser & { identities?: unknown }).identities;
      users.push(user);
      if (nestedIdentity) identities.push({ userId: user.id, ...nestedIdentity });
      return select ? selectUser(user) : user;
    }),
    update: vi.fn(async ({ where, data, select }: { where: { id: string }; data: Partial<TestUser>; select?: unknown }) => {
      const user = users.find((item) => item.id === where.id)!;
      if (data.username && users.some((item) => item.id !== where.id && item.username === data.username)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique username', { code: 'P2002', clientVersion: 'test', meta: { target: ['username'] } });
      }
      Object.assign(user, data, { updatedAt: new Date() });
      return select ? selectUser(user) : user;
    }),
    count: vi.fn(async () => users.length),
  },
  userIdentity: {
    findUnique: vi.fn(async ({ where }: { where: { provider_providerSubject: { provider: AuthProvider; providerSubject: string } } }) => {
      const identity = identities.find((item) => item.provider === where.provider_providerSubject.provider && item.providerSubject === where.provider_providerSubject.providerSubject);
      if (!identity) return null;
      return { ...identity, user: selectUser(users.find((item) => item.id === identity.userId)!) };
    }),
    create: vi.fn(async ({ data }: { data: { userId: string; provider: AuthProvider; providerSubject: string; emailAtLink: string } }) => {
      identities.push(data);
      return data;
    }),
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
  tradingRiskProfile: {
    create: vi.fn(async ({ data }: { data: { userId: string; exchangeAccountId: string } }) => ({
      id: `risk-${data.exchangeAccountId}`, ...data,
    })),
  },
  tradingRiskControl: {
    findUnique: vi.fn(async () => ({ globalKillSwitch: false })),
  },
  tradingOrder: {
    count: vi.fn(async () => 0),
  },
  tradingBot: {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
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
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));
vi.mock('../src/modules/auth/google-identity.js', () => ({
  verifyGoogleCredential: vi.fn(async () => ({
    subject: 'google-subject', email: 'google.user@gmail.com', emailVerified: true,
    name: 'Google User', picture: 'https://example.com/avatar.png', hostedDomain: null,
  })),
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
    name: 'Test User', username: `test_user_${users.length + 1}`, avatarUrl: null, bio: null, emailVerifiedAt: new Date(),
    termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), role: UserRole.USER, status: UserStatus.ACTIVE, mustChangePassword: false, profileCompleted: false, onboardingCompleted: false,
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

beforeEach(() => { users.splice(0); sessions.splice(0); identities.splice(0); exchangeAccounts.splice(0); vi.clearAllMocks(); });

describe('authentication and admin API', () => {
  it('registers a plain user without profile roles and starts a session', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Yeni Kullanıcı', username: 'Çakmak', email: 'yeni@example.com',
      password: 'secure-password', confirmPassword: 'secure-password', termsAccepted: true, privacyAccepted: true,
    });
    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({ role: 'USER', username: 'cakmak', profileRoles: [] });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(users[0]?.passwordHash).toBe('hashed:secure-password');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('registers a first-time Google user only with explicit consent', async () => {
    const response = await request(app).post('/api/auth/google').send({
      credential: 'x'.repeat(120), termsAccepted: true, privacyAccepted: true,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ role: 'USER', authProviders: ['GOOGLE'], profileRoles: [] });
    expect(identities).toHaveLength(1);
  });

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

  it('returns the authenticated user from /me without sensitive fields', async () => {
    const user = addUser({ email: 'me@example.com', bio: 'Web3 meraklısı', profileCompleted: true });
    const response = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer access:USER:${user.id}:session`);
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: user.id, email: 'me@example.com', displayName: 'Test User', accountStatus: 'ACTIVE',
      profileCompleted: true, bio: 'Web3 meraklısı', capabilities: [],
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('updates only the authenticated user profile', async () => {
    const user = addUser({ email: 'profile@example.com' });
    const response = await request(app).patch('/api/users/me')
      .set('Authorization', `Bearer access:USER:${user.id}:session`)
      .send({ displayName: 'Ahmet Çakmak', username: 'ahmet.cakmak', bio: 'Web3 ve kripto ekosistemiyle ilgileniyorum.', avatarUrl: null });
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ displayName: 'Ahmet Çakmak', username: 'ahmet.cakmak', profileCompleted: true });
    expect(users[0]).toMatchObject({ name: 'Ahmet Çakmak', username: 'ahmet.cakmak', role: UserRole.USER, status: UserStatus.ACTIVE });
  });

  it('rejects reserved, duplicate and privilege fields in profile updates', async () => {
    const first = addUser({ username: 'first_user' });
    addUser({ username: 'existing_user' });
    const authorization = `Bearer access:USER:${first.id}:session`;
    expect((await request(app).patch('/api/users/me').set('Authorization', authorization).send({ username: 'admin' })).status).toBe(400);
    expect((await request(app).patch('/api/users/me').set('Authorization', authorization).send({ username: 'existing_user' })).status).toBe(409);
    expect((await request(app).patch('/api/users/me').set('Authorization', authorization).send({ role: 'ADMIN' })).status).toBe(400);
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
      moduleStatus: 'TRADING_ADMIN_READY',
      liveTradingEnabled: false,
      globalKillSwitch: false,
    });
  });

  it('lists owned trading bots through the admin contract', async () => {
    const admin = addUser({ role: UserRole.ADMIN });
    const response = await request(app).get('/api/admin/trading/bots')
      .set('Authorization', `Bearer access:ADMIN:${admin.id}:session`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('keeps demo execution locked at the bot HTTP boundary', async () => {
    const admin = addUser({ role: UserRole.ADMIN });
    const response = await request(app).post('/api/admin/trading/bots')
      .set('Authorization', `Bearer access:ADMIN:${admin.id}:session`)
      .send({
        name: 'Unsafe Demo Bot', exchangeAccountId: 'account-1', type: 'SCALPING', mode: 'DEMO', symbol: 'BTCUSDT', intervalSeconds: 30,
        configuration: { side: 'BOTH', quantity: '0.001', leverage: 2, marginMode: 'ISOLATED', signalThresholdBps: 25 },
      });
    expect(response.status).toBe(400);
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
