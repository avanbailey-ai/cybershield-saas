/**
 * Feature audit verification — checks that the 25-product feature set has expected artifacts.
 * Run: npx tsx scripts/verify-feature-audit.ts
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SecurityFinding } from '../lib/securityIntelligence/types';
import {
  enrichFinding,
  buildDeveloperEmailPayload,
  buildTicketPayload,
} from '../lib/findings';
import { detectScanChanges } from '../lib/scanner/diffDetection';
import { buildSnapshotFromScanResult } from '../lib/scanner/pageSnapshot';
import type { ScanResult } from '../lib/scanner/runScan';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function fileExists(relativePath: string): boolean {
  return existsSync(join(process.cwd(), relativePath));
}

type FeatureStatus = 'implemented' | 'partial' | 'placeholder';

interface FeatureCheck {
  name: string;
  status: FeatureStatus;
  paths: string[];
  note?: string;
}

const FEATURES: FeatureCheck[] = [
  {
    name: 'Website Change Detection',
    status: 'implemented',
    paths: [
      'lib/scanner/diffDetection.ts',
      'lib/scanner/postProcessScan.ts',
      'supabase/migrations/20260616110000_scan_change_detection.sql',
    ],
  },
  {
    name: 'Website Change Timeline',
    status: 'implemented',
    paths: [
      'lib/scanChanges/changeTimeline.ts',
      'components/dashboard/websites/WebsiteChangeTimeline.tsx',
      'app/dashboard/websites/[id]/changes/page.tsx',
    ],
  },
  {
    name: 'SSL Certificate Monitoring',
    status: 'implemented',
    paths: [
      'lib/ssl/handleSslAfterScan.ts',
      'lib/ssl/processSslExpiryAlerts.ts',
      'supabase/migrations/20260618160000_ssl_monitoring.sql',
    ],
  },
  {
    name: 'Domain Expiration Monitoring',
    status: 'implemented',
    paths: [
      'lib/domain/handleDomainAfterScan.ts',
      'lib/domain/processDomainExpiryAlerts.ts',
      'supabase/migrations/20260619160000_domain_monitoring.sql',
    ],
  },
  {
    name: 'Uptime Monitoring',
    status: 'partial',
    paths: ['lib/websiteHealth/healthStatus.ts', 'lib/websiteHealth/fetchWebsiteHealthCenter.ts'],
    note: 'Derived from scan HTTP status, not dedicated uptime probes',
  },
  {
    name: 'Monthly Security Reports',
    status: 'implemented',
    paths: ['lib/alerts/monthlyReportService.ts', 'app/api/cron/monthly-report/route.ts'],
  },
  {
    name: 'Better Finding Explanations',
    status: 'implemented',
    paths: [
      'lib/securityIntelligence/exploitContext.ts',
      'lib/report/reportExecutiveCopy.ts',
      'lib/findings/findingEnrichment.ts',
    ],
  },
  {
    name: 'AI Remediation Assistant',
    status: 'partial',
    paths: [
      'lib/securityIntelligence/recommendations.ts',
      'components/report/RemediationAssistantPanel.tsx',
    ],
    note: 'Deterministic remediation templates — no external AI API',
  },
  {
    name: 'Send To Developer',
    status: 'implemented',
    paths: ['lib/findings/findingActions.ts', 'components/report/FindingActionBar.tsx'],
  },
  {
    name: 'Generate Ticket',
    status: 'implemented',
    paths: ['lib/findings/findingActions.ts', 'components/report/FindingActionBar.tsx'],
  },
  {
    name: 'Security Score History',
    status: 'implemented',
    paths: [
      'components/dashboard/SecurityTrendPanel.tsx',
      'app/api/analytics/security-trend/route.ts',
      'lib/analytics/securityTrends.ts',
    ],
  },
  {
    name: 'Industry Benchmarking',
    status: 'partial',
    paths: ['lib/analytics/benchmarking.ts', 'app/api/analytics/benchmark/route.ts'],
    note: 'Mock category benchmarks until cross-tenant aggregates exist',
  },
  {
    name: 'Technology Fingerprinting',
    status: 'partial',
    paths: ['lib/scanner/pageSnapshot.ts'],
    note: 'Framework/CDN/analytics heuristics from HTML — not full Wappalyzer',
  },
  {
    name: 'Plugin/Software Intelligence',
    status: 'partial',
    paths: ['lib/scanner/pageSnapshot.ts', 'lib/securityIntelligence/intelligenceCards.ts'],
    note: 'WordPress/CMS hints only — no version/CVE database',
  },
  {
    name: 'Security Event Database',
    status: 'implemented',
    paths: ['lib/alerts/alertEvents.ts', 'supabase/migrations/20260618150000_email_alert_production.sql'],
  },
  {
    name: 'Website Change Database',
    status: 'implemented',
    paths: ['lib/scanChanges/fetchWebsiteChanges.ts', 'supabase/migrations/20260616110000_scan_change_detection.sql'],
  },
  {
    name: 'White Label Reports',
    status: 'placeholder',
    paths: ['lib/enterprise/reportBuilder.ts'],
    note: 'Enterprise PDF exists; no customer branding config yet',
  },
  {
    name: 'Automated Client Reports',
    status: 'partial',
    paths: ['lib/alerts/monthlyReportService.ts', 'app/api/enterprise/report-pdf/route.ts'],
    note: 'Account monthly email + enterprise PDF — no per-client portal delivery',
  },
  {
    name: 'Client Portal',
    status: 'partial',
    paths: [
      'app/enterprise/portal/page.tsx',
      'components/enterprise/EnterprisePortalShell.tsx',
    ],
    note: 'Agency org portal for members — not external white-label client login',
  },
  {
    name: 'Agency Dashboard',
    status: 'implemented',
    paths: [
      'components/enterprise/EnterpriseAgencyDashboard.tsx',
      'lib/enterprise/enterpriseCommandCenter.ts',
    ],
  },
  {
    name: 'Malware/Blacklist Monitoring',
    status: 'placeholder',
    paths: [],
    note: 'Not implemented — requires external threat intel APIs',
  },
  {
    name: 'Exposed Login Detection',
    status: 'partial',
    paths: ['lib/scanner/pageSnapshot.ts', 'lib/securityIntelligence/intelligenceCards.ts'],
    note: 'loginFormDetected + login_surface finding — no credential testing',
  },
  {
    name: 'Third-Party Script Monitoring',
    status: 'implemented',
    paths: ['lib/scanner/diffDetection.ts', 'lib/scanChanges/transformTimelineEvents.ts'],
  },
  {
    name: 'Homepage Defacement Detection',
    status: 'partial',
    paths: ['lib/scanner/diffDetection.ts'],
    note: 'Meta/script/header diffs can surface tampering — no dedicated defacement model',
  },
  {
    name: 'Competitor Security Benchmarking',
    status: 'placeholder',
    paths: ['lib/analytics/benchmarking.ts'],
    note: 'Category percentiles only — no named competitor comparison',
  },
];

for (const feature of FEATURES) {
  for (const path of feature.paths) {
    assert(fileExists(path), `${feature.name}: missing ${path}`);
  }
}

const mockFinding: SecurityFinding = {
  id: 'csp_missing',
  title: 'Content-Security-Policy header missing',
  severity: 'high',
  category: 'headers',
  description: 'No CSP header detected.',
  impact: ['XSS payloads may execute unrestricted'],
  exploitScenario: 'Attacker injects script via XSS.',
  fix: "default-src 'self'",
  securityImpactIfFixed: 'Reduces XSS blast radius.',
};

const enriched = enrichFinding(mockFinding);
assert(enriched.remediationSteps.length >= 1, 'enrichFinding should produce remediation steps');

const email = buildDeveloperEmailPayload(mockFinding, {
  siteUrl: 'https://example.com',
  siteLabel: 'Example Site',
  reportUrl: 'https://app.example.com/report/abc',
});
assert(email.mailtoHref.startsWith('mailto:'), 'developer mailto href should be valid');
assert(email.body.includes('Content-Security-Policy'), 'developer email should include finding title');

const ticket = buildTicketPayload(mockFinding, {
  siteUrl: 'https://example.com',
  siteLabel: 'Example Site',
});
assert(ticket.body.includes('## Remediation steps'), 'ticket should include remediation section');

const baseScan: ScanResult = {
  url: 'https://example.com',
  ssl: true,
  headers: {
    csp: true,
    hsts: true,
    xFrame: true,
    xContentType: true,
    referrerPolicy: true,
    permissionsPolicy: true,
  },
  rawHeaders: {},
  pageSnapshot: {
    metaTags: {},
    scripts: ['https://cdn.example.com/app.js'],
    loginFormDetected: false,
    endpoints: [],
    formsDetected: 0,
    thirdPartyScripts: ['https://cdn.example.com/app.js'],
    externalApiCalls: [],
    techFingerprint: { frameworks: [], cdn: ['Cloudflare'], analytics: [] },
  },
  score: 90,
  riskLevel: 'low',
  issues: [],
  passed: [],
  explanation: 'OK',
};

const prevSnapshot = buildSnapshotFromScanResult({
  ...baseScan,
  pageSnapshot: {
    ...baseScan.pageSnapshot,
    scripts: [],
    thirdPartyScripts: [],
  },
});
const nextSnapshot = buildSnapshotFromScanResult(baseScan);
const scriptDiff = detectScanChanges(prevSnapshot, nextSnapshot);
assert(
  scriptDiff.changes.some((c) => c.type === 'script_added'),
  'third-party script diff should detect script_added',
);

assert(fileExists('components/report/FindingActionBar.tsx'), 'FindingActionBar UI missing');
assert(fileExists('components/report/RemediationAssistantPanel.tsx'), 'RemediationAssistantPanel UI missing');

const implemented = FEATURES.filter((f) => f.status === 'implemented').length;
const partial = FEATURES.filter((f) => f.status === 'partial').length;
const placeholder = FEATURES.filter((f) => f.status === 'placeholder').length;

console.log('verify-feature-audit: OK');
console.log(`  ${FEATURES.length} features checked`);
console.log(`  ${implemented} implemented, ${partial} partial, ${placeholder} placeholder`);
console.log('  Priority 1 actions: finding enrichment, send-to-developer, generate-ticket verified');
