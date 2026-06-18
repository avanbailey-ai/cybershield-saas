/**
 * Verify Enterprise Dashboard V3 agency experience.
 * Run: npx tsx scripts/verify-enterprise-dashboard-v3.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ENTERPRISE_COMMAND_CENTER_COPY,
  buildEnterpriseOrgSummary,
  buildNeedsAttentionClients,
  buildProtectedWebsites,
  getWebsiteDisplayName,
  resolveEnterpriseOrgStatus,
} from '../lib/enterprise/enterpriseCommandCenter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_COMPONENT = 'components/enterprise/EnterpriseAgencyDashboard.tsx';
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

const BANNED_DEFAULT_TERMS = [
  'Sites at Risk',
  'High Risk',
  'Security Posture',
  'intelligence signals',
  'Last cron',
  'Queued scans',
];

const REQUIRED_SECTIONS = [
  ENTERPRISE_COMMAND_CENTER_COPY.title,
  ENTERPRISE_COMMAND_CENTER_COPY.valueDeliveredTitle,
  ENTERPRISE_COMMAND_CENTER_COPY.needsAttentionTitle,
  ENTERPRISE_COMMAND_CENTER_COPY.protectedWebsitesTitle,
  ENTERPRISE_COMMAND_CENTER_COPY.recentActivityTitle,
  ENTERPRISE_COMMAND_CENTER_COPY.advancedDiagnosticsTitle,
  ENTERPRISE_COMMAND_CENTER_COPY.orgInsightsTitle,
  ENTERPRISE_COMMAND_CENTER_COPY.reportsTitle,
];

// --- Copy constants ---
assert(
  ENTERPRISE_COMMAND_CENTER_COPY.needsAttentionTitle === 'Needs Your Attention',
  'needs attention title',
);
assert(ENTERPRISE_COMMAND_CENTER_COPY.protected === 'Protected', 'protected label');
assert(ENTERPRISE_COMMAND_CENTER_COPY.monitoringActive === 'Monitoring Active', 'monitoring active');
assert(ENTERPRISE_COMMAND_CENTER_COPY.reviewRecommended === 'Review Recommended', 'review recommended');

// --- Status resolution ---
assert(resolveEnterpriseOrgStatus({ websiteCount: 0, criticalCount: 0, needsAttentionCount: 0 }) === 'Setup required', 'setup');
assert(resolveEnterpriseOrgStatus({ websiteCount: 3, criticalCount: 1, needsAttentionCount: 0 }) === 'Review Recommended', 'review');
assert(resolveEnterpriseOrgStatus({ websiteCount: 3, criticalCount: 0, needsAttentionCount: 0 }) === 'Protected', 'protected status');

// --- Display name helper ---
assert(getWebsiteDisplayName('Client Site', 'https://example.com') === 'Client Site', 'label preferred');
assert(getWebsiteDisplayName(null, 'https://www.client.com') === 'client.com', 'hostname fallback');

// --- Aggregation smoke tests ---
const sampleWebsites = [
  {
    id: 'site-a',
    displayName: 'Alpha',
    url: 'https://alpha.com',
    clientGroup: 'Client A',
    score: 92,
    scoreBand: { key: 'excellent' as const, label: 'Excellent', min: 90, max: 100, badgeClass: '', textClass: '' },
    healthCategory: 'healthy' as const,
    issueCount: 0,
    topIssue: null,
    scanId: 'scan-a',
    sslStatus: 'healthy' as const,
    monitoringLabel: 'Monitoring Active',
    recentChangesCount: 1,
    stabilityLabel: 'Stable this week',
    lastScanLabel: 'Today',
  },
  {
    id: 'site-b',
    displayName: 'Beta',
    url: 'https://beta.com',
    clientGroup: 'Client B',
    score: 45,
    scoreBand: { key: 'critical' as const, label: 'Critical', min: 0, max: 49, badgeClass: '', textClass: '' },
    healthCategory: 'critical' as const,
    issueCount: 3,
    topIssue: 'Missing HSTS',
    scanId: 'scan-b',
    sslStatus: 'warning' as const,
    monitoringLabel: 'Monitoring Active',
    recentChangesCount: 0,
    stabilityLabel: 'Review recommended',
    lastScanLabel: 'Yesterday',
  },
];

const orgSummary = buildEnterpriseOrgSummary({
  websites: sampleWebsites,
  rollingScore: 68,
  criticalCount: 1,
  needsAttentionCount: 0,
  weekStats: { checksCompleted: 12, issuesDetected: 2, outages: 0, sslIssues: 1 },
  orgName: 'Agency Co',
});
assert(orgSummary.websitesProtected === 1, 'protected count');
assert(orgSummary.weekStats.checksCompleted === 12, 'week checks');

const needsAttention = buildNeedsAttentionClients(sampleWebsites);
assert(needsAttention.length >= 1, 'needs attention clients');
assert(needsAttention[0]!.topIssue.length > 0, 'top issue present');

const protectedSites = buildProtectedWebsites(sampleWebsites);
assert(protectedSites.length === 1 && protectedSites[0]!.displayName === 'Alpha', 'protected filter');

// --- Required files ---
assert(fs.existsSync(path.join(ROOT, 'lib/enterprise/enterpriseCommandCenter.ts')), 'helpers exist');
assert(fs.existsSync(path.join(ROOT, 'lib/enterprise/fetchEnterpriseCommandCenterData.ts')), 'fetcher exists');

const dashboardPath = path.join(ROOT, DASHBOARD_COMPONENT);
assert(fs.existsSync(dashboardPath), `${DASHBOARD_COMPONENT} exists`);
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// --- All sections present ---
for (const section of REQUIRED_SECTIONS) {
  assert(dashboardContent.includes(section), `section "${section}" in dashboard`);
}

// --- Business language: banned ops terms outside advanced diagnostics block ---
const advancedIdx = dashboardContent.indexOf(ENTERPRISE_COMMAND_CENTER_COPY.advancedDiagnosticsTitle);
assert(advancedIdx >= 0, 'advanced section marker');
const defaultViewContent = dashboardContent.slice(0, advancedIdx);
for (const term of BANNED_DEFAULT_TERMS) {
  assert(!defaultViewContent.includes(term), `default view must not include "${term}"`);
}

// --- Advanced diagnostics collapsible (hidden by default) ---
assert(dashboardContent.includes('defaultOpen={false}'), 'advanced panel collapsed by default');
assert(dashboardContent.includes('Queued scans'), 'queue metrics in advanced only');

// --- No raw UUIDs in visible string literals ---
const stringLiterals = dashboardContent.match(/'[^']*'|"[^"]*"/g) ?? [];
for (const literal of stringLiterals) {
  if (UUID_PATTERN.test(literal)) {
    throw new Error(`${DASHBOARD_COMPONENT} contains visible UUID literal: ${literal.slice(0, 40)}`);
  }
}

// --- Agency framing present ---
assert(dashboardContent.includes('What happened'), 'agency what happened');
assert(dashboardContent.includes('Why it matters'), 'agency why it matters');
assert(dashboardContent.includes('What next'), 'agency what next');

// --- Responsive classes ---
assert(dashboardContent.includes('sm:'), 'responsive breakpoints');

console.log('All Enterprise Dashboard V3 checks passed.');
