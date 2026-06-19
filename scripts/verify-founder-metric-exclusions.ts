/**
 * Founder metric exclusion verification.
 *
 * Ensures QA / internal / test accounts cannot pollute founder business metrics.
 * Checks the shared filter behavior and that every metric source selects
 * `is_qa_account` and routes through isInternalCustomerProfile.
 *
 * Run: npx tsx scripts/verify-founder-metric-exclusions.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isInternalCustomerEmail,
  isInternalCustomerProfile,
} from '../lib/owner/internalAccountFilters';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function ok(message: string): void {
  console.log(`OK: ${message}`);
}

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) throw new Error(`FAIL: Missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

console.log('CyberShield founder metric exclusion verification\n');

// ── Email-pattern exclusions ──
assert(isInternalCustomerEmail('avanbailey@gmail.com'), 'Owner email excluded');
assert(isInternalCustomerEmail('test@gmail.com'), 'test@gmail.com excluded');
assert(isInternalCustomerEmail('test+1@foo.com'), 'test+ prefix excluded');
assert(isInternalCustomerEmail('foo+test@bar.com'), '+test@ excluded');
assert(isInternalCustomerEmail('foo+stripe-preview-test@bar.com'), 'stripe-preview-test excluded');
assert(isInternalCustomerEmail('qa+1@cybershieldcloud.com'), 'qa+ excluded');
assert(isInternalCustomerEmail('x@mailinator.com'), 'disposable domain excluded');
assert(isInternalCustomerEmail('x@example.com'), 'example.com excluded');
assert(isInternalCustomerEmail(''), 'empty email excluded');
assert(!isInternalCustomerEmail('jane@acmecorp.com'), 'real customer email NOT excluded');
ok('Email-pattern exclusions correct');

// ── is_qa_account flag exclusion ──
assert(
  isInternalCustomerProfile({ email: 'real@acmecorp.com', is_qa_account: true }),
  'QA account with a real email is excluded by is_qa_account flag',
);
assert(
  isInternalCustomerProfile({ email: 'real@acmecorp.com', plan: 'owner' }),
  'Owner-plan profile excluded',
);
assert(
  !isInternalCustomerProfile({ email: 'jane@acmecorp.com', is_qa_account: false, plan: 'pro' }),
  'Genuine paying customer NOT excluded',
);
assert(isInternalCustomerProfile(null), 'Null profile excluded (fail safe)');
ok('is_qa_account DB flag and owner plan excluded; genuine customers retained');

// ── Consolidated module is the single source ──
const consolidated = read('lib/owner/internalAccountFilters.ts');
assert(consolidated.includes('isInternalCustomerProfile'), 'Consolidated module exports profile filter');
assert(consolidated.includes('is_qa_account'), 'Consolidated module checks is_qa_account');

const legacy = read('lib/owner/founderCustomerFilters.ts');
assert(
  legacy.includes("from './internalAccountFilters'") && legacy.includes('export'),
  'Legacy founderCustomerFilters re-exports the consolidated module (no duplicate logic)',
);
ok('Single source of truth: founderCustomerFilters re-exports internalAccountFilters');

// ── Every metric source selects is_qa_account and uses the profile filter ──
const metricSources = [
  'lib/owner/metrics.ts',
  'lib/owner/businessHealthMetrics.ts',
  'lib/owner/customerHealth.ts',
  'lib/owner/customerExpansion.ts',
  'lib/owner/activityFeed.ts',
  'lib/owner/founderOsV5.ts',
  'lib/owner/ceoDashboard.ts',
  'lib/owner/customerIntelligence.ts',
];

for (const src of metricSources) {
  const content = read(src);
  assert(content.includes('is_qa_account'), `${src} selects is_qa_account`);
  assert(
    content.includes('isInternalCustomerProfile'),
    `${src} filters via isInternalCustomerProfile`,
  );
  ok(`${src} excludes QA/internal accounts`);
}

// ── Paid conversion + revenue-at-risk also exclude internal ──
const attribution = read('lib/owner/prospectAttribution.ts');
assert(attribution.includes('isInternalCustomerEmail'), 'Paid conversion excludes internal emails');
ok('Paid-conversion reconciliation excludes internal/test accounts');

console.log('\nAll founder metric exclusion checks passed.');
console.log('\nManual check: flag a profile is_qa_account=true with a real email,');
console.log('then confirm it does not appear in MRR, customers, trials, or health.');
