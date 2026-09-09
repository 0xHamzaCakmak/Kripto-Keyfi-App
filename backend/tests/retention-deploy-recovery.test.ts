import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const deploy = readFileSync(new URL('../../deploy.sh', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../prisma/migrations/20260909100000_preserve_execution_evidence_retention/migration.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const recoveryStart = deploy.indexOf("const fs = require('fs');", deploy.indexOf('pause_testnet_fleet()'));
const recovery = deploy.slice(recoveryStart, deploy.indexOf('\nNODE', recoveryStart));
async function checkFleet(ids: unknown, bots: unknown[]) {
  const state = { argv: ['node', '-', '/maintenance.json'], exitCode: 0 };
  const messages: string[] = [];
  class PrismaClient {
    tradingBot = { findMany: async () => bots };
    $disconnect = async () => {};
  }
  await runInNewContext(recovery, {
    require: (name: string) => name === 'fs' ? { readFileSync: () => JSON.stringify(ids) } : { PrismaClient },
    process: state, console: { log: (message: string) => messages.push(message), error: (message: string) => messages.push(message) },
  });
  return state.exitCode;
}
describe('retention deployment recovery', () => {
  it('gives replacement foreign keys distinct names and pins the corrected SQL', () => {
    for (const table of ['trading_bot_paper_fills', 'shadow_trades']) {
      expect(migration).toContain('DROP FOREIGN KEY `' + table + '_decisionId_fkey`');
      expect(migration).toContain('ADD CONSTRAINT `' + table + '_decisionId_retention_fkey`');
    }
    expect(deploy).toContain(createHash('sha256').update(migration).digest('hex'));
  });
  it('allows the original paused fleet without writing the maintenance file', async () => {
    expect(await checkFleet(['bot'], [{ id: 'bot', state: 'PAUSED', desiredState: 'PAUSED' }])).toBe(0);
  });
  it('rejects missing bots, active bots and malformed ownership lists', async () => {
    expect(await checkFleet(['missing'], [])).toBe(1);
    expect(await checkFleet([], [{ id: 'other', state: 'RUNNING', desiredState: 'RUNNING' }])).toBe(1);
    expect(await checkFleet({}, [])).toBe(1);
    expect(await checkFleet(['bot', 'bot'], [])).toBe(1);
  });
});
