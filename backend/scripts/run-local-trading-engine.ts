import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.resolve(backendDir, '..');
const engineDir = path.join(projectDir, 'services', 'trading-engine');
const goCacheDir = path.join(engineDir, '.gocache');

const localEnvPath = path.join(backendDir, '.env');
if (fs.existsSync(localEnvPath)) Object.assign(process.env, dotenv.parse(fs.readFileSync(localEnvPath)));

// Reuse only engine feature flags from the production-local template. Local
// database credentials and the credential master key must always come from
// backend/.env; replacing them makes the engine connect with the VPS user.
const engineFlagsPath = path.join(backendDir, '.env.production.local');
if (fs.existsSync(engineFlagsPath)) {
  const engineFlags = dotenv.parse(fs.readFileSync(engineFlagsPath));
  for (const [name, value] of Object.entries(engineFlags)) {
    if (name.startsWith('TRADING_ENGINE_')) process.env[name] = value;
  }
}

const required = ['DATABASE_URL', 'TRADING_CREDENTIALS_MASTER_KEY', 'TRADING_ENGINE_TOKEN'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} local Trading Engine icin zorunludur.`);
}

const child = spawn('go', ['run', './cmd/trading-engine'], {
  cwd: engineDir,
  env: { ...process.env, GOCACHE: goCacheDir },
  stdio: 'inherit',
  windowsHide: true,
});

child.once('error', (error) => {
  console.error(`Trading Engine baslatilamadi: ${error.message}`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (signal) console.log(`Trading Engine ${signal} sinyaliyle kapandi.`);
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => child.kill(signal));
}
