/**
 * Verify Dashboard V2 command center implementation.
 * Run: npx tsx scripts/verify-dashboard-v2.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  COMMAND_CENTER_COPY,
  SCORE_BANDS,
  buildOrgHealthSummary,
  buildSecurityWins,
  formatActivityFeed,
  getScoreBand,
  getWebsiteDisplayName,
  shouldShowRetentionBanner,
} from '../lib/dashboard/dashboardCommandCenter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROOT = path.resolve(__dirname, '..');

const DASHBOARD_COMPONENTS = [
  'components/dashboard/CommandCenterDashboard.tsx',
  'components/dashboard/CommandCenterQuickActions.tsx',
];

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

// --- Copy constants ---
assert(COMMAND_CENTER_COPY.title === 'CyberShield Command Center', 'title constant');
assert(COMMAND_CENTER_COPY.monitoringActive.includes('Monitoring Active'), 'retention banner copy');
assert(COMMAND_CENTER_COPY.orgHealthTitle === 'Organization Security Health', 'org health title');
assert(COMMAND_CENTER_COPY.securityWinsTitle === "What's Working Well", 'security wins title');
assert(COMMAND_CENTER_COPY.needsAttentionTitle === 'Needs Attention', 'needs attention title');
assert(COMMAND_CENTER_COPY.recentActivityTitle === 'Recent Security Activity', 'activity title');
assert(COMMAND_CENTER_COPY.quickActionsTitle === 'Quick Actions', 'quick actions title');

// --- Score bands ---
assert(SCORE_BANDS.length === 6, 'six score bands');
assert(SCORE_BANDS[0]!.label === 'Excellent' && SCORE_BANDS[0]!.min === 90, 'excellent band');
assert(SCORE_BANDS[1]!.label === 'Strong', 'strong band');
assert(SCORE_BANDS[2]!.label === 'Good', 'good band');
assert(SCORE_BANDS[3]!.label === 'Fair', 'fair band');
assert(SCORE_BANDS[4]!.label === 'Needs Attention', 'needs attention band');
assert(SCORE_BANDS[5]!.label === 'Critical' && SCORE_BANDS[5]!.max === 49, 'critical band');
assert(getScoreBand(95).label === 'Excellent', '95 excellent');
assert(getScoreBand(85).label === 'Strong', '85 strong');
assert(getScoreBand(75).label === 'Good', '75 good');
assert(getScoreBand(65).label === 'Fair', '65 fair');
assert(getScoreBand(55).label === 'Needs Attention', '55 needs attention');
assert(getScoreBand(40).label === 'Critical', '40 critical');

// --- Display name helper ---
assert(getWebsiteDisplayName('My Site', 'https://example.com') === 'My Site', 'label preferred');
assert(getWebsiteDisplayName(null, 'https://www.example.com/path') === 'example.com', 'hostname fallback');

// --- Aggregation helpers ---
const orgHealth = buildOrgHealthSummary(
  [{ score: 92 }, { score: 55 }, { score: null }],
  6,
);
assert(orgHealth.monitored === 3, 'monitored count');
assert(orgHealth.healthy === 1, 'healthy count');
assert(orgHealth.needsAttention === 1, 'needs attention count');
assert(orgHealth.monthlyTrendLabel === '+6 this month', 'trend label');

const wins = buildSecurityWins({
  avgScore: 85,
  sslSummary: { healthy: 1, warning: 0, critical: 0, unknown: 0, sites: [] },
  domainSummary: { healthy: 1, warning: 0, critical: 0, unknown: 0, sites: [] },
  criticalAlerts: 0,
  websitesMonitored: 1,
  checksCompleted: 5,
  headerPassRate: 0.9,
});
assert(wins.length > 0, 'security wins generated');

const feed = formatActivityFeed({
  scans: [
    {
      id: 'scan-1',
      websiteLabel: 'Acme',
      websiteUrl: 'https://acme.com',
      securityScore: 88,
      status: 'completed',
      completedAt: new Date().toISOString(),
      startedAt: null,
    },
  ],
  changesDetected: 2,
});
assert(feed.length >= 1, 'activity feed items');
assert(feed.some((f) => f.title.includes('Acme') || f.title.includes('change')), 'business-friendly feed');

assert(shouldShowRetentionBanner({ ...orgHealth, critical: 0, needsAttention: 0, overallScore: 80 }), 'retention when healthy');

// --- No raw UUIDs displayed in dashboard components ---
for (const rel of DASHBOARD_COMPONENTS) {
  const filePath = path.join(ROOT, rel);
  assert(fs.existsSync(filePath), `${rel} exists`);
  const content = fs.readFileSync(filePath, 'utf8');

  // Allow UUID in href paths (internal routing) but not as visible text literals
  const stringLiterals = content.match(/'[^']*'|"[^"]*"/g) ?? [];
  for (const literal of stringLiterals) {
    if (UUID_PATTERN.test(literal) && !literal.includes('/app/websites/')) {
      throw new Error(`${rel} contains visible UUID literal: ${literal.slice(0, 40)}`);
    }
  }

  assert(!content.includes('ec70a006'), `${rel} must not contain sample DB id patterns`);
}

// --- Mobile responsive classes ---
const dashboardContent = fs.readFileSync(
  path.join(ROOT, 'components/dashboard/CommandCenterDashboard.tsx'),
  'utf8',
);
assert(dashboardContent.includes('sm:'), 'sm breakpoint classes');
assert(dashboardContent.includes('md:grid-cols-2'), 'responsive website grid');
assert(dashboardContent.includes('lg:grid-cols-2'), 'responsive section grid');
assert(dashboardContent.includes('grid-cols-2'), 'mobile quick action grid');

const quickActionsContent = fs.readFileSync(
  path.join(ROOT, 'components/dashboard/CommandCenterQuickActions.tsx'),
  'utf8',
);
assert(quickActionsContent.includes('grid-cols-2'), 'mobile quick actions visible');
assert(quickActionsContent.includes('Run Scan'), 'run scan action');
assert(quickActionsContent.includes('Add Website'), 'add website action');

// --- Required files ---
assert(fs.existsSync(path.join(ROOT, 'lib/dashboard/dashboardCommandCenter.ts')), 'helpers exist');
assert(fs.existsSync(path.join(ROOT, 'lib/dashboard/fetchCommandCenterData.ts')), 'fetcher exists');

console.log('All Dashboard V2 checks passed.');
