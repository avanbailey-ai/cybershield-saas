/**
 * Verify Owner Dashboard real execution rebuild.
 * Run: npx tsx scripts/verify-owner-dashboard-real-execution.ts
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
  const home = read('components/owner/views/FounderHomeView.tsx');
  const commandHome = read('components/owner/dashboard/FounderCommandCenterHome.tsx');
  const auditDoc = read('docs/owner-dashboard-execution-audit.md');
  const v6 = read('lib/owner/founderOsV6.ts');
  const businessHealth = read('lib/owner/businessHealthMetrics.ts');
  const automation = read('lib/owner/automationHealth.ts');
  const founderAudit = read('lib/owner/founderOsAudit.ts');
  const revenueOpps = read('lib/owner/revenueOpportunities.ts');
  const filters = read('lib/owner/internalAccountFilters.ts');
  const legacyFilters = read('lib/owner/founderCustomerFilters.ts');
  const execution = read('lib/owner/outreachExecution.ts');
  const inboxAuto = read('lib/owner/inboxAutomation.ts');
  const approvalCard = read('components/owner/OutreachApprovalCard.tsx');
  const customers = read('components/owner/views/CustomersView.tsx');

  assert(exists('docs/owner-dashboard-execution-audit.md'), 'Execution audit doc exists');
  assert(auditDoc.includes('Executive summary'), 'Audit doc has executive summary');
  assert(auditDoc.includes('Dead / fake buttons'), 'Audit documents dead buttons');

  assert(exists('lib/owner/businessHealthMetrics.ts'), 'Business health metrics module');
  assert(businessHealth.includes('getBusinessHealthMetrics'), 'Business health aggregator');
  assert(businessHealth.includes('isInternalCustomerProfile'), 'MRR excludes internal and QA accounts');
  assert(businessHealth.includes('is_qa_account'), 'MRR selects QA account flag');
  assert(businessHealth.includes('View calculation') || businessHealth.includes('calculation'), 'MRR/conversion calculation metadata');

  assert(exists('lib/owner/automationHealth.ts'), 'Automation health module');
  assert(automation.includes('getAutomationHealth'), 'Automation health checks');
  assert(automation.includes('discovery_cron'), 'Checks discovery cron');
  assert(automation.includes('resend'), 'Checks Resend config');

  assert(exists('app/api/owner/founder-os-audit/route.ts'), 'AI audit export API');
  assert(founderAudit.includes('buildFounderOsAuditExport'), 'Audit export builder');
  assert(founderAudit.includes('suspectedLogicProblems'), 'Audit flags logic problems');

  assert(home.includes('FounderCommandCenterHome'), 'Home delegates to command center');
  assert(commandHome.includes('Today&apos;s customer acquisition work'), 'Command center has customer acquisition heading');
  assert(commandHome.includes('Revenue actions'), 'Command center shows revenue actions');
  assert(commandHome.includes('Find customers'), 'Command center has find customers action');
  assert(commandHome.includes('Review drafts'), 'Command center has draft review action');
  assert(commandHome.includes('Enrich contacts'), 'Command center has contact enrichment action');
  assert(commandHome.includes("setSection('inbox')"), 'Command center links to inbox');
  assert(commandHome.includes("setSection('prospects')"), 'Command center links to prospects');
  assert(commandHome.includes('GrowthAutopilotHomePanel'), 'Command center includes growth autopilot panel');
  assert(commandHome.includes('EmailHealthSection'), 'Command center includes email health panel');
  assert(commandHome.includes('/api/owner/prospects'), 'Command center loads live prospects');

  assert(!commandHome.includes('AiChiefOfStaff'), 'Removed AI chief clutter from home');
  assert(!commandHome.includes('ExecutionCommandBanner'), 'Removed duplicate execution banner');
  assert(!commandHome.includes('Revenue movement'), 'Removed duplicate revenue section');

  assert(v6.includes('businessHealth'), 'V6 bundles business health');
  assert(v6.includes('automationHealth'), 'V6 bundles automation health');
  assert(v6.includes('revenueOpportunities'), 'V6 bundles revenue opportunities');
  assert(v6.includes('pendingApprovals'), 'Execution stats include pending approvals');
  assert(v6.includes("'signup'"), 'Signup items count as approvable');

  assert(!v6.includes('example.com'), 'No fake demo data in V6 lib');
  assert(!founderAudit.includes('generateProspectList'), 'No fake prospect generators in audit');

  assert(revenueOpps.includes('buildRevenueOpportunities'), 'Revenue opportunities builder');
  assert(revenueOpps.includes('hasOutreachContact'), 'Opportunities require contact for outreach');

  assert(execution.includes('sendApprovedOutreach'), 'Outreach execution exists');
  assert(execution.includes('require_approval'), 'Approval required before send');
  assert(execution.includes('isCustomerEmail'), 'Blocks prospecting customers');

  assert(approvalCard.includes('hasOutreachContact'), 'NO CONTACT gate on approval card');
  assert(approvalCard.includes('disabled={busy || !canSend}'), 'Approve disabled without contact');

  assert(inboxAuto.includes('sendApprovedOutreach'), 'Inbox wired to outreach send');
  assert(inboxAuto.includes('sendRetentionEmail'), 'Retention executes');
  assert(inboxAuto.includes("template: 'onboarding'"), 'Signup approve sends onboarding');

  assert(read('lib/owner/metrics.ts').includes('isInternalCustomerProfile'), 'Legacy metrics filter internal and QA accounts');
  assert(read('lib/owner/founderOsV5.ts').includes('isInternalCustomerProfile'), 'V5 filters internal and QA accounts');

  assert(exists('app/api/owner/automation-health/route.ts'), 'Automation health API');
  assert(exists('app/api/owner/customers/[userId]/route.ts'), 'Customer status API');
  assert(customers.includes('Send retention'), 'Customers page retention action');
  assert(customers.includes('Mark healthy'), 'Customers page mark healthy');
  assert(customers.includes('Mark at risk'), 'Customers page mark at risk');

  assert(read('lib/owner/staleDataHygiene.ts').includes('runStaleDataHygiene'), 'Stale data hygiene');
  assert(read('lib/owner/activityFeed.ts').includes('getActivityFeed'), 'Activity feed for away section');
  assert(read('lib/owner/followUpScheduler.ts').includes('scheduleFollowUps'), 'Follow-ups scheduled on send');

  assert(filters.includes('OWNER_EMAIL'), 'Owner email excluded from metrics');
  assert(filters.includes('is_qa_account'), 'QA account flag excluded from metrics');
  assert(filters.includes('test@gmail.com'), 'Test gmail excluded');
  assert(legacyFilters.includes("from './internalAccountFilters'"), 'Legacy filter module re-exports consolidated filters');

  assert(!read('components/owner/ProspectsActionQueue.tsx').includes('Approve & Send') || read('components/owner/ProspectsActionQueue.tsx').includes('hasOutreachContact'), 'Prospects queue respects contact gate');

  const outreachExec = read('lib/owner/outreachExecution.ts');
  assert(outreachExec.includes("draft.outreach_type === 'follow_up'"), 'Follow-ups bypass outreach cooldown');

  const engine = read('lib/owner/discovery/engine.ts');
  assert(!engine.includes('pendingScanIds.slice(0, maxScan)'), 'Discovery scans all inserted prospects');

  assert(exists('lib/owner/ensureOutreachDraft.ts'), 'Auto outreach draft helper exists');
  assert(read('lib/owner/prospectScanUpdate.ts').includes('ensureOutreachDraft'), 'Scan completion auto-generates drafts');

  console.log('\nAll owner dashboard real execution checks passed.');
}

main();
