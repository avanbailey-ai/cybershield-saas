#!/usr/bin/env node
/**
 * Scan engine smoke test runner.
 * Invokes smoke-scan-core.ts via tsx — no Next.js server required.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const coreScript = path.join(__dirname, 'smoke-scan-core.ts');

const result = spawnSync('npx', ['tsx', coreScript], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
