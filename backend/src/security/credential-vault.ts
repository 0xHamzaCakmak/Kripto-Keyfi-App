import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const key = Buffer.from(env.TRADING_CREDENTIALS_MASTER_KEY, 'hex');

export function encryptCredential(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptCredential(payload: string): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split('.');
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) throw new Error('Unsupported encrypted credential payload');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}

export function apiKeyHint(apiKey: string): string {
  if (apiKey.length <= 8) return '********';
  return `${apiKey.slice(0, 4)}********${apiKey.slice(-4)}`;
}
