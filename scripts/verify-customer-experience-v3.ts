/**
 * Verify Customer Experience V3 implementation.
 * Run: npx tsx scripts/verify-customer-experience-v3.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  buildWebsiteActivityCards,
  getWebsiteDisplayName,
  websiteDisplayName,
  VALUE_SUMMARY_COPY,
  type CommandCenterWebsite,
} from '../lib/dashboard/dashboardCommandCenter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROOT = path.resolve(__dirname, '..');

const CUSTOMER_COMPONENTS = [
  'components/dashboard/ScansActivityDashboard.tsx',
  'components/dashboard/RetentionBanner.tsx',
  'components/dashboard/CyberShieldValueSummary.tsx',
  'components/dashboard/RecentActivityFeed.tsx',
  'components/referrals/ReferralsDashboardClient.tsx',
  'components/dashboard/CommandCenterDashboard.tsx',
  'components/dashboard/ScanQueueList.tsx',
  'components/dashboard/alerts/AlertsList.tsx',
  'components/dashboard/websites/WebsiteChangeTimeline.tsx',
  'components/enterprise/EnterpriseAgencyDashboard.tsx',
];

const BAD_ID_PATTERNS = [
  /Website \$\{/,
  /\.slice\(0,\s*8\)/,
  /ec70a006/,
];

const UUID_IN_TEXT = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

// --- Display name helper ---
assert(getWebsiteDisplayName('Acme', 'https://acme.com') === 'Acme', 'label preferred');
assert(getWebsiteDisplayName(null, 'https://www.shop.io') === 'shop.io', 'hostname fallback');
assert(websiteDisplayName === getWebsiteDisplayName, 'websiteDisplayName alias');

// --- Website activity cards ---
const sampleSites: CommandCenterWebsite[] = [
  {
    id: 'site-1',
    displayName: 'Acme Corp',
    url: 'https://acme.com',
    score: 88,
    scoreBand: { key: 'strong', label: 'Strong', min: 80, max: 89, badgeClass: '', textClass: '' },
    healthCategory: 'healthy',
    monitoringLabel: 'Active · hourly checks',
    lastScanLabel: '2h ago',
    lastScanAt: new Date().toISOString(),
    recentChangesCount: 1,
    latestScanId: 'scan-1',
  },
];

const cards = buildWebsiteActivityCards(sampleSites, []);
assert(cards[0]!.displayName === 'Acme Corp', 'activity card uses display name');
assert(cards[0]!.topIssue.length > 0, 'activity card has top issue');
assert(cards[0]!.recommendedAction.length > 0, 'activity card has recommended action');

// --- Required shared components exist ---
for (const rel of [
  'components/dashboard/RetentionBanner.tsx',
  'components/dashboard/CyberShieldValueSummary.tsx',
  'components/dashboard/ScansActivityDashboard.tsx',
  'components/dashboard/RecentActivityFeed.tsx',
  'scripts/verify-customer-experience-v3.ts',
]) {
  assert(fs.existsSync(path.join(ROOT, rel)), `${rel} exists`);
}

// --- Value summary copy ---
const valueSummaryContent = fs.readFileSync(
  path.join(ROOT, 'components/dashboard/CyberShieldValueSummary.tsx'),
  'utf8',
);
assert(valueSummaryContent.includes('VALUE_SUMMARY_COPY'), 'value summary uses SSOT copy');
assert(valueSummaryContent.includes('Security checks'), 'value summary metrics');

// --- Retention banner ---
const retentionContent = fs.readFileSync(
  path.join(ROOT, 'components/dashboard/RetentionBanner.tsx'),
  'utf8',
);
assert(retentionContent.includes('COMMAND_CENTER_COPY'), 'retention uses SSOT copy');
assert(retentionContent.includes('CyberShield Protection Active'), 'protection retention copy');

// --- Scans page V3 ---
const scansPage = fs.readFileSync(path.join(ROOT, 'app/dashboard/scans/page.tsx'), 'utf8');
assert(scansPage.includes('ScansActivityDashboard'), 'scans page uses activity dashboard');
assert(scansPage.includes('fetchCommandCenterData'), 'scans page fetches command center data');
assert(!scansPage.includes('ScanQueueList'), 'scans page no longer shows raw queue list');

const scansDashboard = fs.readFileSync(
  path.join(ROOT, 'components/dashboard/ScansActivityDashboard.tsx'),
  'utf8',
);
assert(scansDashboard.includes('Recent Security Activity'), 'scans page recent activity title');
assert(scansDashboard.includes('Health Center'), 'scans cards have health center CTA');
assert(scansDashboard.includes('Monitoring Activity Summary'), 'scans page has 7-day summary');

// --- Referrals hide empty metrics ---
const referralsContent = fs.readFileSync(
  path.join(ROOT, 'components/referrals/ReferralsDashboardClient.tsx'),
  'utf8',
);
assert(referralsContent.includes('hasReferralActivity'), 'referrals gates metrics on activity');
assert(referralsContent.includes('No referrals yet'), 'referrals professional empty state');
assert(referralsContent.includes('How rewards work'), 'referrals explains rewards');

// --- No raw ID patterns in customer UI ---
for (const rel of CUSTOMER_COMPONENTS) {
  const filePath = path.join(ROOT, rel);
  assert(fs.existsSync(filePath), `${rel} exists`);
  const content = fs.readFileSync(filePath, 'utf8');

  for (const pattern of BAD_ID_PATTERNS) {
    assert(!pattern.test(content), `${rel} must not contain bad ID pattern: ${pattern}`);
  }

  const stringLiterals = content.match(/'[^']*'|"[^"]*"/g) ?? [];
  for (const literal of stringLiterals) {
    if (UUID_IN_TEXT.test(literal) && !literal.includes('/app/websites/') && !literal.includes('/report/')) {
      throw new Error(`${rel} contains visible UUID literal: ${literal.slice(0, 48)}`);
    }
  }
}

// --- Agency language ---
const agencyContent = fs.readFileSync(
  path.join(ROOT, 'components/enterprise/EnterpriseAgencyDashboard.tsx'),
  'utf8',
);
assert(agencyContent.includes('Monitoring checks (24h)'), 'agency relabeled scans');
assert(agencyContent.includes('Pending checks'), 'agency relabeled queue');
assert(agencyContent.includes('Recent change groups'), 'agency relabeled signals');
assert(!agencyContent.includes('Queued scans'), 'agency hides queue jargon');

// --- Fetcher includes value summary ---
const fetcherContent = fs.readFileSync(
  path.join(ROOT, 'lib/dashboard/fetchCommandCenterData.ts'),
  'utf8',
);
assert(fetcherContent.includes('valueSummary'), 'fetcher returns value summary');
assert(fetcherContent.includes('fetchValueSummary7d'), 'fetcher has 7-day metrics');

console.log('All Customer Experience V3 checks passed.');
