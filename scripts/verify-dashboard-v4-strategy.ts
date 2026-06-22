/**
 * Verify Dashboard V4 master redesign strategy.
 * Run: npx tsx scripts/verify-dashboard-v4-strategy.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  COMMAND_CENTER_COPY,
  DASHBOARD_V4_COPY,
  VALUE_SUMMARY_COPY,
} from '../lib/dashboard/dashboardCommandCenter';
import { ENTERPRISE_COMMAND_CENTER_COPY } from '../lib/enterprise/enterpriseCommandCenter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  const filePath = path.join(ROOT, rel);
  assert(fs.existsSync(filePath), `${rel} exists`);
  return fs.readFileSync(filePath, 'utf8');
}

// --- V4 copy constants ---
assert(DASHBOARD_V4_COPY.websiteHealthTitle === 'Website Health', 'Website Health card title');
assert(DASHBOARD_V4_COPY.monitoringActiveTitle === 'Monitoring Active', 'Monitoring Active card title');
assert(DASHBOARD_V4_COPY.immediateAttentionTitle === 'Fix this first', 'Fix this first card title');
assert(DASHBOARD_V4_COPY.recentIntelligenceTitle === 'Recent Website Intelligence', 'Recent Website Intelligence');
assert(DASHBOARD_V4_COPY.valueDeliveredTitle === 'What CyberShield Did For You', 'value delivered title');
assert(DASHBOARD_V4_COPY.websiteMemoryTitle === 'Website Memory', 'Website Memory title');
assert(COMMAND_CENTER_COPY.title.includes('Intelligence Command Center'), 'command center repositioned');
assert(VALUE_SUMMARY_COPY.subtitle.includes('30 days'), '30-day value summary');

// --- Dashboard V4 top row component ---
const topRow = read('components/dashboard/DashboardV4TopRow.tsx');
assert(topRow.includes('Website Health'), 'DashboardV4TopRow has Website Health card');
assert(topRow.includes('Monitoring Active'), 'DashboardV4TopRow has Monitoring Active card');
assert(topRow.includes('Fix this first'), 'DashboardV4TopRow has Fix this first card');
assert(topRow.includes('Open Health Center'), 'Immediate Attention CTA');

// --- Command center layout ---
const dashboard = read('components/dashboard/CommandCenterDashboard.tsx');
assert(dashboard.includes('DashboardV4TopRow'), 'CommandCenterDashboard uses V4 top row');
assert(dashboard.includes('DASHBOARD_V4_COPY.recentIntelligenceTitle'), 'CommandCenterDashboard intelligence row');
assert(dashboard.includes('VALUE_SUMMARY_COPY') || dashboard.includes('CyberShieldValueSummary'), 'value section wired');

// --- Website Memory timeline ---
const memoryTimeline = read('components/dashboard/websites/WebsiteMemoryTimeline.tsx');
assert(memoryTimeline.includes('WebsiteChangeTimeline'), 'WebsiteMemoryTimeline re-exports timeline');
const changeTimeline = read('components/dashboard/websites/WebsiteChangeTimeline.tsx');
assert(changeTimeline.includes('Website Memory'), 'WebsiteChangeTimeline uses Website Memory title');
const changesPage = read('app/dashboard/websites/[id]/changes/page.tsx');
assert(changesPage.includes('WebsiteMemoryTimeline'), 'changes page uses Website Memory component');

// --- Health Center repositioned ---
const healthCenter = read('components/dashboard/websites/WebsiteHealthCenter.tsx');
assert(healthCenter.includes('Website Health Center'), 'Health Center title');
assert(healthCenter.includes('Mission control'), 'Health Center mission control copy');
assert(healthCenter.includes('Recommended Actions'), 'Health Center recommended actions');

// --- Alerts business language ---
const customerLanguage = read('lib/dashboard/customerLanguage.ts');
assert(customerLanguage.includes('Website Health Review Recommended'), 'alert title transform');
assert(customerLanguage.includes('Improvements Available'), 'findings → improvements transform');
const alertsList = read('components/dashboard/alerts/AlertsList.tsx');
assert(!alertsList.includes('security issues'), 'AlertsList avoids scanner language');
const groupAlerts = read('lib/alerts/groupAlertsForDisplay.ts');
assert(groupAlerts.includes('softenCustomerAlertTitle'), 'grouped alerts use customer language');

// --- Reports executive snapshot first ---
const reportExperience = read('components/report/SecurityReportExperience.tsx');
const execIdx = reportExperience.indexOf('Executive Snapshot');
const scoreIdx = reportExperience.indexOf('Score details');
assert(execIdx >= 0 && scoreIdx > execIdx, 'Executive Snapshot appears before technical score details');
assert(reportExperience.includes('Website Trust Score'), 'snapshot has trust score');
assert(reportExperience.includes('Recommended action'), 'snapshot has recommended action');
assert(reportExperience.includes('Why ongoing monitoring matters'), 'report has monitoring value section');

// --- Agency client protection focus ---
const agencyDashboard = read('components/enterprise/EnterpriseAgencyDashboard.tsx');
assert(agencyDashboard.includes('Client Protection'), 'agency dashboard client protection header');
assert(
  agencyDashboard.includes(ENTERPRISE_COMMAND_CENTER_COPY.valueDeliveredTitle),
  'agency value delivered section',
);
assert(
  agencyDashboard.includes(ENTERPRISE_COMMAND_CENTER_COPY.needsAttentionTitle),
  'clients requiring review section',
);
assert(
  agencyDashboard.includes(ENTERPRISE_COMMAND_CENTER_COPY.protectedWebsitesTitle),
  'protected clients section',
);

// --- Historical intelligence architecture ---
const historical = read('lib/intelligence/historical.ts');
assert(historical.includes('ScoreHistory'), 'score history type');
assert(historical.includes('SslHistory'), 'SSL history type');
assert(historical.includes('ChangeHistory'), 'change history type');
assert(historical.includes('UptimeHistory'), 'uptime history type');
assert(historical.includes('FindingHistory'), 'finding history type');
assert(historical.includes('BenchmarkPercentile'), 'benchmarking types');
assert(historical.includes('percentile: number | null'), 'no fake percentile requirement');

console.log('All Dashboard V4 strategy checks passed.');
