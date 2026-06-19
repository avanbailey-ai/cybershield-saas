/**
 * Phase 1 production fixes — master verification.
 *
 * Runs every Phase 1 verification script in sequence and reports a summary.
 * Run: npx tsx scripts/verify-phase-1-production-fixes.ts
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPTS = [
  ['Founder OS security isolation', 'scripts/verify-founder-os-security.ts'],
  ['Cron reliability', 'scripts/verify-cron-reliability.ts'],
  ['Email production readiness', 'scripts/verify-email-production-readiness.ts'],
  ['Attribution hardening', 'scripts/verify-attribution-hardening.ts'],
  ['Founder metric exclusions', 'scripts/verify-founder-metric-exclusions.ts'],
  ['Product honesty', 'scripts/verify-product-honesty.ts'],
] as const;

console.log('═══════════════════════════════════════════════════');
console.log(' CyberShield Phase 1 production fixes — master verify');
console.log('═══════════════════════════════════════════════════\n');

const results: { name: string; ok: boolean }[] = [];

for (const [name, script] of SCRIPTS) {
  console.log(`\n──▶ ${name}  (${script})`);
  const res = spawnSync('npx', ['tsx', join(process.cwd(), script)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  results.push({ name, ok: res.status === 0 });
}

console.log('\n═══════════════════════════════════════════════════');
console.log(' Summary');
console.log('═══════════════════════════════════════════════════');
let allOk = true;
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok) allOk = false;
}

if (!allOk) {
  console.error('\nOne or more Phase 1 verifications FAILED.');
  process.exit(1);
}

console.log('\nAll Phase 1 verifications passed.');
console.log('\nStill required before/at production (provider + env side):');
console.log('  - CRON_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, EMAIL_TRACKING_SECRET in Vercel');
console.log('  - EMAIL_FROM=CyberShield <outreach@cybershieldcloud.com> (verified root) until mail subdomain DKIM verifies');
console.log('  - OWNER_EMAIL set; smoke-test the access matrix and one live outreach + monitoring email');
