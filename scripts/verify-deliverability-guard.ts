/**
 * Deliverability guard verification.
 * Run: npx tsx scripts/verify-deliverability-guard.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateOutreachCopy } from '../lib/owner/outreachCopyGuard';
import { generateOutreach } from '../lib/owner/generators/outreach';

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

console.log('Deliverability guard verification\n');

assert(existsSync(join(process.cwd(), 'lib/owner/deliverabilityGuard.ts')), 'deliverabilityGuard exists');
assert(existsSync(join(process.cwd(), 'lib/owner/outreachCopyGuard.ts')), 'outreachCopyGuard exists');

const exec = read('lib/owner/outreachExecution.ts');
assert(exec.includes('assertCanSendOutreach'), 'outreachExecution uses deliverability guard');
assert(exec.includes('validateOutreachCopy'), 'outreachExecution uses copy guard');
assert(exec.includes('conversionBlockReason'), 'outreachExecution checks conversion paths');
assert(exec.includes('require_approval'), 'approval gate preserved');

assert(read('lib/owner/deliverabilityGuard.ts').includes('WARMUP_DAILY_CAPS'), 'warmup caps in deliverability guard');
assert(read('lib/owner/deliverabilityGuard.ts').includes('max: 10'), 'week 1 max 10');
assert(read('lib/owner/deliverabilityGuard.ts').includes('max: 40'), 'week 3 max 40');

const good = generateOutreach('cold_email', {
  businessName: 'Test Co',
  website: 'https://example.com',
  scanScore: 70,
});
const goodCheck = validateOutreachCopy(good, { skipUnsubscribeCheck: true });
assert(goodCheck.ok, 'normal outreach passes copy guard');

const badCheck = validateOutreachCopy('Subject: URGENT\n\nYou are hacked!!! Act now!!! https://a.com https://b.com https://c.com https://d.com');
assert(!badCheck.ok, 'scary/spam copy blocked');

assert(read('lib/email/config.ts').includes('EMAIL_ROOT_DOMAIN'), 'verified root sender config exists');
assert(
  read('components/owner/views/SettingsView.tsx').includes('Manual sends') ||
    read('components/owner/views/SettingsView.tsx').includes('Warmup week'),
  'settings explain manual send deliverability rules',
);

console.log('\nAll deliverability guard checks passed.');
