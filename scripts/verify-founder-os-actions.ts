/**
 * Alias for verify-founder-os-action-integrity.ts (Part 1 spec name).
 * Run: npx tsx scripts/verify-founder-os-actions.ts
 */

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['tsx', 'scripts/verify-founder-os-action-integrity.ts'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
