import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(process.cwd(), '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const ignoredFiles = new Set(['.env']);
const secretPatterns = [
  /(?<![A-Za-z0-9])gsk_[A-Za-z0-9_-]{20,}/g,
  /(?<![A-Za-z0-9])sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  /(?<![A-Za-z0-9])AIza[A-Za-z0-9_-]{30,}/g,
];
const findings: string[] = [];

async function scan(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    if (!entry.isDirectory() && ignoredFiles.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) { await scan(absolute); continue; }
    if (!/\.(?:ts|tsx|js|mjs|json|md|ya?ml|example|txt)$/i.test(entry.name)) continue;
    const content = await readFile(absolute, 'utf8').catch(() => '');
    if (secretPatterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(content); })) findings.push(path.relative(repositoryRoot, absolute));
  }
}

await scan(repositoryRoot);
if (findings.length) {
  console.error(`Olası gerçek API anahtarı bulundu: ${findings.join(', ')}`);
  process.exitCode = 1;
} else {
  console.info('Repository secret scan passed; local .env files were intentionally excluded.');
}
