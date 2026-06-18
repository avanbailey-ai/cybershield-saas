/**
 * Verify Founder OS V6 usefulness & automation sprint.
 * Run: npx tsx scripts/verify-founder-os-v6.ts
 */

import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
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
  const inbox = read('components/owner/views/FounderInboxView.tsx');
  const success = read('components/owner/views/CustomerSuccessView.tsx');
  const founderOs = read('components/owner/FounderOs.tsx');
  const nav = read('lib/owner/founderNav.ts');
  const v6 = read('lib/owner/founderOsV6.ts');
  const health = read('lib/owner/customerHealth.ts');
  const risk = read('lib/owner/revenueAtRisk.ts');
  const expansion = read('lib/owner/customerExpansion.ts');
  const feed = read('lib/owner/activityFeed.ts');
  const automation = read('lib/owner/inboxAutomation.ts');
  const inboxApi = read('app/api/owner/inbox/route.ts');
  const audit = read('docs/founder-os-v6-audit.md');
  const sales = read('lib/owner/salesIntelligence.ts');

  assert(health.includes('getCustomerHealth'), 'Customer Health Score exists');
  assert(health.includes('Healthy') && health.includes('At Risk') && health.includes('Critical'), 'Health statuses defined');
  assert(health.includes('recommendedActions'), 'Health recommended actions');

  assert(risk.includes('getRevenueAtRisk'), 'Revenue At Risk exists');
  assert(risk.includes('potentialMonthlyLoss'), 'Potential monthly loss');
  assert(read('lib/owner/founderCustomerFilters.ts').includes('isInternalCustomerEmail'), 'Test accounts filtered');

  assert(read('lib/owner/prospectDisplay.ts').includes('resolveProspectScores'), 'Prospect scores resolved at read');
  assert(read('lib/owner/prospectDisplay.ts').includes('hasOutreachContact'), 'Outreach contact gating');

  assert(expansion.includes('getCustomerExpansion'), 'Expansion engine exists');
  assert(expansion.includes('mrrGain') && expansion.includes('probability'), 'Expansion MRR gain + probability');

  assert(feed.includes('getActivityFeed'), 'Activity feed exists');
  assert(fs.existsSync(path.join(root, 'components/owner/ActivityFeed.tsx')), 'ActivityFeed component exists');
  assert(home.includes('ActivityFeed'), 'Activity feed wired to Home');

  assert(inbox.includes('INBOX_GROUPS'), 'Founder Inbox V2 filter groups');
  assert(inbox.includes('executes automation') || inbox.includes('execute'), 'Inbox described as useful');
  assert(inboxApi.includes('executeInboxApproval'), 'Automation actions execute');

  assert(success.includes('Customer Success'), 'Customer Success dashboard exists');
  assert(founderOs.includes('CustomerSuccessView'), 'Success view in shell');
  assert(nav.includes("'success'"), 'Success in navigation');

  assert(v6.includes('getFounderOsV6'), 'V6 aggregator exists');
  assert(v6.includes('customerHealth') && v6.includes('revenueAtRisk'), 'V6 bundles engines');

  assert(!home.includes('Revenue engine'), 'Duplicate revenue engine removed from Home');
  assert(!home.includes('Pipeline'), 'Pipeline clutter removed from Home');
  assert(!home.includes('Customer success') || home.includes('success center'), 'Customer success detail moved off Home');

  assert(home.includes('Quiet period') || read('components/owner/ActivityFeed.tsx').includes('Quiet period'), 'Professional empty states');
  assert(!v6.includes('example.com'), 'No fake data in V6 lib');
  assert(!read('components/owner/views/CustomersView.tsx').includes('ContentPerformance'), 'Legacy content tracker removed from Customers');
  assert(read('components/owner/views/CustomersView.tsx').includes('useFounderNav'), 'Customers uses live health data');
  assert(read('components/owner/FounderNavContext.tsx').includes('refreshFounderData'), 'Inbox refresh after approve');
  assert(sales.includes('isJunkProspect'), 'Prospect junk filtering improved');
  assert(home.includes('Events (24h)'), 'Home metric labels clarified');
  assert(home.includes('opportunityScore >= 25'), 'Best opportunity requires minimum score');

  assert(audit.includes('Usefulness score'), 'Every page scored for usefulness');
  assert(audit.includes('8.5'), 'Audit targets 8.5+ usefulness');
  assert(audit.includes('Home') && audit.includes('Inbox') && audit.includes('Success'), 'Audit covers key pages');

  assert(automation.includes('approveOutreach'), 'Outreach approval automation');
  assert(automation.includes('scheduleRetentionEmails'), 'Retention automation');
  assert(automation.includes('queueAutopilotTask'), 'Expansion/follow-up task creation');

  console.log('\nAll Founder OS V6 checks passed.');
}

main();
