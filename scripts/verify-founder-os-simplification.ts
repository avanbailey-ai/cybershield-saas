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

assert(FOUNDER_SECTIONS.length === 7, `Expected 7 nav sections, got ${FOUNDER_SECTIONS.length}`);

const shell = readFile('components/owner/FounderShell.tsx');
assert(shell.includes('FOUNDER_SECTIONS'), 'FounderShell uses FOUNDER_SECTIONS');

const founderOs = readFile('components/owner/FounderOs.tsx');
assert(founderOs.includes('OverviewView'), 'FounderOs uses OverviewView');
assert(founderOs.includes('ProspectsView'), 'FounderOs uses ProspectsView');
assert(!founderOs.includes('OpportunityCenter'), 'Duplicate OpportunityCenter removed');
assert(!founderOs.includes('RevenueOpportunityPanel'), 'Duplicate RevenueOpportunityPanel removed');
assert(!founderOs.includes('DailyBriefing'), 'DailyBriefing merged into Overview');

const overview = readFile('components/owner/views/OverviewView.tsx');
assert(overview.includes('Next actions'), 'Overview has priority actions');
assert(overview.includes('topActions'), 'Overview uses topActions');

const prospects = readFile('components/owner/views/ProspectsView.tsx');
assert(prospects.includes('LeadDiscovery'), 'Prospects uses single discovery source');
assert(readFile('components/owner/LeadDiscovery.tsx').includes('Next step'), 'Prospects has next step column');
assert(readFile('components/owner/LeadDiscovery.tsx').includes('No prospects imported yet'), 'Prospects empty state');

assert(readFile('components/owner/views/OutreachView.tsx').includes('No HOT prospects yet'), 'Outreach empty state');
assert(readFile('components/owner/views/CustomersView.tsx').includes('No customer data yet'), 'Customers empty state');

const sources = readAllOwnerSources();
for (const banned of BANNED_DEMO_PATTERNS) {
  assert(!sources.includes(banned), `Banned demo pattern found: ${banned}`);
}
assert(!sources.includes('generateProspectList'), 'No generateProspectList');
assert(!sources.includes('DEFAULT_BENCHMARKS'), 'No DEFAULT_BENCHMARKS');

console.log('All Founder OS simplification checks passed.');
console.log(`  Nav sections: ${FOUNDER_SECTIONS.length}`);
