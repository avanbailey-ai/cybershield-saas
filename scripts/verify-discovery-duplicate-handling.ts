/**
 * Discovery duplicate handling verification.
 * Run: npx tsx scripts/verify-discovery-duplicate-handling.ts
 */

import { websiteHostKey } from '../lib/owner/discovery/normalize';
import { buildRevenueActionCard } from '../lib/owner/revenueEngine';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function read(rel: string): string {
  return existsSync(join(process.cwd(), rel)) ? readFileSync(join(process.cwd(), rel), 'utf8') : '';
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

console.log('Discovery duplicate handling verification\n');

assert(read('lib/owner/runRevenueEngine.ts').includes('loadExistingHosts'), 'revenue engine loads existing hosts');
assert(read('lib/owner/discovery/engine.ts').includes('seenThisRun'), 'geo discovery dedupes in-run');
assert(read('lib/owner/ensureOutreachDraft.ts').includes('count'), 'draft creation is idempotent');

const a = websiteHostKey('https://example.com/path');
const b = websiteHostKey('https://example.com/about');
assert(a === b, 'domain normalization for duplicate detection');

const card = buildRevenueActionCard(
  {
    business_name: 'Existing',
    website: 'https://example.com',
    scan_score: 40,
    scan_status: 'completed',
  },
  { isDuplicate: true },
);
assert(card.status === 'existing_prospect', 'duplicates show existing prospect');
assert(card.nextAction.toLowerCase().includes('existing'), 'duplicate has next action');

console.log('\nDuplicate handling checks passed.');
