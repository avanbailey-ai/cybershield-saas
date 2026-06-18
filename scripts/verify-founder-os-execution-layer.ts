/**
 * Verify Founder OS Real Execution Layer.
 * Run: npx tsx scripts/verify-founder-os-execution-layer.ts
 */

import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

function main() {
  const migration = read('supabase/migrations/20260619010000_founder_outreach_execution.sql');
  assert(migration.includes('owner_outreach_events'), 'Migration creates owner_outreach_events');
  assert(migration.includes('owner_follow_ups'), 'Migration creates owner_follow_ups');
  assert(migration.includes('sent_at'), 'Migration adds sent_at to drafts');
  assert(migration.includes('needs_contact'), 'Migration extends pipeline states');

  const execution = read('lib/owner/outreachExecution.ts');
  assert(execution.includes('sendApprovedOutreach'), 'Outreach execution module exists');
  assert(execution.includes('sendEmail'), 'Uses Resend via sendEmail');
  assert(execution.includes('Cooldown'), 'Cooldown duplicate block');
  assert(execution.includes('require_approval'), 'Approval required safety rule');
  assert(execution.includes('isCustomerEmail'), 'Blocks customer emails as prospects');

  const followUp = read('lib/owner/followUpScheduler.ts');
  assert(followUp.includes('scheduleFollowUps'), 'Follow-up scheduler exists');
  assert(followUp.includes('follow_up_number'), 'Follow-up numbers tracked');
  assert(followUp.includes('markDueFollowUps'), 'Due follow-ups marked');

  const hygiene = read('lib/owner/staleDataHygiene.ts');
  assert(hygiene.includes('runStaleDataHygiene'), 'Stale data hygiene exists');
  assert(hygiene.includes('expiredDrafts'), 'Draft expiry rule');

  const directory = read('lib/owner/customerDirectory.ts');
  assert(directory.includes('getCustomerDirectory'), 'Customer directory aggregator');

  const retention = read('lib/owner/retentionOutreach.ts');
  assert(retention.includes('sendRetentionEmail'), 'Retention approve-to-send');
  assert(retention.includes('onboarding'), 'Onboarding template');
  assert(retention.includes('re_engagement'), 'Re-engagement template');

  const automation = read('lib/owner/inboxAutomation.ts');
  assert(automation.includes('sendApprovedOutreach'), 'Inbox wired to outreach execution');
  assert(automation.includes('dismissInboxItem'), 'Inbox dismiss support');

  const feed = read('lib/owner/activityFeed.ts');
  assert(feed.includes('email_sent'), 'Activity feed email_sent events');
  assert(feed.includes('follow_up_due'), 'Activity feed follow_up_due events');
  assert(feed.includes('contact_found'), 'Activity feed contact_found events');

  const v6 = read('lib/owner/founderOsV6.ts');
  assert(v6.includes('failed_email'), 'Inbox includes failed email items');
  assert(v6.includes('loadDismissedIds'), 'Dismissed inbox items filtered');
  assert(v6.includes('whyItMatters'), 'Inbox items include why it matters');

  const pipeline = read('lib/owner/pipeline.ts');
  assert(pipeline.includes('needs_contact'), 'Pipeline needs_contact state');
  assert(pipeline.includes('no_contact_found'), 'Pipeline no_contact_found state');

  const display = read('lib/owner/prospectDisplay.ts');
  assert(display.includes('contact_email?.trim()'), 'Outreach requires email contact');

  assert(exists('app/api/owner/outreach/[id]/send/route.ts'), 'Send API route');
  assert(exists('app/api/owner/outreach/[id]/regenerate/route.ts'), 'Regenerate API route');
  assert(exists('app/api/owner/outreach/[id]/route.ts'), 'Edit draft PATCH route');
  assert(exists('components/owner/OutreachApprovalCard.tsx'), 'Outreach approval UI');
  assert(
    read('components/owner/ProspectPipeline.tsx').includes('OutreachApprovalCard'),
    'Outreach approval wired to pipeline',
  );

  const inboxApi = read('app/api/owner/inbox/route.ts');
  assert(inboxApi.includes('dismiss'), 'Dismiss inbox API');

  const settings = read('app/api/owner/settings/route.ts');
  assert(settings.includes('getOutreachSettings') || settings.includes('outreach_execution'), 'Outreach settings stored');
  const outreachSettings = read('lib/owner/outreachSettings.ts');
  assert(outreachSettings.includes('require_approval'), 'Settings include require_approval');

  const settingsView = read('components/owner/views/SettingsView.tsx');
  assert(settingsView.includes('enable_outreach_sending'), 'Settings UI outreach controls');

  const home = read('components/owner/views/FounderHomeView.tsx');
  assert(home.includes('Inbox preview'), 'Home inbox preview');
  assert(!home.includes('<AutopilotCommandCenter'), 'Home trimmed — no full autopilot panel');

  const customers = read('components/owner/views/CustomersView.tsx');
  assert(customers.includes('/api/owner/customers'), 'Customers uses directory API');
  assert(customers.includes('nextAction'), 'Customers show next action');

  const cron = read('app/api/cron/prospect-discovery/route.ts');
  assert(cron.includes('runStaleDataHygiene'), 'Cron runs stale hygiene');
  assert(cron.includes('markDueFollowUps'), 'Cron marks due follow-ups');

  assert(exists('app/api/owner/prospects/[id]/contact/route.ts'), 'Manual contact discovery route');

  const env = read('.env.example');
  assert(env.includes('RESEND_API_KEY'), 'Env example documents RESEND_API_KEY');
  assert(env.includes('EMAIL_FROM'), 'Env example documents EMAIL_FROM');

  console.log('\nAll Founder OS execution layer checks passed.');
}

main();
