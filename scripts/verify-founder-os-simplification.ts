/**
 * Verify Founder OS simplification (premium rebuild).
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

assert(FOUNDER_SECTIONS.length === 6, `Expected 6 nav sections, got ${FOUNDER_SECTIONS.length}`);
assert(FOUNDER_SECTIONS.some((s) => s.id === 'success'), 'Success nav section exists');

const shell = readFile('components/owner/FounderShell.tsx');
assert(shell.includes('FOUNDER_SECTIONS'), 'FounderShell uses FOUNDER_SECTIONS');

const founderOs = readFile('components/owner/FounderOs.tsx');
assert(founderOs.includes('FounderHomeView'), 'FounderOs uses FounderHomeView');
assert(founderOs.includes('FounderInboxView'), 'FounderOs uses FounderInboxView');
assert(founderOs.includes('ProspectsView'), 'FounderOs uses ProspectsView');
assert(!founderOs.includes('OpportunityCenter'), 'Duplicate OpportunityCenter removed');
assert(!founderOs.includes('RevenueOpportunityPanel'), 'Duplicate RevenueOpportunityPanel removed');
assert(!founderOs.includes('DailyBriefing'), 'DailyBriefing merged into home');

const home = readFile('components/owner/views/FounderHomeView.tsx');
assert(
  home.includes('At a glance') || home.includes('Business status') || home.includes('businessStatus'),
  'Home has business status',
);
assert(home.includes('AiChiefOfStaff') || home.includes('chiefOfStaff'), 'Home has AI Chief of Staff');

const prospects = readFile('components/owner/views/ProspectsView.tsx');
assert(prospects.includes('LeadDiscovery'), 'Prospects uses single discovery source');
assert(
  readFile('components/owner/ProspectCard.tsx').includes('Recommended next action') ||
    readFile('components/owner/ProspectPipeline.tsx').includes('Recommended next action'),
  'Prospects has recommended next action',
);
assert(
  readFile('components/owner/LeadDiscovery.tsx').includes('No qualified prospects yet') ||
    readFile('lib/owner/pipeline.ts').includes('No qualified prospects yet'),
  'Prospects empty state',
);

assert(readFile('components/owner/views/FounderInboxView.tsx').includes('inbox'), 'Inbox view exists');
assert(readFile('components/owner/views/CustomersView.tsx').includes('No customer data yet'), 'Customers empty state');

const sources = readAllOwnerSources();
for (const banned of BANNED_DEMO_PATTERNS) {
  assert(!sources.includes(banned), `Banned demo pattern found: ${banned}`);
}
assert(!sources.includes('generateProspectList'), 'No generateProspectList');
assert(!sources.includes('DEFAULT_BENCHMARKS'), 'No DEFAULT_BENCHMARKS');

console.log('All Founder OS simplification checks passed.');
console.log(`  Nav sections: ${FOUNDER_SECTIONS.length}`);
