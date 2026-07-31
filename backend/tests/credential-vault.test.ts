import { describe, expect, it } from 'vitest';
import { apiKeyHint, decryptCredential, encryptCredential } from '../src/security/credential-vault.js';

describe('trading credential vault', () => {
  it('encrypts credentials with unique nonces and decrypts them', () => {
    const first = encryptCredential('super-secret-value');
    const second = encryptCredential('super-secret-value');
    expect(first).not.toBe(second);
    expect(first).not.toContain('super-secret-value');
    expect(decryptCredential(first)).toBe('super-secret-value');
    expect(decryptCredential(second)).toBe('super-secret-value');
  });

  it('only exposes a masked API key hint', () => {
    expect(apiKeyHint('ABCD12345678WXYZ')).toBe('ABCD********WXYZ');
  });
});
