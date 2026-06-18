/**
 * Static QA customer simulation checklist — code-path verification.
 * Run: npx tsx scripts/run-qa-customer-simulation.ts
 *
 * Live browser/auth tests require logging in as a flagged QA account (test@gmail.com).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

type Priority = 'critical' | 'high' | 'medium' | 'low';
type Status = 'pass' | 'fail' | 'manual';

interface QaCheck {
  scenario: string;
  item: string;
  status: Status;
  priority: Priority;
  notes: string;
}

const checks: QaCheck[] = [];

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function add(
  scenario: string,
  item: string,
  status: Status,
  priority: Priority,
  notes: string,
): void {
  checks.push({ scenario, item, status, priority, notes });
}

function checkFile(scenario: string, item: string, rel: string, priority: Priority = 'high') {
  add(
    scenario,
    item,
    fileExists(rel) ? 'pass' : 'fail',
    priority,
    fileExists(rel) ? `Found ${rel}` : `Missing ${rel}`,
  );
}

// Scenario infrastructure
checkFile('QA Mode', 'is_qa_account migration', 'supabase/migrations/20260620160000_qa_account_flag.sql', 'critical');
checkFile('QA Mode', 'qaAccount helpers', 'lib/auth/qaAccount.ts', 'critical');
checkFile('QA Mode', 'qaAccessService', 'lib/billing/qaAccessService.ts', 'critical');
checkFile('QA Mode', 'QA plan switcher API', 'app/api/user/qa-simulated-plan/route.ts', 'high');
checkFile('QA Mode', 'QA settings panel', 'components/dashboard/QaSimulationPanel.tsx', 'medium');

// Customer routes (static presence)
const routes: Array<[string, string, string]> = [
  ['2 — Websites', 'Websites list', 'app/dashboard/websites/page.tsx'],
  ['3 — Scanning', 'Scans page', 'app/dashboard/scans/page.tsx'],
  ['4 — Health Center', 'Health page', 'app/dashboard/websites/[id]/health/page.tsx'],
  ['5 — Change Timeline', 'Changes page', 'app/dashboard/websites/[id]/changes/page.tsx'],
  ['6 — SSL', 'SSL widget', 'components/dashboard/SslStatusWidget.tsx'],
  ['7 — Domain', 'Domain widget', 'components/dashboard/DomainHealthWidget.tsx'],
  ['8 — Alerts', 'Alerts inbox', 'app/dashboard/alerts/page.tsx'],
  ['8 — Alerts', 'Alert grouping', 'lib/alerts/groupAlertsForDisplay.ts'],
  ['10 — Reports', 'Reports list', 'app/dashboard/reports/page.tsx'],
  ['10 — Reports', 'Report detail', 'app/report/[id]/page.tsx'],
  ['11 — Billing', 'Billing card', 'components/dashboard/BillingCard.tsx'],
  ['12 — Agency', 'Enterprise portal', 'app/enterprise/portal/page.tsx'],
];

for (const [scenario, item, rel] of routes) {
  checkFile(scenario, item, rel);
}

// Polish features from beta sprint
add(
  '5 — Change Timeline',
  'Timeline noise reduction',
  fileExists('lib/scanChanges/transformTimelineEvents.ts') ? 'pass' : 'fail',
  'high',
  'Grouped business-friendly events',
);

add(
  '4 — Health Center',
  'Health verdict banner',
  fs.readFileSync(path.join(ROOT, 'components/dashboard/websites/WebsiteHealthCenter.tsx'), 'utf8').includes('verdict')
    ? 'pass'
    : 'fail',
  'high',
  'computeHealthVerdict integration',
);

// Manual-only scenarios
const manual: Array<[string, string, string, Priority]> = [
  ['1 — Account', 'Signup/login/session', 'Requires test@gmail.com auth session', 'critical'],
  ['3 — Scanning', 'End-to-end scan completion', 'Trigger scan on QA account website', 'critical'],
  ['9 — Emails', 'Alert/digest delivery', 'Verify Resend + cron with QA prefs', 'high'],
  ['13 — Failures', 'Invalid URL / offline UX', 'Browser test error states', 'medium'],
];

for (const [scenario, item, notes, priority] of manual) {
  add(scenario, item, 'manual', priority, notes);
}

const passed = checks.filter((c) => c.status === 'pass').length;
const failed = checks.filter((c) => c.status === 'fail').length;
const manualCount = checks.filter((c) => c.status === 'manual').length;

console.log('\n=== CyberShield QA Customer Simulation Report (static) ===\n');
console.log(`Passed: ${passed} | Failed: ${failed} | Manual required: ${manualCount}\n`);

for (const c of checks) {
  const icon = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '○';
  console.log(`${icon} [${c.priority.toUpperCase()}] ${c.scenario} — ${c.item}`);
  console.log(`    ${c.notes}\n`);
}

if (failed > 0) {
  process.exitCode = 1;
}
