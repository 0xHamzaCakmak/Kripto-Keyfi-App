import { describe, expect, it, vi } from 'vitest';
import { readExchangeState } from '../src/modules/trading/exchange-account.service.js';

describe('read-only exchange state credential routing', () => {
  it('uses Go first and falls back to database-backed credentials when Go is unavailable', async () => {
    const goRead = vi.fn().mockRejectedValue(new Error('engine restarting'));
    const databaseCredentialRead = vi.fn().mockResolvedValue(['db-snapshot']);
    await expect(readExchangeState('GO', goRead, databaseCredentialRead)).resolves.toEqual(['db-snapshot']);
    expect(goRead).toHaveBeenCalledOnce();
    expect(databaseCredentialRead).toHaveBeenCalledOnce();
  });

  it('does not use the fallback while Go read succeeds', async () => {
    const goRead = vi.fn().mockResolvedValue(['go-snapshot']);
    const databaseCredentialRead = vi.fn().mockResolvedValue(['db-snapshot']);
    await expect(readExchangeState('GO', goRead, databaseCredentialRead)).resolves.toEqual(['go-snapshot']);
    expect(databaseCredentialRead).not.toHaveBeenCalled();
  });
});
