/**
 * Verify Founder OS V2 (Growth Command Center) implementation.
 * Run: npx tsx scripts/verify-founder-os.ts
 */

import fs from 'fs';
import path from 'path';
import { isOwner, OWNER_EMAIL } from '../lib/auth/owner';
import { OWNER_HOME_PATH } from '../lib/auth/ownerExperience';

const ROOT = path.resolve(__dirname, '..');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// â”€â”€ Route exists â”€â”€
assert(fileExists('app/dashboard/admin/owner/page.tsx'), 'Owner page route exists');
assert(fileExists('app/dashboard/admin/owner/layout.tsx'), 'Owner layout exists');

assert(fileExists('lib/auth/ownerExperience.ts'), 'ownerExperience routing module exists');
assert(OWNER_HOME_PATH === '/dashboard/admin/owner', 'Owner home is Founder OS');
assert(readFile('lib/auth/redirect.ts').includes('OWNER_HOME_PATH'), 'Post-login redirect uses Founder OS');

// â”€â”€ Access control â”€â”€
assert(isOwner('avanbailey@gmail.com'), 'Default owner email is recognized');
assert(!isOwner('avanbailey711@gmail.com'), 'Alternate email is not owner');
assert(!isOwner('customer@example.com'), 'Customer email is not owner');

const ownerTs = readFile('lib/auth/owner.ts');
assert(ownerTs.includes('OWNER_EMAIL'), 'owner.ts exports OWNER_EMAIL');
assert(ownerTs.includes('avanbailey@gmail.com'), 'Default owner is avanbailey@gmail.com');

const ownerLayout = readFile('app/dashboard/admin/owner/layout.tsx');
assert(ownerLayout.includes('isOwner'), 'Owner layout gates with isOwner');
assert(ownerLayout.includes("redirect('/login')"), 'Non-owner redirected from owner layout');

// â”€â”€ V2 lib modules â”€â”€
const V2_LIBS = [
  'lib/owner/opportunityScore.ts',
  'lib/owner/founderActions.ts',
  'lib/owner/revenueOpportunity.ts',
  'lib/owner/prospectDiscovery.ts',
  'lib/owner/generators/contentIntel.ts',
];
for (const lib of V2_LIBS) {
  assert(fileExists(lib), `V2 lib ${lib} exists`);
}

assert(readFile('lib/owner/opportunityScore.ts').includes('scoreOpportunity'), 'opportunityScore exports scorer');
assert(readFile('lib/owner/founderActions.ts').includes('generateFounderActions'), 'founderActions exports generator');

// -- Reality pass: no fake discovery / benchmarks --
const REALITY_SOURCES = [
  'lib/owner/prospectDiscovery.ts',
  'app/api/owner/discovery/route.ts',
  'components/owner/LeadDiscovery.tsx',
  'lib/owner/dataMoat.ts',
];
for (const rel of REALITY_SOURCES) {
  const content = readFile(rel);
  assert(!content.includes('generateProspectList'), rel + ' must not use generateProspectList');
  assert(!content.includes('DEFAULT_BENCHMARKS'), rel + ' must not use DEFAULT_BENCHMARKS');
  assert(!content.includes("mode: 'search'"), rel + " must not use mode: 'search'");
}

assert(fileExists('components/owner/OpportunityCenter.tsx'), 'OpportunityCenter component exists');
assert(fileExists('components/owner/CeoAdvisoryPanel.tsx'), 'CeoAdvisoryPanel component exists');

const ceoDashboardPage = readFile('app/dashboard/admin/ceo-dashboard/page.tsx');
assert(ceoDashboardPage.includes("redirect('/dashboard/admin/owner#insights')"), 'ceo-dashboard redirects to Founder OS insights');
assert(ceoDashboardPage.includes('force-dynamic'), 'ceo-dashboard is force-dynamic');


const VIEW_MODULES = [
  'components/owner/views/OverviewView.tsx',
  'components/owner/views/ProspectsView.tsx',
  'components/owner/views/OutreachView.tsx',
  'components/owner/views/CrmView.tsx',
  'components/owner/views/CustomersView.tsx',
  'components/owner/views/InsightsView.tsx',
  'components/owner/views/SettingsView.tsx',
];
for (const file of VIEW_MODULES) {
  assert(fileExists(file), `View module ${file} exists`);
}

assert(fileExists('components/owner/FounderOs.tsx'), 'FounderOs app shell exists');
assert(readFile('components/owner/FounderOs.tsx').includes('OverviewView'), 'FounderOs includes Overview');

assert(readFile('components/owner/FounderShell.tsx').includes('FOUNDER_SECTIONS'), 'FounderShell uses 7-section nav');

// â”€â”€ API routes â”€â”€
const API_ROUTES = [
  'app/api/owner/overview/route.ts',
  'app/api/owner/prospects/route.ts',
  'app/api/owner/prospects/[id]/scan/route.ts',
  'app/api/owner/discovery/route.ts',
  'app/api/owner/outreach/route.ts',
  'app/api/owner/outreach/drafts/route.ts',
  'app/api/owner/content/route.ts',
  'app/api/owner/content-intel/route.ts',
  'app/api/owner/video/route.ts',
  'app/api/owner/campaigns/route.ts',
  'app/api/owner/crm/route.ts',
  'app/api/owner/competitors/route.ts',
  'app/api/owner/content-posts/route.ts',
  'app/api/owner/insights/route.ts',
  'app/api/owner/briefing/route.ts',
  'app/api/owner/intelligence/route.ts',
  'app/api/owner/revenue/route.ts',
];

for (const route of API_ROUTES) {
  assert(fileExists(route), `API route ${route} exists`);
  const content = readFile(route);
  assert(content.includes('requireOwner') || content.includes('isOwner'), `${route} has owner gate`);
}

// â”€â”€ Migrations â”€â”€
const migrationV1 = readFile('supabase/migrations/20260617200000_founder_os.sql');
assert(migrationV1.includes('owner_prospects'), 'V1 migration has owner_prospects');

const migrationV2 = readFile('supabase/migrations/20260617300000_founder_os_v2.sql');
assert(migrationV2.includes('owner_outreach_drafts'), 'V2 migration has owner_outreach_drafts');
assert(migrationV2.includes('conversion_likelihood'), 'V2 migration has opportunity scoring fields');

// â”€â”€ Customer nav does NOT link owner dashboard â”€â”€
const sidebar = readFile('components/dashboard/DashboardSidebar.tsx');
assert(!sidebar.includes('/dashboard/admin/owner'), 'Customer sidebar does not link Founder OS');
assert(!sidebar.includes('Founder OS'), 'Customer sidebar does not mention Founder OS');

assert(fileExists('components/owner/FounderShell.tsx'), 'FounderShell exists');
const founderShell = readFile('components/owner/FounderShell.tsx');
assert(founderShell.includes('FOUNDER_SECTIONS'), 'FounderShell uses consolidated nav');
assert(!founderShell.includes('Opportunity Center'), 'Legacy nav removed');

console.log('All Founder OS V2 verification checks passed.');
console.log(`  Route: /dashboard/admin/owner`);
console.log(`  Owner email: ${OWNER_EMAIL}`);
console.log(`  V2 lib modules: ${V2_LIBS.length}`);
console.log(`  View modules: ${VIEW_MODULES.length}`);
console.log(`  API routes: ${API_ROUTES.length}`);
