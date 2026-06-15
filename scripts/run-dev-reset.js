'use strict';

/**
 * Cross-platform entry point for npm dev:clean and dev:fresh scripts.
 *
 * Usage (via package.json):
 *   node scripts/run-dev-reset.js --clean-only
 *   node scripts/run-dev-reset.js --fresh
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cleanOnly = process.argv.includes('--clean-only');
const fresh = process.argv.includes('--fresh');

if (!cleanOnly && !fresh) {
  console.error('Usage: node scripts/run-dev-reset.js --clean-only | --fresh');
  process.exit(1);
}

function run(status) {
  process.exit(status ?? 1);
}

if (process.platform === 'win32') {
  const script = path.join(__dirname, 'dev-reset.ps1');
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    script,
  ];

  if (cleanOnly) {
    args.push('-SkipPull', '-SkipDev');
  }

  const result = spawnSync('powershell.exe', args, { cwd: root, stdio: 'inherit' });
  run(result.status);
} else {
  const script = path.join(__dirname, 'dev-reset.sh');
  const args = [script];

  if (cleanOnly) {
    args.push('--skip-pull', '--skip-dev');
  }

  const result = spawnSync('bash', args, { cwd: root, stdio: 'inherit' });
  run(result.status);
}
