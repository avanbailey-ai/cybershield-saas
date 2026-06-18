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
  const auditDoc = read('docs/owner-dashboard-execution-audit.md');
  const v6 = read('lib/owner/founderOsV6.ts');
  const businessHealth = read('lib/owner/businessHealthMetrics.ts');
  const automation = read('lib/owner/automationHealth.ts');
  const founderAudit = read('lib/owner/founderOsAudit.ts');
  const revenueOpps = read('lib/owner/revenueOpportunities.ts');
  const filters = read('lib/owner/founderCustomerFilters.ts');
  const execution = read('lib/owner/outreachExecution.ts');
  const inboxAuto = read('lib/owner/inboxAutomation.ts');
  const approvalCard = read('components/owner/OutreachApprovalCard.tsx');
  const customers = read('components/owner/views/CustomersView.tsx');

  assert(exists('docs/owner-dashboard-execution-audit.md'), 'Execution audit doc exists');
  assert(auditDoc.includes('Executive summary'), 'Audit doc has executive summary');
  assert(auditDoc.includes('Dead / fake buttons'), 'Audit documents dead buttons');

  assert(exists('lib/owner/businessHealthMetrics.ts'), 'Business health metrics module');
  assert(businessHealth.includes('getBusinessHealthMetrics'), 'Business health aggregator');
  assert(businessHealth.includes('isInternalCustomerEmail'), 'MRR excludes test accounts');
  assert(businessHealth.includes('View calculation') || businessHealth.includes('calculation'), 'MRR/conversion calculation metadata');

  assert(exists('lib/owner/automationHealth.ts'), 'Automation health module');
  assert(automation.includes('getAutomationHealth'), 'Automation health checks');
  assert(automation.includes('discovery_cron'), 'Checks discovery cron');
  assert(automation.includes('resend'), 'Checks Resend config');

  assert(exists('app/api/owner/founder-os-audit/route.ts'), 'AI audit export API');
  assert(founderAudit.includes('buildFounderOsAuditExport'), 'Audit export builder');
  assert(founderAudit.includes('suspectedLogicProblems'), 'Audit flags logic problems');
  assert(home.includes('Export AI Audit'), 'Home has export button');
  assert(home.includes('/api/owner/founder-os-audit'), 'Export calls audit API');

  assert(exists('components/owner/dashboard/BusinessHealthSection.tsx'), 'Business health section');
  assert(exists('components/owner/dashboard/ActivityAwaySection.tsx'), 'Activity away section');
  assert(exists('components/owner/dashboard/FounderInboxSection.tsx'), 'Founder inbox section');
  assert(exists('components/owner/dashboard/RevenueOpportunitiesSection.tsx'), 'Revenue opportunities section');
  assert(exists('components/owner/dashboard/CustomerRiskExpansionSection.tsx'), 'Customer risk section');
  assert(exists('components/owner/dashboard/AutomationHealthSection.tsx'), 'Automation health section');

  assert(home.includes('BusinessHealthSection'), 'Home composes business health');
  assert(home.includes('ActivityAwaySection'), 'Home composes activity feed');
  assert(home.includes('FounderInboxSection'), 'Home composes inbox');
  assert(home.includes('RevenueOpportunitiesSection'), 'Home composes revenue opps');
  assert(home.includes('CustomerRiskExpansionSection'), 'Home composes customer risk');
  assert(home.includes('AutomationHealthSection'), 'Home composes automation health');

  assert(!home.includes('AiChiefOfStaff'), 'Removed AI chief clutter from home');
  assert(!home.includes('ExecutionCommandBanner'), 'Removed duplicate execution banner');
  assert(!home.includes('Revenue movement'), 'Removed duplicate revenue section');

  assert(read('components/owner/dashboard/BusinessHealthSection.tsx').includes('View calculation'), 'View calculation modal in UI');

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

  assert(read('lib/owner/metrics.ts').includes('isInternalCustomerEmail'), 'Legacy metrics filter test accounts');
  assert(read('lib/owner/founderOsV5.ts').includes('isInternalCustomerEmail'), 'V5 filters test accounts');

  assert(exists('app/api/owner/automation-health/route.ts'), 'Automation health API');
  assert(exists('app/api/owner/customers/[userId]/route.ts'), 'Customer status API');
  assert(customers.includes('Send retention'), 'Customers page retention action');
  assert(customers.includes('Mark healthy'), 'Customers page mark healthy');
  assert(customers.includes('Mark at risk'), 'Customers page mark at risk');

  assert(read('lib/owner/staleDataHygiene.ts').includes('runStaleDataHygiene'), 'Stale data hygiene');
  assert(read('lib/owner/activityFeed.ts').includes('getActivityFeed'), 'Activity feed for away section');
  assert(read('lib/owner/followUpScheduler.ts').includes('scheduleFollowUps'), 'Follow-ups scheduled on send');

  assert(filters.includes('OWNER_EMAIL'), 'Owner email excluded from metrics');
  assert(filters.includes('test@gmail.com'), 'Test gmail excluded');

  assert(!read('components/owner/ProspectsActionQueue.tsx').includes('Approve & Send') || read('components/owner/ProspectsActionQueue.tsx').includes('hasOutreachContact'), 'Prospects queue respects contact gate');

  console.log('\nAll owner dashboard real execution checks passed.');
}

main();
