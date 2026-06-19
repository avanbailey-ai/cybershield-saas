/**
 * Cron reliability verification.
 *
 * For every cron in vercel.json:
 *   - the route handler exists on disk
 *   - it exports a GET handler (Vercel Cron invokes scheduled routes with GET)
 *   - it enforces CRON_SECRET via isWorkerAuthorized (or equivalent owner/worker auth)
 *
 * Run: npx tsx scripts/verify-cron-reliability.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function fail(message: string): never {
  throw new Error(`FAIL: ${message}`);
}

function ok(message: string): void {
  console.log(`OK: ${message}`);
}

function warn(message: string): void {
  console.log(`KNOWN ISSUE: ${message}`);
}

function read(rel: string): string {
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) fail(`Missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

console.log('CyberShield cron reliability verification\n');

const vercel = JSON.parse(read('vercel.json')) as {
  crons?: { path: string; schedule: string }[];
};

const crons = vercel.crons ?? [];
if (crons.length === 0) fail('vercel.json declares no crons');
ok(`Found ${crons.length} scheduled crons in vercel.json`);

const AUTH_PATTERN = /isWorkerAuthorized|CRON_SECRET|requireOwner|isOwner/;

let problems = 0;

for (const cron of crons) {
  const routeRel = `app${cron.path}/route.ts`.replace(/\\/g, '/');
  if (!existsSync(join(process.cwd(), routeRel))) {
    console.error(`  FAIL: ${cron.path} → handler missing at ${routeRel}`);
    problems++;
    continue;
  }
  const content = read(routeRel);

  const hasGet = /export\s+(async\s+)?function\s+GET/.test(content);
  const hasPost = /export\s+(async\s+)?function\s+POST/.test(content);
  const hasAuth = AUTH_PATTERN.test(content);

  if (!hasGet) {
    console.error(
      `  FAIL: ${cron.path} → no GET handler; Vercel Cron uses GET and will receive 405`,
    );
    problems++;
  }
  if (!hasPost) {
    warn(`${cron.path} → no POST handler (manual trigger unavailable, GET still works)`);
  }
  if (!hasAuth) {
    console.error(`  FAIL: ${cron.path} → no CRON_SECRET / worker authorization found`);
    problems++;
  }

  if (hasGet && hasAuth) {
    ok(`${cron.path} → GET handler + authorization (schedule: ${cron.schedule})`);
  }
}

// ── Worker auth implementation sanity ──
const workerAuth = read('lib/queue/workerAuth.ts');
if (!workerAuth.includes('CRON_SECRET')) fail('workerAuth must reference CRON_SECRET');
if (!/if\s*\(!cronSecret\)\s*return false/.test(workerAuth)) {
  fail('workerAuth must fail closed when CRON_SECRET is unset');
}
ok('workerAuth fails closed when CRON_SECRET is missing (no silent bypass)');

if (problems > 0) {
  fail(`${problems} cron reliability problem(s) found`);
}

console.log('\nAll cron reliability checks passed.');
console.log('\nProduction requirement:');
console.log('  - CRON_SECRET must be set in Vercel project env for crons to authorize.');
console.log('  - Verify: curl -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/admin-digest → 200');
console.log('  - Without CRON_SECRET set, all crons return 401 by design (fail closed).');
