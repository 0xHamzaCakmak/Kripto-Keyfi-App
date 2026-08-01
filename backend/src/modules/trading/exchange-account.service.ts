import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { apiKeyHint, decryptCredential, encryptCredential } from '../../security/credential-vault.js';
import { ApiError } from '../../utils/api-error.js';
import type { CreateExchangeAccountInput } from './exchange-account.schema.js';
import { createExchangeAdapter } from './exchanges/exchange-adapter.factory.js';
import { ExchangeAdapterError } from './exchanges/exchange-adapter.js';
import type { CredentialValidationResult } from './exchanges/exchange-adapter.js';

const publicSelect = {
  id: true, name: true, provider: true, environment: true, accountType: true, apiKeyHint: true,
  description: true, isActive: true, connectionStatus: true, canTrade: true, withdrawalEnabled: true,
  lastConnectedAt: true, lastSyncAt: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ExchangeAccountSelect;

export const listExchangeAccounts = (userId: string) => prisma.exchangeAccount.findMany({
  where: { userId }, select: publicSelect, orderBy: { createdAt: 'desc' },
});

export async function createExchangeAccount(userId: string, input: CreateExchangeAccountInput) {
  const adapter = createExchangeAdapter(input.provider, credentialsFromInput(input));
  const validation = await exchangeCall(() => adapter.validateCredentials());
  try {
    return await prisma.exchangeAccount.create({
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
  const balances = await exchangeCall(() => adapterFor(account).getBalances());
  await prisma.exchangeAccount.update({ where: { id }, data: { connectionStatus: 'CONNECTED', lastSyncAt: new Date() } });
  return balances;
}

export async function deleteExchangeAccount(userId: string, id: string) {
  await ownedAccount(userId, id);
  await prisma.exchangeAccount.delete({ where: { id } });
  return { deleted: true };
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
