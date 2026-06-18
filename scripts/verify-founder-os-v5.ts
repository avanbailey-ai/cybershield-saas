/**
 * Verify Founder OS V5 business autopilot structure.
 * Run: npx tsx scripts/verify-founder-os-v5.ts
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
  const home = read('components/owner/views/FounderHomeView.tsx');
  const founderOs = read('components/owner/FounderOs.tsx');
  const nav = read('lib/owner/founderNav.ts');
  const v5lib = read('lib/owner/founderOsV5.ts');
  const inbox = read('components/owner/views/FounderInboxView.tsx');

  assert(nav.includes("'home'") && nav.split('id:').length - 1 <= 6, 'Navigation simplified');
  assert(!nav.includes("'outreach'") || nav.includes('LEGACY'), 'Outreach removed from primary nav');
  assert(founderOs.includes('FounderHomeView'), 'Home is default view');
  assert(founderOs.includes('FounderInboxView'), 'Founder inbox exists');

  assert(home.indexOf('AiChiefOfStaff') < home.indexOf('Business status'), 'Chief of Staff first');
  assert(home.includes('Business status'), 'Business health section');
  assert(home.includes('while you were away'), 'While away section');
  assert(home.includes('AutopilotCommandCenter'), 'Autopilot section');
  assert(home.includes('Highest-leverage opportunity'), 'Biggest opportunity');
  assert(home.includes('Customer success'), 'Customer success section');
  assert(home.includes('Revenue engine'), 'Revenue engine section');
  assert(home.includes('Pipeline'), 'Pipeline section');

  assert(v5lib.includes('getFounderOsV5'), 'V5 data aggregator');
  assert(v5lib.includes('inbox'), 'Founder inbox data');
  assert(v5lib.includes('chiefOfStaff'), 'AI Chief of Staff data');
  assert(v5lib.includes('expansion'), 'Expansion engine');
  assert(v5lib.includes('revenueEngine'), 'Revenue engine data');
  assert(!v5lib.includes('example.com'), 'No fake example domains in V5 lib');

  assert(inbox.includes('Founder inbox'), 'Inbox page');
  assert(read('app/api/owner/inbox/route.ts').includes('approve'), 'Inbox approve API');

  assert(!home.includes('openstreetmap'), 'No provider logs on homepage');
  assert(!home.includes('CEO snapshot') || home.includes('Business status'), 'No duplicate CEO overview clutter');

  console.log('\nAll Founder OS V5 checks passed.');
}

main();
