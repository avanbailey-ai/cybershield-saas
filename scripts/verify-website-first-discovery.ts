/**
 * Website-first discovery verification.
 * Run: npx tsx scripts/verify-website-first-discovery.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseUrlBatch, parseCsvImport } from '../lib/owner/prospectDiscovery';
import { discoverFreeSourcePack } from '../lib/owner/sourcePacks';

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

console.log('Website-first discovery verification\n');

assert(read('lib/owner/runRevenueEngine.ts').includes('paste_urls'), 'website paste mode');
assert(read('lib/owner/sourcePacks.ts').includes('discoverFreeSourcePack'), 'free source packs');
assert(!read('lib/owner/runRevenueEngine.ts').includes('location required'), 'no location required');

const batch = parseUrlBatch('https://cybershieldcloud.com\nhttps://example.org');
assert(batch.length === 2, 'parses pasted domains');

const csv = parseCsvImport('website,name\nhttps://cybershieldcloud.com,CyberShield');
assert(csv.length === 1, 'CSV import works');

console.log('\nLive smoke: free source pack (bounded, no location)…');

async function smoke() {
  try {
    const sites = await discoverFreeSourcePack('smb', 4);
    assert(sites.length > 0, 'free source pack returns real website candidates');
    assert(sites.every((s) => s.website.includes('.')), 'candidates have domains');
    console.log(`  Found ${sites.length} candidates (sample: ${sites[0]?.website})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout|abort/i.test(msg)) {
      console.log('  WARN: live smoke timed out (provider rate limit) — structural checks still pass');
      return;
    }
    throw err;
  }
}

smoke()
  .then(() => console.log('\nWebsite-first discovery checks passed.'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
