/**
 * Verify Founder OS Overview v2 CEO dashboard structure.
 * Run: npx tsx scripts/verify-founder-overview-v2.ts
 */

import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

function main() {
  const overview = read('components/owner/views/OverviewView.tsx');
  const ceo = read('lib/owner/ceoDashboard.ts');
  const page = read('app/dashboard/admin/owner/page.tsx');

  assert(overview.indexOf('CEO snapshot') < overview.indexOf("Today&apos;s priorities"), 'CEO Snapshot appears before priorities');
  assert(overview.includes('CyberShield Today'), 'CEO snapshot header exists');
  assert(overview.includes('What changed today'), 'What changed today section');
  assert(overview.includes('Revenue opportunities'), 'Revenue opportunities section');
  assert(overview.includes('What should I do next'), 'Next action assistant card');
  assert(overview.includes('Revenue at risk'), 'Revenue at risk card');
  assert(overview.includes('Next $1,000 MRR path'), 'Next 1k MRR card');
  assert(overview.includes('90-minute growth block'), 'Founder focus mode');
  assert(overview.includes('Hide completed'), 'Hide completed actions');
  assert(!overview.includes('Contact '), 'No individual prospect contact titles');
  assert(ceo.includes('buildCeoPriorities'), 'CEO priorities builder exists');
  assert(ceo.includes('.slice(0, 5)'), 'Priorities limited to 5');
  assert(ceo.includes('interpretSnapshot'), 'Plain-English interpretation');
  assert(overview.includes('No paying customers yet'), 'Empty state for no customers');
  assert(page.includes('ceoDashboard'), 'Owner page loads CEO dashboard');
  assert(ceo.includes('Send outreach to'), 'Batch outreach priority pattern');
  assert(ceo.includes('estimatedMrr: null'), 'Null MRR when not in CRM data');

  console.log('\nAll Founder Overview v2 checks passed.');
}

main();
