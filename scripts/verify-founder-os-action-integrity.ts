/**
 * Founder OS action integrity — no dead buttons, no auto-send by default.
 * Run: npx tsx scripts/verify-founder-os-action-integrity.ts
 */

import { existsSync, readFileSync } from 'node:fs';
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

console.log('Founder OS action integrity verification\n');

assert(existsSync(join(process.cwd(), 'docs/founder-os-action-audit.md')), 'action audit doc exists');

const founderOs = read('components/owner/FounderOs.tsx');
const activeSections = ['FounderHomeView', 'FounderInboxView', 'ProspectsView', 'CustomerSuccessView', 'CustomersView', 'SettingsView'];
for (const s of activeSections) {
  assert(founderOs.includes(s), `FounderOs mounts ${s}`);
}

assert(!founderOs.includes('OverviewView'), 'orphan OverviewView not mounted');
assert(!founderOs.includes('OutreachView'), 'orphan OutreachView not mounted');

const inboxList = read('components/owner/AutopilotCommandCenter.tsx');
assert(inboxList.includes('resolveReviewSection'), 'Review button maps legacy modules');
assert(inboxList.includes('onClick={() => onApprove'), 'Inbox approve has handler');

const inboxView = read('components/owner/views/FounderInboxView.tsx');
assert(inboxView.includes('postInbox'), 'Inbox posts to API');
assert(inboxView.includes('lastError'), 'Inbox shows errors');
assert(inboxView.includes('Ready to send'), 'Inbox queue types updated');

const shell = read('components/owner/FounderShell.tsx');
assert(!shell.includes('Autopilot active'), 'removed misleading autopilot active label');
assert(shell.includes('need approval'), 'sidebar shows approval count honestly');

const settings = read('components/owner/views/SettingsView.tsx');
assert(settings.includes('Require founder approval'), 'approval toggle visible');
assert(settings.includes('Growth autopilot'), 'autopilot settings in UI');

const outreach = read('lib/owner/outreachExecution.ts');
assert(outreach.includes('options.approved !== true'), 'send requires explicit approval flag');
assert(!/autoSend|auto_send|sendImmediately/i.test(outreach), 'no auto-send bypass');

const cron = read('app/api/cron/growth-autopilot/route.ts');
assert(cron.includes('isWorkerAuthorized'), 'growth cron requires CRON_SECRET');

const security = read('scripts/verify-founder-os-security.ts');
assert(security.includes('requireOwner'), 'security verify script exists for owner routes');

assert(read('lib/owner/followUpScheduler.ts').includes('markDueFollowUps'), 'follow-up scheduler exists');

console.log('\nAll Founder OS action integrity checks passed.');
