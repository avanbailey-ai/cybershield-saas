/**
 * Buyer-intent / weak-score discovery verification.
 * Run: npx tsx scripts/verify-buyer-intent-discovery.ts
 */

import { isWeakScanScore, revenueStatusForProspect } from '../lib/owner/revenueEngine';
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

console.log('Buyer-intent discovery verification\n');

assert(read('lib/owner/prospectScanUpdate.ts').includes('runScan'), 'scan uses CyberShield engine');
assert(read('lib/owner/runRevenueEngine.ts').includes('applyProspectScan'), 'revenue engine scans websites');
assert(read('lib/owner/contactDiscovery.ts').includes('discoverContactSignals'), 'contact finder exists');

assert(isWeakScanScore(70, 'low'), 'score 70 enters pipeline threshold');
assert(isWeakScanScore(75, 'high'), 'score <=80 + high severity is weak');

const urgent = revenueStatusForProspect({
  scan_score: 55,
  scan_status: 'completed',
  scan_risk_level: 'high',
  contact_email: 'info@business.com',
  contact_confidence: 'verified_public_email',
  contact_email_found: true,
  pipeline_state: 'outreach_ready',
});
assert(urgent === 'draft_ready' || urgent === 'needs_contact', 'weak score with contact is actionable');

console.log('\nBuyer-intent discovery checks passed.');
