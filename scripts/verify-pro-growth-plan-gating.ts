/**
 * Pro/Growth route and feature gating vs Agency/Enterprise.
 * Run: npx tsx scripts/verify-pro-growth-plan-gating.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { canAccessAgencyDashboard, canUseAgencyClientFeatures } from '../lib/agency/planGate';
import { canAccessEnterprise } from '../lib/auth/permissions';
import { canUsePriorityMonitoring } from '../lib/billing/priorityMonitoring';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('CyberShield Pro/Growth plan gating verification\n');

const proUser = { email: 'pro@test.com', plan: 'pro' as const, subscription_status: 'active' as const };
const growthUser = { email: 'growth@test.com', plan: 'growth' as const, subscription_status: 'active' as const };
const agencyUser = { email: 'agency@test.com', plan: 'agency' as const, subscription_status: 'active' as const };
const freeUser = { email: 'free@test.com', plan: 'free' as const, subscription_status: 'inactive' as const };

// --- Agency dashboard / client features ---
assert(!canAccessAgencyDashboard(proUser, 'owner'), 'Pro blocked from Agency Dashboard');
assert(!canAccessAgencyDashboard(growthUser, 'owner'), 'Growth blocked from Agency Dashboard');
assert(canAccessAgencyDashboard(agencyUser, 'owner'), 'Agency retains Agency Dashboard access');

assert(!canUseAgencyClientFeatures(proUser), 'Pro blocked from agency client features');
assert(!canUseAgencyClientFeatures(growthUser), 'Growth blocked from agency client features');
assert(canUseAgencyClientFeatures(agencyUser), 'Agency retains client features');

// --- Enterprise portal ---
assert(!canAccessEnterprise(proUser, 'owner'), 'Pro blocked from enterprise portal');
assert(!canAccessEnterprise(growthUser, 'owner'), 'Growth blocked from enterprise portal');
assert(canAccessEnterprise(agencyUser, 'owner'), 'Agency can access enterprise portal');

// --- Priority monitoring ---
assert(!canUsePriorityMonitoring(proUser), 'Pro cannot toggle priority monitoring');
assert(!canUsePriorityMonitoring(growthUser), 'Growth cannot toggle priority monitoring');
assert(canUsePriorityMonitoring(agencyUser), 'Agency can toggle priority monitoring');

// --- Middleware redirects non-agency away from enterprise portal ---
const middleware = read('lib/supabase/middleware.ts');
assert(middleware.includes("pathname.startsWith('/enterprise/portal')"), 'middleware handles enterprise portal');
assert(middleware.includes("url.pathname = '/app'"), 'non-agency enterprise portal redirect to /app');

// --- SMB sidebar has no agency-only nav items ---
const smbSidebar = read('components/dashboard/DashboardSidebar.tsx');
assert(!smbSidebar.includes('Client Reports'), 'SMB sidebar has no Client Reports');
assert(!smbSidebar.includes('Client Websites'), 'SMB sidebar has no Client Websites');
assert(!smbSidebar.includes('Agency Dashboard'), 'SMB sidebar has no Agency Dashboard');
assert(!smbSidebar.includes('Founder OS'), 'SMB sidebar has no Founder OS');
assert(smbSidebar.includes('showEnterprise'), 'SMB sidebar gates enterprise href behind showEnterprise');

// --- Enterprise sidebar is agency-only ---
const enterpriseSidebar = read('components/enterprise/EnterprisePortalSidebar.tsx');
assert(enterpriseSidebar.includes('Agency Dashboard'), 'Enterprise sidebar has Agency Dashboard');
assert(enterpriseSidebar.includes('Client Websites'), 'Enterprise sidebar has Client Websites');

// --- Reports page gates agency UI ---
const reportsPage = read('app/dashboard/reports/page.tsx');
assert(reportsPage.includes('canAccessAgencyDashboard'), 'reports page checks agency access');
assert(reportsPage.includes('AgencyProofOfWorkCard'), 'agency proof-of-work gated in reports page');

// --- Alerts page gates agency grouped view ---
const alertsPage = read('app/dashboard/alerts/page.tsx');
assert(alertsPage.includes('canAccessAgencyDashboard'), 'alerts page checks agency access');
assert(alertsPage.includes('AgencyAlertsGroupedView'), 'agency alerts view gated');

// --- Website list shows agency-only priority message for non-agency ---
const websiteList = read('components/dashboard/websites/WebsiteList.tsx');
assert(
  websiteList.includes('Priority 5-minute monitoring is available on Agency plans'),
  'priority monitoring upsell for Pro/Growth',
);

// --- Free plan unaffected ---
assert(!canAccessAgencyDashboard(freeUser, 'owner'), 'Free blocked from agency dashboard');
assert(!canAccessEnterprise(freeUser, 'owner'), 'Free blocked from enterprise portal');

console.log('All Pro/Growth gating checks passed.\n');
