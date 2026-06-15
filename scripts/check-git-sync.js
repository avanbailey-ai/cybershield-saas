'use strict';

/**
 * Compare local HEAD to origin/main before starting the dev server.
 *
 * Usage:
 *   node scripts/check-git-sync.js           # warn if out of sync (non-blocking)
 *   node scripts/check-git-sync.js --strict  # exit 1 if out of sync
 *
 * Env:
 *   GIT_PATH — full path to git executable (optional; auto-detected on Windows/macOS/Linux)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const strict = process.argv.includes('--strict');
const root = path.resolve(__dirname, '..');

function findGitHubDesktopGit() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'GitHubDesktop');
  if (!fs.existsSync(base)) return null;

  const apps = fs
    .readdirSync(base)
    .filter((entry) => entry.startsWith('app-'))
    .sort()
    .reverse();

  for (const app of apps) {
    const gitExe = path.join(base, app, 'resources', 'app', 'git', 'cmd', 'git.exe');
    if (fs.existsSync(gitExe)) return gitExe;
  }

  return null;
}

function findGit() {
  if (process.env.GIT_PATH) {
    if (fs.existsSync(process.env.GIT_PATH)) return process.env.GIT_PATH;
    console.warn(`[git-sync] GIT_PATH set but not found: ${process.env.GIT_PATH}`);
  }

  if (process.platform === 'win32') {
    const desktopGit = findGitHubDesktopGit();
    if (desktopGit) return desktopGit;

    const programFilesGit = 'C:\\Program Files\\Git\\cmd\\git.exe';
    if (fs.existsSync(programFilesGit)) return programFilesGit;
  }

  try {
    const lookup = process.platform === 'win32' ? 'where.exe' : 'which';
    const output = execFileSync(lookup, ['git'], { encoding: 'utf8' }).trim();
    const first = output.split(/\r?\n/).find(Boolean);
    if (first && fs.existsSync(first)) return first;
  } catch {
    // fall through to plain "git" on PATH
  }

  return 'git';
}

function runGit(gitPath, args) {
  try {
    return execFileSync(gitPath, args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(path.join(root, '.git'))) {
    console.warn('[git-sync] Not a git repository — skipping sync check');
    return;
  }

  const gitPath = findGit();
  const head = runGit(gitPath, ['rev-parse', 'HEAD']);
  const originMain = runGit(gitPath, ['rev-parse', 'origin/main']);

  if (!head) {
    console.warn('[git-sync] Could not read local HEAD — skipping sync check');
    return;
  }

  if (!originMain) {
    console.warn('[git-sync] origin/main not found — run: git fetch origin');
    return;
  }

  if (head === originMain) {
    console.log(`[git-sync] Up to date with origin/main (${head.slice(0, 7)})`);
    return;
  }

  const behind = runGit(gitPath, ['rev-list', '--count', 'HEAD..origin/main']);
  const ahead = runGit(gitPath, ['rev-list', '--count', 'origin/main..HEAD']);
  const message = `[git-sync] Local branch differs from origin/main (ahead ${ahead ?? '?'}, behind ${behind ?? '?'}). Run: npm run dev:fresh`;

  if (strict) {
    console.error(message);
    process.exit(1);
  }

  console.warn(message);
}

main();
