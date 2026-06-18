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

// ── Route exists ──
assert(fileExists('app/dashboard/admin/owner/page.tsx'), 'Owner page route exists');
assert(fileExists('app/dashboard/admin/owner/layout.tsx'), 'Owner layout exists');

assert(fileExists('lib/auth/ownerExperience.ts'), 'ownerExperience routing module exists');
assert(OWNER_HOME_PATH === '/dashboard/admin/owner', 'Owner home is Founder OS');
assert(readFile('lib/auth/redirect.ts').includes('OWNER_HOME_PATH'), 'Post-login redirect uses Founder OS');

// ── Access control ──
assert(isOwner('avanbailey@gmail.com'), 'Default owner email is recognized');
assert(!isOwner('avanbailey711@gmail.com'), 'Alternate email is not owner');
assert(!isOwner('customer@example.com'), 'Customer email is not owner');

const ownerTs = readFile('lib/auth/owner.ts');
assert(ownerTs.includes('OWNER_EMAIL'), 'owner.ts exports OWNER_EMAIL');
assert(ownerTs.includes('avanbailey@gmail.com'), 'Default owner is avanbailey@gmail.com');

const ownerLayout = readFile('app/dashboard/admin/owner/layout.tsx');
assert(ownerLayout.includes('isOwner'), 'Owner layout gates with isOwner');
assert(ownerLayout.includes("redirect('/login')"), 'Non-owner redirected from owner layout');

// ── V2 lib modules ──
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

// ── 14 V2 module components ──
const MODULE_COMPONENTS = [
  { file: 'components/owner/FounderActionCenter.tsx', section: 'action-center', module: 14 },
  { file: 'components/owner/DailyBriefing.tsx', section: 'briefing', module: 1 },
  { file: 'components/owner/BusinessOverview.tsx', section: 'overview', module: 1 },
  { file: 'components/owner/LeadDiscovery.tsx', section: 'prospects', module: 2 },
  { file: 'components/owner/RevenueOpportunityPanel.tsx', section: 'revenue', module: 7 },
  { file: 'components/owner/OutreachGenerator.tsx', section: 'outreach', module: 4 },
  { file: 'components/owner/SocialContentStudio.tsx', section: 'social', module: 5 },
  { file: 'components/owner/VideoAdCreator.tsx', section: 'video', module: 6 },
  { file: 'components/owner/CampaignPlanner.tsx', section: 'campaigns', module: 8 },
  { file: 'components/owner/LeadCrm.tsx', section: 'crm', module: 9 },
  { file: 'components/owner/CompetitorIntel.tsx', section: 'competitors', module: 10 },
  { file: 'components/owner/ContentPerformance.tsx', section: 'content-performance', module: 5 },
  { file: 'components/owner/MarketingInsights.tsx', section: 'insights', module: 11 },
  { file: 'components/owner/CustomerIntelligence.tsx', section: 'customer-intel', module: 12 },
  { file: 'components/owner/DataMoatPanel.tsx', section: 'data-moat', module: 13 },
];

for (const mod of MODULE_COMPONENTS) {
  assert(fileExists(mod.file), `Module ${mod.module}: ${mod.file} exists`);
  const content = readFile(mod.file);
  const hasSection =
    content.includes(`id="${mod.section}"`) ||
    content.includes(`id='${mod.section}'`) ||
    (mod.section === 'briefing' && content.includes('FounderActionCenter'));
  assert(hasSection, `Module ${mod.module} has section id="${mod.section}" or embeds action center`);
}

const commandCenter = readFile('components/owner/FounderCommandCenter.tsx');
assert(commandCenter.includes('DailyBriefing'), 'FounderCommandCenter includes DailyBriefing (embeds Action Center)');
assert(commandCenter.includes('RevenueOpportunityPanel'), 'FounderCommandCenter includes Revenue Engine');
assert(commandCenter.includes('Founder OS V2'), 'FounderCommandCenter branded V2');

for (const key of [
  'DailyBriefing',
  'LeadDiscovery',
  'OutreachGenerator',
  'SocialContentStudio',
  'VideoAdCreator',
  'CampaignPlanner',
  'LeadCrm',
  'CompetitorIntel',
  'MarketingInsights',
  'CustomerIntelligencePanel',
  'DataMoatPanel',
]) {
  assert(commandCenter.includes(key), `FounderCommandCenter imports ${key}`);
}

// ── API routes ──
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

// ── Migrations ──
const migrationV1 = readFile('supabase/migrations/20260617200000_founder_os.sql');
assert(migrationV1.includes('owner_prospects'), 'V1 migration has owner_prospects');

const migrationV2 = readFile('supabase/migrations/20260617300000_founder_os_v2.sql');
assert(migrationV2.includes('owner_outreach_drafts'), 'V2 migration has owner_outreach_drafts');
assert(migrationV2.includes('conversion_likelihood'), 'V2 migration has opportunity scoring fields');

// ── Customer nav does NOT link owner dashboard ──
const sidebar = readFile('components/dashboard/DashboardSidebar.tsx');
assert(!sidebar.includes('/dashboard/admin/owner'), 'Customer sidebar does not link Founder OS');
assert(!sidebar.includes('Founder OS'), 'Customer sidebar does not mention Founder OS');

assert(fileExists('components/owner/FounderShell.tsx'), 'FounderShell exists');
const founderShell = readFile('components/owner/FounderShell.tsx');
assert(founderShell.includes('Action Center'), 'FounderShell nav includes Action Center');
assert(founderShell.includes('Revenue Engine'), 'FounderShell nav includes Revenue Engine');

console.log('All Founder OS V2 verification checks passed.');
console.log(`  Route: /dashboard/admin/owner`);
console.log(`  Owner email: ${OWNER_EMAIL}`);
console.log(`  V2 lib modules: ${V2_LIBS.length}`);
console.log(`  UI modules: ${MODULE_COMPONENTS.length}`);
console.log(`  API routes: ${API_ROUTES.length}`);
