/**
 * Verify Founder OS command center rebuild.
 * Run: npx tsx scripts/verify-founder-os-simplification.ts
 */

import fs from 'fs';
import path from 'path';
import { FOUNDER_SECTIONS, BANNED_DEMO_PATTERNS } from '../lib/owner/founderNav';

const ROOT = path.resolve(__dirname, '..');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readAllOwnerSources(): string {
  const dirs = ['components/owner', 'lib/owner', 'app/dashboard/admin/owner', 'app/api/owner'];
  const parts: string[] = [];
  for (const dir of dirs) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    const walk = (d: string) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(ent.name)) {
          const rel = path.relative(ROOT, p).replace(/\\/g, '/');
          if (rel === 'lib/owner/founderNav.ts' || rel.startsWith('scripts/')) continue;
          parts.push(fs.readFileSync(p, 'utf8'));
        }
      }
    };
    walk(full);
  }
  return parts.join('\n');
}

assert(FOUNDER_SECTIONS.length === 8, `Expected 8 nav sections, got ${FOUNDER_SECTIONS.length}`);
assert(FOUNDER_SECTIONS.some((s) => s.id === 'overview'), 'Overview nav section exists');
assert(FOUNDER_SECTIONS.some((s) => s.id === 'sales'), 'Sales / CRM nav section exists');
assert(!FOUNDER_SECTIONS.some((s) => (s.id as string) === 'prospects'), 'Prospects removed from main nav');

const shell = readFile('components/owner/FounderShell.tsx');
assert(shell.includes('FOUNDER_SECTIONS'), 'FounderShell uses FOUNDER_SECTIONS');

const founderOs = readFile('components/owner/FounderOs.tsx');
assert(founderOs.includes('FounderOverviewView'), 'FounderOs uses FounderOverviewView');
assert(!founderOs.includes('LeadDiscovery'), 'FounderOs does not mount LeadDiscovery');
assert(!founderOs.includes('ProspectsView'), 'FounderOs does not mount ProspectsView');

const page = readFile('app/dashboard/admin/owner/page.tsx');
assert(page.includes('getFounderCommandCenter'), 'Owner page loads command center');
assert(!page.includes('getFounderOsV6'), 'Owner page no longer loads V6 prospect payload');

const aggregator = readFile('lib/owner/founderCommandCenter.ts');
assert(aggregator.includes('getFounderCommandCenter'), 'Command center aggregator exists');
assert(aggregator.includes('No data yet') || aggregator.includes('emptyReason'), 'Honest empty states');

const allOwner = readAllOwnerSources();
for (const pattern of BANNED_DEMO_PATTERNS.slice(0, 3)) {
  assert(!allOwner.includes(`"${pattern}"`), `Banned demo pattern should not appear in owner UI: ${pattern}`);
}

console.log('verify-founder-os-simplification: all checks passed');
