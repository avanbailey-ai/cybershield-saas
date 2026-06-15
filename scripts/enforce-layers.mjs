#!/usr/bin/env node
/**
 * CyberShield layer boundary enforcement.
 *
 * Usage:
 *   node scripts/enforce-layers.mjs --staged
 *   node scripts/enforce-layers.mjs --files path/a,path/b
 *   node scripts/enforce-layers.mjs --pr
 *
 * Environment:
 *   CI_CHANGED_FILES — comma-separated file list (workflow override; highest priority)
 *   GITHUB_BASE_REF   — base branch name for --pr (default: main)
 *   CI                — when true, zero changed files exits 0 (nothing to check)
 *
 * --pr mode (CI pull requests):
 *   Fetches origin/<base> and diffs against HEAD:
 *     git fetch origin <base>
 *     git diff --name-only origin/<base>...HEAD
 *   Workflows may set GITHUB_BASE_REF from github.base_ref instead of hardcoding main.
 *
 * Local behaviour when no files are found:
 *   Exits 0 with a warning (no git, empty diff, or missing flags).
 *
 * Exits 0 when changes stay within a single layer group (0–3) or tooling-only.
 * Exits 1 on cross-layer violations.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const isCI = process.env.CI === 'true' || process.env.CI === '1';

const LAYER_0_LOCKED = [
  'middleware.ts',
  'lib/supabase/',
  'app/actions/auth.ts',
  'app/auth/',
  'app/api/stripe/',
  'lib/scanner/processQueue.ts',
  'lib/scanner/queue.ts',
  'app/api/scan/trigger-all/',
  'app/api/scan/process-queue/',
];

const LAYER_1 = [
  'app/api/scan/route.ts',
  'services/',
  'core/scans/',
  'core/billing/',
];

const LAYER_2 = [
  'lib/reliability/',
  'lib/workers/',
  'app/api/cron/',
];

const LAYER_3 = [
  'components/',
  'app/page.tsx',
  'app/login/',
  'app/signup/',
  'app/dashboard/',
];

const LAYER_GROUPS = [
  { id: 0, patterns: LAYER_0_LOCKED },
  { id: 1, patterns: LAYER_1 },
  { id: 2, patterns: LAYER_2 },
  { id: 3, patterns: LAYER_3 },
];

const EXEMPT_PREFIXES = ['scripts/', '.cursor/rules/'];
const EXEMPT_FILES = ['docs/OPERATING_MODEL.md'];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function matchesPattern(filePath, pattern) {
  const normalized = normalizePath(filePath);
  if (pattern.endsWith('/')) {
    return (
      normalized.startsWith(pattern) ||
      normalized.includes(`/${pattern.slice(0, -1)}/`) ||
      normalized.endsWith(`/${pattern.slice(0, -1)}`)
    );
  }
  return normalized === pattern || normalized.endsWith(`/${pattern}`);
}

function isExempt(filePath) {
  const normalized = normalizePath(filePath);
  if (EXEMPT_FILES.includes(normalized)) return true;
  return EXEMPT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function layerForFile(filePath) {
  for (const group of LAYER_GROUPS) {
    if (group.patterns.some((pattern) => matchesPattern(filePath, pattern))) {
      return group.id;
    }
  }
  return null;
}

function findGit() {
  const candidates = process.platform === 'win32'
    ? ['git', 'C:\\Program Files\\Git\\bin\\git.exe', 'C:\\Program Files\\Git\\cmd\\git.exe']
    : ['git'];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

function parseArgs(argv) {
  const staged = argv.includes('--staged');
  const pr = argv.includes('--pr');
  const filesIdx = argv.indexOf('--files');
  let explicitFiles = [];
  if (filesIdx !== -1 && argv[filesIdx + 1]) {
    explicitFiles = argv[filesIdx + 1].split(',').map((f) => f.trim()).filter(Boolean);
  }
  return { staged, pr, explicitFiles };
}

function getStagedFiles(gitPath) {
  try {
    const output = execFileSync(gitPath, ['diff', '--cached', '--name-only'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getPrFiles(gitPath) {
  const baseRef = process.env.GITHUB_BASE_REF || 'main';

  try {
    execFileSync(gitPath, ['fetch', 'origin', baseRef], {
      cwd: root,
      stdio: 'ignore',
    });
  } catch {
    console.warn(`Warning: could not fetch origin/${baseRef} — using local refs.`);
  }

  const remoteRef = `origin/${baseRef}`;
  const diffTargets = [`${remoteRef}...HEAD`, `${baseRef}...HEAD`];

  for (const target of diffTargets) {
    try {
      const output = execFileSync(gitPath, ['diff', '--name-only', target], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
      if (output) {
        return output.split(/\r?\n/).filter(Boolean);
      }
    } catch {
      // try next diff target
    }
  }

  return [];
}

function getEnvChangedFiles() {
  const raw = process.env.CI_CHANGED_FILES;
  if (!raw) return [];
  return raw.split(',').map((f) => f.trim()).filter(Boolean);
}

function getChangedFiles({ staged, pr, explicitFiles }) {
  const envFiles = getEnvChangedFiles();
  if (envFiles.length > 0) return envFiles;

  if (explicitFiles.length > 0) return explicitFiles;

  if (!staged && !pr) return [];

  if (!fs.existsSync(path.join(root, '.git'))) {
    console.warn('Warning: not a git repository — no files to scan.');
    return [];
  }

  const gitPath = findGit();
  if (!gitPath) {
    console.warn('Warning: git not found — no files to scan.');
    return [];
  }

  if (pr) return getPrFiles(gitPath);
  return getStagedFiles(gitPath);
}

function reportNoFiles({ staged, pr, explicitFiles }) {
  console.log('Changed files: 0');
  if (isCI) {
    console.log('Status: OK — no files to check (CI: nothing in diff)');
  } else if (pr) {
    console.warn('Warning: --pr found no changed files (empty diff or missing remote).');
    console.log('Status: OK — no files to check');
  } else if (staged || explicitFiles.length > 0) {
    console.log('Status: OK — no files to check');
  } else {
    console.log('Status: OK — no files to check (use --staged, --pr, or --files)');
  }
}

function main() {
  const { staged, pr, explicitFiles } = parseArgs(process.argv.slice(2));
  const changedFiles = getChangedFiles({ staged, pr, explicitFiles });

  console.log('CyberShield Layer Enforcement');
  if (pr) {
    const baseRef = process.env.GITHUB_BASE_REF || 'main';
    console.log(`Mode: PR diff (base: origin/${baseRef})`);
  }

  if (changedFiles.length === 0) {
    reportNoFiles({ staged, pr, explicitFiles });
    process.exit(0);
  }

  const exempt = [];
  const mapped = [];

  for (const file of changedFiles) {
    if (isExempt(file)) {
      exempt.push(file);
      continue;
    }
    const layer = layerForFile(file);
    if (layer !== null) {
      mapped.push({ file, layer });
    }
  }

  const layersTouched = [...new Set(mapped.map((entry) => entry.layer))].sort((a, b) => a - b);

  console.log(`Changed files: ${changedFiles.length}`);
  if (exempt.length > 0) {
    console.log(`Exempt (tooling): ${exempt.length}`);
  }
  console.log(`Layers touched: [${layersTouched.join(', ')}]`);

  if (layersTouched.length >= 2) {
    const layerList = layersTouched.join(' and ');
    console.error(
      `CROSS-LAYER VIOLATION: files touch layers ${layerList}. Create checkpoint/<name> branch or split changes.`,
    );
    for (const entry of mapped) {
      console.error(`  L${entry.layer}: ${entry.file}`);
    }
    process.exit(1);
  }

  if (layersTouched.length === 1) {
    console.log('Status: OK — single layer change');
  } else {
    console.log('Status: OK — tooling or unmapped paths only');
  }

  process.exit(0);
}

main();
