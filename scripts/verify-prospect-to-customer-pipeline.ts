import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pipelineStateFromScan } from '../lib/owner/pipeline';

const root = join(__dirname, '..');

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

function main() {
  assert(exists('lib/owner/interestedLeadApproval.ts'), 'Interested lead approval module');
  const interested = read('lib/owner/interestedLeadApproval.ts');
  assert(interested.includes("pipeline_state: 'interested'"), 'Interested approval sets pipeline state');
  assert(interested.includes('owner_crm_leads'), 'Interested approval updates CRM');
  assert(interested.includes('prospect_interested'), 'Interested approval logs event');
  assert(interested.includes('owner_inbox_dismissals'), 'Interested approval dismisses inbox item');

  const inbox = read('lib/owner/inboxAutomation.ts');
  assert(inbox.includes('approveInterestedLead'), 'Inbox routes interested approval to real handler');
  assert(!inbox.includes('Review interested prospect'), 'Interested stub removed');

  const pipeline = read('lib/owner/pipeline.ts');
  assert(pipeline.includes("input.leadScore === 'WARM'"), 'WARM promotion logic exists');
  assert(pipeline.includes('meaningfulFinding'), 'Meaningful finding gate for WARM');
  assert(pipeline.includes("input.leadScore === 'LOW'"), 'LOW stays qualified');

  const attribution = read('lib/owner/prospectAttribution.ts');
  assert(attribution.includes('owner_prospect_attributions'), 'Attribution table used');
  assert(attribution.includes('buildAttributionSignupUrl'), 'Signup URL builder');
  assert(attribution.includes('captureSignupAttribution'), 'Signup capture');
  assert(attribution.includes('reconcilePaidConversions'), 'Paid conversion reconciliation');

  const outreach = read('lib/owner/outreachExecution.ts');
  assert(outreach.includes('getOrCreateAttributionToken'), 'Outreach send creates attribution token');
  assert(outreach.includes('appendAttributionLink'), 'Outreach email includes attribution link');

  const signup = read('components/auth/SignupForm.tsx');
  assert(signup.includes('prospect_attribution_token'), 'Signup stores attribution token');
  assert(signup.includes('/api/attribution/signup'), 'Signup posts attribution on account create');

  assert(exists('app/api/attribution/signup/route.ts'), 'Attribution signup API');
  assert(exists('app/api/attribution/click/route.ts'), 'Attribution click API');
  assert(exists('supabase/migrations/20260620000000_prospect_attribution.sql'), 'Attribution migration');

  const migration = read('supabase/migrations/20260620000000_prospect_attribution.sql');
  assert(migration.includes('owner_prospect_attributions'), 'Migration creates attributions table');
  assert(migration.includes('prospect_id'), 'CRM prospect_id column');

  const cron = read('app/api/cron/prospect-discovery/route.ts');
  assert(cron.includes('reconcilePaidConversions'), 'Cron reconciles paid conversions');

  const scanUpdate = read('lib/owner/prospectScanUpdate.ts');
  assert(scanUpdate.includes('ensureOutreachDraft'), 'Scan still auto-generates drafts');
  assert(scanUpdate.includes('scanIssues'), 'Scan passes issues for qualification');

  assert(
    pipelineStateFromScan({
      scanStatus: 'completed',
      leadScore: 'WARM',
      hasContactEmail: true,
      opportunityScore: 40,
      scanIssues: ['Missing HSTS'],
    }) === 'outreach_ready',
    'WARM + contact + finding → outreach_ready',
  );

  assert(
    pipelineStateFromScan({
      scanStatus: 'completed',
      leadScore: 'WARM',
      hasContactEmail: false,
      opportunityScore: 40,
      scanIssues: ['Missing HSTS'],
    }) === 'needs_contact',
    'WARM without contact → needs_contact',
  );

  assert(
    pipelineStateFromScan({
      scanStatus: 'completed',
      leadScore: 'LOW',
      hasContactEmail: true,
      opportunityScore: 60,
      scanIssues: ['Issue'],
    }) === 'qualified',
    'LOW does not auto-promote to outreach_ready',
  );

  console.log('\nAll prospect-to-customer pipeline checks passed.');
}

function exists(rel: string): boolean {
  return existsSync(join(root, rel));
}

main();
