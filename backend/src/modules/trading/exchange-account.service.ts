import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { apiKeyHint, decryptCredential, encryptCredential } from '../../security/credential-vault.js';
import { ApiError } from '../../utils/api-error.js';
import type { CreateExchangeAccountInput, UpdateExecutionEngineInput } from './exchange-account.schema.js';
import { createExchangeAdapter } from './exchanges/exchange-adapter.factory.js';
import { ExchangeAdapterError } from './exchanges/exchange-adapter.js';
import type { CredentialValidationResult } from './exchanges/exchange-adapter.js';
import { scheduleShadowComparison } from './shadow-compare.js';
import { getTradingEngineSnapshot } from './trading-engine.client.js';

const publicSelect = {
  id: true, name: true, provider: true, environment: true, accountType: true, apiKeyHint: true,
  description: true, isActive: true, connectionStatus: true, canTrade: true, withdrawalEnabled: true,
  executionEngine: true,
  lastConnectedAt: true, lastSyncAt: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ExchangeAccountSelect;

export const listExchangeAccounts = (userId: string) => prisma.exchangeAccount.findMany({
  where: { userId }, select: publicSelect, orderBy: { createdAt: 'desc' },
});

export async function createExchangeAccount(userId: string, input: CreateExchangeAccountInput) {
  const adapter = createExchangeAdapter(input.provider, credentialsFromInput(input));
  const validation = await exchangeCall(() => adapter.validateCredentials());
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.exchangeAccount.create({
        data: {
          userId,
          name: input.name,
          provider: input.provider,
          environment: input.environment,
          accountType: input.accountType,
          apiKeyEncrypted: encryptCredential(input.apiKey),
          apiSecretEncrypted: encryptCredential(input.apiSecret),
          ...(input.passphrase ? { passphraseEncrypted: encryptCredential(input.passphrase) } : {}),
          apiKeyHint: apiKeyHint(input.apiKey),
          ...(input.description ? { description: input.description } : {}),
          canTrade: validation.canTrade,
          withdrawalEnabled: validation.withdrawalEnabled,
          lastConnectedAt: new Date(),
        },
        select: publicSelect,
      });
      await tx.tradingRiskProfile.create({ data: { userId, exchangeAccountId: created.id } });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'Bu isimde bir borsa hesabı zaten mevcut.', 'EXCHANGE_ACCOUNT_EXISTS');
    }
    throw error;
  }
}

export async function testExchangeAccount(userId: string, id: string) {
  const account = await ownedAccount(userId, id);
  let validation: CredentialValidationResult;
  try {
    validation = await exchangeCall(() => adapterFor(account).validateCredentials());
  } catch (error) {
    await prisma.exchangeAccount.update({ where: { id }, data: { connectionStatus: 'ERROR', canTrade: false } });
    throw error;
  }
  return prisma.exchangeAccount.update({
    where: { id },
    data: { connectionStatus: 'CONNECTED', canTrade: validation.canTrade, withdrawalEnabled: validation.withdrawalEnabled, lastConnectedAt: new Date() },
    select: publicSelect,
  });
}

export async function getExchangeBalances(userId: string, id: string) {
  const account = await ownedAccount(userId, id);
  if (!account.isActive) throw new ApiError(409, 'Pasif borsa hesabı senkronize edilemez.', 'EXCHANGE_ACCOUNT_DISABLED');
  const balances = account.executionEngine === 'GO'
    ? (await getTradingEngineSnapshot(account)).balances
    : await exchangeCall(() => adapterFor(account).getBalances());
  if (account.executionEngine === 'TYPESCRIPT') scheduleShadowComparison(userId, id, 'balances', balances);
  await prisma.exchangeAccount.update({ where: { id }, data: { connectionStatus: 'CONNECTED', lastSyncAt: new Date() } });
  return balances;
}

export async function deleteExchangeAccount(userId: string, id: string) {
  await ownedAccount(userId, id);
  await prisma.exchangeAccount.delete({ where: { id } });
  return { deleted: true };
}

export async function updateExecutionEngine(userId: string, id: string, input: UpdateExecutionEngineInput) {
  const account = await ownedAccount(userId, id);
  if (account.executionEngine === input.executionEngine) return prisma.exchangeAccount.findUniqueOrThrow({ where: { id }, select: publicSelect });
  const inFlightCount = await prisma.tradingOrder.count({
    where: { exchangeAccountId: id, status: { in: ['PENDING', 'SUBMITTING', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'] } },
  });
  if (inFlightCount > 0) throw new ApiError(409, 'Mutabakat veya yürütme bekleyen emir varken executor değiştirilemez.', 'EXECUTOR_CUTOVER_BLOCKED');
  if (input.executionEngine === 'GO') {
    const [profile, global] = await Promise.all([
      prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId: id }, select: { enabled: true, accountKillSwitch: true } }),
      prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
    ]);
    if (!profile?.enabled || profile.accountKillSwitch || !global || global.globalKillSwitch) {
      throw new ApiError(409, 'Risk profili hazır değil veya kill switch aktif.', 'GO_RISK_GATE_BLOCKED');
    }
    await assertGoExecutorReady();
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.exchangeAccount.update({ where: { id }, data: { executionEngine: input.executionEngine }, select: publicSelect });
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: id, action: 'TRADING_EXECUTOR_CHANGED', entityType: 'EXCHANGE_ACCOUNT', entityId: id,
      metadata: { previous: account.executionEngine, current: input.executionEngine },
    } });
    return updated;
  });
}

async function assertGoExecutorReady() {
  if (!env.TRADING_ENGINE_EXECUTION_ENABLED) throw new ApiError(409, 'Go executor cutover özelliği backend yapılandırmasında kapalı.', 'GO_EXECUTOR_DISABLED');
  try {
    const response = await fetch(new URL('/internal/v1/status', env.TRADING_ENGINE_URL), {
      headers: { Authorization: `Bearer ${env.TRADING_ENGINE_TOKEN}` }, signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json() as { executor?: string };
    if (!response.ok || body.executor !== 'enabled') throw new Error('executor not ready');
  } catch {
    throw new ApiError(503, 'Go Trading Engine write-ready değil; hesap güvenli biçimde TypeScript executor üzerinde bırakıldı.', 'GO_EXECUTOR_NOT_READY');
  }
}

type StoredAccount = Awaited<ReturnType<typeof ownedAccount>>;

export async function ownedAccount(userId: string, id: string) {
  const account = await prisma.exchangeAccount.findFirst({ where: { id, userId } });
  if (!account) throw new ApiError(404, 'Borsa hesabı bulunamadı.', 'EXCHANGE_ACCOUNT_NOT_FOUND');
  return account;
}

export function adapterFor(account: { provider: StoredAccount['provider']; apiKeyEncrypted: string; apiSecretEncrypted: string; passphraseEncrypted: string | null }) {
  return createExchangeAdapter(account.provider, {
    apiKey: decryptCredential(account.apiKeyEncrypted),
    apiSecret: decryptCredential(account.apiSecretEncrypted),
    ...(account.passphraseEncrypted ? { passphrase: decryptCredential(account.passphraseEncrypted) } : {}),
  });
}

function credentialsFromInput(input: CreateExchangeAccountInput) {
  return { apiKey: input.apiKey, apiSecret: input.apiSecret, ...(input.passphrase ? { passphrase: input.passphrase } : {}) };
}

export async function exchangeCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ExchangeAdapterError) throw new ApiError(422, error.message, error.code);
    throw error;
  }
}
