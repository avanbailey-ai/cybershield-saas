'use strict';

/**
 * Resolve git executable path (GIT_PATH, PATH, GitHub Desktop on Windows, etc.).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function resolveGitPath(options = {}) {
  const { warn = () => {} } = options;

  if (process.env.GIT_PATH) {
    if (fs.existsSync(process.env.GIT_PATH)) return process.env.GIT_PATH;
    warn(`GIT_PATH set but not found: ${process.env.GIT_PATH}`);
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
    // fall through
  }

  return 'git';
}

module.exports = { resolveGitPath, findGitHubDesktopGit };
