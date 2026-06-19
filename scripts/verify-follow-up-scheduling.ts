/**
 * Follow-up scheduling integrity verification.
 *
 * Guards against duplicate follow-up scheduling for the same prospect/draft/stage:
 *   - scheduleFollowUps is idempotent (skips stages that already have an active row)
 *   - sending a follow-up does NOT cascade a new follow-up cadence
 *   - a DB partial unique index enforces one active follow-up per stage
 *   - (when Supabase creds present) no duplicate active follow-ups exist
 *
 * Run: npx tsx scripts/verify-follow-up-scheduling.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
function ok(message: string): void {
  console.log(`OK: ${message}`);
}
function read(rel: string): string {
  const p = join(process.cwd(), rel);
  assert(existsSync(p), `Missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

console.log('CyberShield follow-up scheduling verification\n');

// ── 1. Scheduler is idempotent per stage ──
const scheduler = read('lib/owner/followUpScheduler.ts');
assert(
  scheduler.includes("from('owner_follow_ups')") &&
    scheduler.includes("'scheduled', 'due'") &&
    /existingStages/.test(scheduler),
  'scheduleFollowUps loads existing active follow-ups and dedupes by stage',
);
assert(
  /existingStages\.has\(/.test(scheduler) && /continue/.test(scheduler),
  'scheduleFollowUps skips stages that already have an active follow-up',
);
ok('scheduleFollowUps is idempotent — no duplicate active stage per prospect/draft');

// ── 2. Follow-up sends do not cascade a new cadence ──
const exec = read('lib/owner/outreachExecution.ts');
assert(
  /outreach_type\s*!==\s*'follow_up'/.test(exec) &&
    /if\s*\(draft\.outreach_type\s*!==\s*'follow_up'\)[\s\S]{0,160}scheduleFollowUps/.test(exec),
  'sendApprovedOutreach only schedules follow-ups for initial outreach (no cascade on follow-up sends)',
);
ok('Follow-up sends do not schedule another follow-up cadence');

// ── 3. DB partial unique index migration exists ──
const migDir = 'supabase/migrations';
const migrations = existsSync(join(process.cwd(), migDir)) ? readdirSync(join(process.cwd(), migDir)) : [];
const indexMigration = migrations
  .filter((f) => f.endsWith('.sql'))
  .map((f) => read(join(migDir, f)))
  .find(
    (sql) =>
      /uniq_owner_follow_ups_active_stage/.test(sql) &&
      /follow_up_number/.test(sql) &&
      /scheduled.*due|'scheduled', 'due'/.test(sql),
  );
assert(Boolean(indexMigration), 'Partial unique index migration (uniq_owner_follow_ups_active_stage) exists');
ok('DB unique index enforces one active follow-up per prospect/draft/stage');

// ── 4. Live DB check — only when service credentials are available ──
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

async function scanLive(): Promise<string[]> {
  if (!supabaseUrl || !serviceKey) {
    console.log(
      '\nNOTE: Supabase service credentials not present — skipped live duplicate scan.\n' +
        '      Run with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to scan live follow-ups.',
    );
    return [];
  }
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from('owner_follow_ups')
    .select('prospect_id, draft_id, follow_up_number, status')
    .in('status', ['scheduled', 'due']);
  if (error) return [`live scan failed: ${error.message}`];

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const key = `${r.prospect_id}|${r.draft_id}|${r.follow_up_number}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dups = [...counts.entries()].filter(([, n]) => n > 1);
  if (dups.length === 0) {
    console.log(`\nLive scan: ${data?.length ?? 0} active follow-up(s), 0 duplicate stages.`);
    return [];
  }
  return dups.map(([k, n]) => `duplicate active follow-up stage (${n}x) for ${k}`);
}

scanLive()
  .then((problems) => {
    if (problems.length > 0) {
      console.error('\nFAIL: follow-up scheduling issues found:');
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
    console.log('\nAll follow-up scheduling checks passed.');
  })
  .catch((err) => {
    console.error('\nFAIL: verification crashed:', err);
    process.exit(1);
  });
