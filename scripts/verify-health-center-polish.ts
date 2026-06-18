/**
 * Verify Health Center V2 executive polish.
 * Run: npx tsx scripts/verify-health-center-polish.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BANNED_HEALTH_CENTER_PHRASES,
  REQUIRED_HEALTH_CENTER_PHRASES,
  buildExecutiveSummary,
  domainDisplay,
  formatAlertForHealthCenter,
  rewriteHealthVerdict,
  securityScorePresentation,
  securityTrend,
  uptimeDisplay,
} from '../lib/websiteHealth/healthCenterCopy';
import type { WebsiteHealthCenterData } from '../lib/websiteHealth/fetchWebsiteHealthCenter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const componentPath = join(
  process.cwd(),
  'components',
  'dashboard',
  'websites',
  'WebsiteHealthCenter.tsx',
);
const componentSource = readFileSync(componentPath, 'utf8');

const userFacingSource = componentSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
  .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');

for (const phrase of BANNED_HEALTH_CENTER_PHRASES) {
  if (phrase === 'Unknown') {
    const unknownInCopy =
      /['"`]Unknown['"`]/.test(userFacingSource) ||
      />\s*Unknown\s*</.test(userFacingSource) ||
      /\{['"`]Unknown['"`]\}/.test(userFacingSource);
    assert(!unknownInCopy, 'Banned phrase "Unknown" found in WebsiteHealthCenter.tsx user-facing copy');
    continue;
  }

  const pattern = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  assert(
    !pattern.test(userFacingSource),
    `Banned phrase "${phrase}" found in WebsiteHealthCenter.tsx user-facing copy`,
  );
}

const copyAndComponent = `${readFileSync(join(process.cwd(), 'lib', 'websiteHealth', 'healthCenterCopy.ts'), 'utf8')}\n${componentSource}`;
for (const phrase of REQUIRED_HEALTH_CENTER_PHRASES) {
  assert(
    copyAndComponent.includes(phrase),
    `Required phrase "${phrase}" missing from healthCenterCopy or WebsiteHealthCenter`,
  );
}

const domainInit = domainDisplay('unknown', null, '');
assert(domainInit.isInitializing, 'domain unknown initializes');
assert(domainInit.badge === 'Initializing', 'domain badge initializing');
assert(domainInit.headline.includes('initializing'), 'domain headline initializing');

const uptimeCollect = uptimeDisplay('pending', null);
assert(uptimeCollect.isCollecting, 'uptime pending collects');
assert(uptimeCollect.badge === 'Collecting data', 'uptime badge collecting');

const securityMid = securityScorePresentation(55);
assert(securityMid.band === 'Below average', 'security band below average');
assert(securityMid.contributors.length > 0, 'security contributors populated');

const verdict = rewriteHealthVerdict({
  verdict: 'all_clear',
  securityScore: 90,
  unreadAlerts: 0,
  uptimeCollecting: false,
  domainInitializing: false,
  recentChangeCount: 0,
});
assert(verdict.label === 'CyberShield monitoring active', 'all clear verdict label');

const alertView = formatAlertForHealthCenter({
  id: 'a1',
  title: 'Security score dropped',
  message: 'Your site scored 62/100 with 4 items to fix',
  severity: 'medium',
  createdAt: new Date().toISOString(),
  scanId: null,
});
assert(alertView.whyItMatters.length > 20, 'alert why it matters populated');
assert(alertView.recommendedAction.length > 5, 'alert recommended action populated');

const sampleData: WebsiteHealthCenterData = {
  website: {
    id: 'w1',
    url: 'https://example.com',
    label: 'Example',
    isActive: true,
    priorityMonitoring: false,
    lastScannedAt: null,
    nextScanAt: null,
    scanFrequency: null,
  },
  security: {
    score: 72,
    previousScore: 68,
    riskLevel: 'low',
    completedAt: new Date().toISOString(),
    scanId: 'scan-1',
  },
  ssl: { status: 'healthy', daysUntilExpiry: 90, expiresAt: null, issuer: null, checkedAt: null },
  domain: {
    status: 'healthy',
    domain: 'example.com',
    daysUntilExpiry: 200,
    expiresAt: null,
    registrar: null,
    checkedAt: new Date().toISOString(),
    message: 'Domain registration looks healthy.',
  },
  uptime: {
    status: 'online',
    httpStatus: 200,
    lastCheckedAt: new Date().toISOString(),
    responseTimeMs: 120,
    scanKind: 'monitoring_check',
  },
  monitoring: {
    enabled: true,
    lastCheckAt: new Date().toISOString(),
    scanKind: 'monitoring_check',
    priorityMonitoring: false,
    scanFrequency: 'hourly',
  },
  recentChanges: [],
  alerts: { unreadCount: 0, recent: [] },
};

const summary = buildExecutiveSummary(sampleData, verdict.label, 'all_clear');
assert(summary.rows.length === 5, 'executive summary has five rows');
assert(summary.overallLabel === 'CyberShield monitoring active', 'executive summary label');

const trendUp = securityTrend(72, 68);
assert(trendUp.direction === 'improving', 'security trend improving');
assert(trendUp.deltaLabel.includes('+4'), 'security trend delta label');

assert(componentSource.includes('buildExecutiveSummary'), 'component uses buildExecutiveSummary');
assert(componentSource.includes('rewriteHealthVerdict'), 'component uses rewriteHealthVerdict');
assert(componentSource.includes('formatAlertForHealthCenter'), 'component uses formatAlertForHealthCenter');
assert(componentSource.includes('Why this matters'), 'component has why this matters affordance');
assert(
  componentSource.includes('No important changes detected'),
  'component has professional empty state for recent changes',
);

console.log('All Health Center V2 polish checks passed.');
