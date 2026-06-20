/**
 * Agency dashboard workflow verification.
 * Run: npx tsx scripts/verify-agency-dashboard.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { canAccessAgencyDashboard, canUseAgencyClientFeatures } from '../lib/agency/planGate';
import { canAccessEnterprise } from '../lib/auth/permissions';
import { buildClientOwnerEmail, buildClientOwnerReport } from '../lib/agency/clientOwnerExport';
import { generateAgencyClientReport } from '../lib/intelligence/agencyReport';
import {
  HISTORICAL_FINDING_LABEL,
  isHistoricalScanRow,
  isSupersededByLatestScan,
} from '../lib/agency/scanFreshness';
import { resolveClientDisplayName } from '../lib/agency/clientContext';
import { buildPortfolioHealthSummary } from '../lib/agency/agencyInsights';
import { ENTERPRISE_COMMAND_CENTER_COPY } from '../lib/enterprise/enterpriseCommandCenter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('CyberShield agency dashboard verification\n');

// --- Plan gating ---
const agencyUser = { email: 'agency@test.com', plan: 'agency', subscription_status: 'active' };
const growthUser = { email: 'growth@test.com', plan: 'growth', subscription_status: 'active' };
const proUser = { email: 'pro@test.com', plan: 'pro', subscription_status: 'active' };

assert(canAccessAgencyDashboard(agencyUser, 'owner'), 'Agency plan sees Agency Dashboard');
assert(!canAccessAgencyDashboard(growthUser, 'owner'), 'Growth does not see Agency Dashboard');
assert(!canAccessAgencyDashboard(proUser, 'owner'), 'Pro does not see Agency Dashboard');
assert(canAccessEnterprise(agencyUser, 'owner'), 'canAccessEnterprise delegates to agency');
assert(!canAccessEnterprise(growthUser, 'owner'), 'Growth blocked from enterprise portal');

// --- Founder OS hidden from agency nav ---
const sidebar = read('components/enterprise/EnterprisePortalSidebar.tsx');
assert(sidebar.includes('Agency Dashboard'), 'Agency nav has Agency Dashboard');
assert(sidebar.includes('Client Websites'), 'Agency nav has Client Websites');
assert(sidebar.includes('Client Reports'), 'Agency nav has Client Reports');
assert(!sidebar.includes('Founder OS'), 'Founder OS not in agency sidebar');
assert(!sidebar.includes('/app/admin/owner'), 'Owner routes not in agency sidebar');

// --- Agency dashboard components ---
const dashboard = read('components/enterprise/EnterpriseAgencyDashboard.tsx');
assert(dashboard.includes('AgencyPortfolioHealthCard'), 'portfolio health card');
assert(dashboard.includes('AgencyProofOfWorkCard'), 'proof-of-work card');
assert(dashboard.includes('Agency Command Center'), 'agency command center title');
assert(dashboard.includes('AgencyClientReportPanel'), 'client report panel');

assert(
  ENTERPRISE_COMMAND_CENTER_COPY.title === 'Agency Command Center',
  'command center copy title',
);

// --- Client context fields ---
const migration = read('supabase/migrations/20260620140000_website_client_context.sql');
assert(migration.includes('client_name'), 'migration has client_name');
assert(migration.includes('ADD COLUMN IF NOT EXISTS'), 'additive migration only');
assert(!migration.toLowerCase().includes('drop '), 'no DROP in migration');

// --- Client owner export (copy only) ---
const report = generateAgencyClientReport({
  clientName: 'Acme Co',
  siteUrl: 'https://acme.com',
  siteLabel: 'acme.com',
  securityScore: 100,
  findings: [],
});
const ownerReport = buildClientOwnerReport({
  clientName: 'Acme Co',
  contactName: 'Jane',
  websiteLabel: 'acme.com',
  siteUrl: 'https://acme.com',
  securityScore: 100,
  report,
});
const email = buildClientOwnerEmail({
  clientName: 'Acme Co',
  contactName: 'Jane',
  websiteLabel: 'acme.com',
  siteUrl: 'https://acme.com',
  securityScore: 100,
  report,
});
assert(ownerReport.includes('Executive Summary'), 'owner export has executive summary');
assert(email.body.includes('Nothing here means the site is hacked'), 'calm client email wording');
assert(email.body.includes('Current score: 100/100'), 'email includes score');
assert(!email.body.toLowerCase().includes('send'), 'email copy does not auto-send');

const panel = read('components/intelligence/AgencyClientReportPanel.tsx');
assert(panel.includes('Export for website owner'), 'export for website owner action');
assert(panel.includes('Copy client email'), 'copy client email action');
assert(panel.includes('does not send emails automatically'), 'no auto-send disclaimer');

// --- Latest vs historical scan ---
assert(
  isSupersededByLatestScan({
    itemCreatedAt: '2026-01-01T00:00:00Z',
    latestCompletedAt: '2026-06-01T00:00:00Z',
    latestScore: 100,
  }),
  'stale alert suppressed when latest score healthy',
);
assert(
  isHistoricalScanRow({
    scanId: 'old-scan',
    scanCompletedAt: '2026-01-01T00:00:00Z',
    latestScanId: 'new-scan',
    latestScore: 100,
  }),
  'old scan marked historical when latest is healthy',
);
assert(HISTORICAL_FINDING_LABEL.includes('Historical'), 'historical label present');

const reportsPage = read('app/dashboard/reports/page.tsx');
assert(reportsPage.includes('HISTORICAL_FINDING_LABEL'), 'reports page labels historical');
assert(reportsPage.includes('Client Reports'), 'agency reports heading');

// --- Alerts grouped ---
const alertsPage = read('app/dashboard/alerts/page.tsx');
assert(alertsPage.includes('AgencyAlertsGroupedView'), 'agency grouped alerts');
assert(alertsPage.includes('Copy client-safe notes'), 'copy client note messaging');

// --- Exports page ---
assert(fs.existsSync(path.join(ROOT, 'app/enterprise/portal/exports/page.tsx')), 'exports page exists');

// --- Client websites page ---
const clientWebsitesPage = read('app/enterprise/portal/websites/page.tsx');
assert(clientWebsitesPage.includes('AgencyClientWebsitesTable'), 'client websites table');
assert(clientWebsitesPage.includes('fetchAgencyClientWebsiteRows'), 'client context fetch');

// --- Portfolio health ---
const health = buildPortfolioHealthSummary([]);
assert(health.totalWebsites === 0, 'empty portfolio health');

const named = resolveClientDisplayName({
  url: 'https://client.com',
  label: null,
  client_name: 'Rogue Disposal',
  client_company: null,
  client_group: null,
  client_contact_name: null,
  client_contact_email: null,
  client_notes: null,
  client_report_frequency: null,
  client_status: null,
  agency_internal_notes: null,
});
assert(named === 'Rogue Disposal', 'client name resolution');

// --- Agency features gated ---
assert(canUseAgencyClientFeatures(agencyUser), 'agency client features for agency');
assert(!canUseAgencyClientFeatures(proUser), 'pro blocked from agency client features');

// --- No fake auto-send ---
const fetchCmd = read('lib/dashboard/fetchCommandCenterData.ts');
assert(!fetchCmd.includes('sendEmail'), 'command center does not send emails');

console.log('\nAll agency dashboard checks passed.');
