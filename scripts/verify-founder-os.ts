/**
 * Verify Founder OS (Owner Command Center) implementation.
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
assert(!isOwner('customer@example.com'), 'Customer email is not owner');
assert(!isOwner('test@gmail.com'), 'Random email is not owner');

const ownerTs = readFile('lib/auth/owner.ts');
assert(ownerTs.includes('OWNER_EMAIL'), 'owner.ts exports OWNER_EMAIL');
assert(ownerTs.includes('process.env.OWNER_EMAIL'), 'owner.ts reads OWNER_EMAIL env var');

const ownerLayout = readFile('app/dashboard/admin/owner/layout.tsx');
assert(ownerLayout.includes('isOwner'), 'Owner layout gates with isOwner');
assert(ownerLayout.includes("redirect('/login')"), 'Non-owner redirected from owner layout');

// ── 13 module components ──
const MODULE_COMPONENTS = [
  { file: 'components/owner/DailyBriefing.tsx', section: 'briefing', module: 12 },
  { file: 'components/owner/BusinessOverview.tsx', section: 'overview', module: 1 },
  { file: 'components/owner/LeadDiscovery.tsx', section: 'prospects', module: 2 },
  { file: 'components/owner/OutreachGenerator.tsx', section: 'outreach', module: 3 },
  { file: 'components/owner/SocialContentStudio.tsx', section: 'social', module: 4 },
  { file: 'components/owner/VideoAdCreator.tsx', section: 'video', module: 5 },
  { file: 'components/owner/CampaignPlanner.tsx', section: 'campaigns', module: 6 },
  { file: 'components/owner/LeadCrm.tsx', section: 'crm', module: 7 },
  { file: 'components/owner/CompetitorIntel.tsx', section: 'competitors', module: 8 },
  { file: 'components/owner/ContentPerformance.tsx', section: 'content-performance', module: 9 },
  { file: 'components/owner/MarketingInsights.tsx', section: 'insights', module: 10 },
  { file: 'components/owner/CustomerIntelligence.tsx', section: 'customer-intel', module: 11 },
  { file: 'components/owner/DataMoatPanel.tsx', section: 'data-moat', module: 13 },
];

for (const mod of MODULE_COMPONENTS) {
  assert(fileExists(mod.file), `Module ${mod.module}: ${mod.file} exists`);
  const content = readFile(mod.file);
  assert(content.includes(`id="${mod.section}"`) || content.includes(`id='${mod.section}'`), `Module ${mod.module} has section id="${mod.section}"`);
}

const commandCenter = readFile('components/owner/FounderCommandCenter.tsx');
for (const mod of MODULE_COMPONENTS) {
  const baseName = path.basename(mod.file, '.tsx');
  assert(commandCenter.includes(baseName), `FounderCommandCenter imports ${baseName}`);
}

// ── API routes ──
const API_ROUTES = [
  'app/api/owner/overview/route.ts',
  'app/api/owner/prospects/route.ts',
  'app/api/owner/prospects/[id]/scan/route.ts',
  'app/api/owner/outreach/route.ts',
  'app/api/owner/content/route.ts',
  'app/api/owner/video/route.ts',
  'app/api/owner/campaigns/route.ts',
  'app/api/owner/crm/route.ts',
  'app/api/owner/competitors/route.ts',
  'app/api/owner/content-posts/route.ts',
  'app/api/owner/insights/route.ts',
  'app/api/owner/briefing/route.ts',
  'app/api/owner/intelligence/route.ts',
];

for (const route of API_ROUTES) {
  assert(fileExists(route), `API route ${route} exists`);
  const content = readFile(route);
  assert(content.includes('requireOwner') || content.includes('isOwner'), `${route} has owner gate`);
}

// ── Migration ──
const migration = readFile('supabase/migrations/20260617200000_founder_os.sql');
assert(migration.includes('owner_prospects'), 'Migration has owner_prospects');
assert(migration.includes('owner_crm_leads'), 'Migration has owner_crm_leads');
assert(migration.includes('owner_campaigns'), 'Migration has owner_campaigns');
assert(migration.includes('owner_competitors'), 'Migration has owner_competitors');
assert(migration.includes('owner_content_posts'), 'Migration has owner_content_posts');

// ── Data moat lib ──
assert(fileExists('lib/owner/dataMoat.ts'), 'lib/owner/dataMoat.ts exists');

// ── Customer nav does NOT link owner dashboard ──
const sidebar = readFile('components/dashboard/DashboardSidebar.tsx');
assert(!sidebar.includes('/dashboard/admin/owner'), 'Customer sidebar does not link Founder OS');
assert(!sidebar.includes('Founder OS'), 'Customer sidebar does not mention Founder OS');
assert(!sidebar.includes('founder'), 'Customer sidebar has no founder links');

// Owner shell is separate
assert(fileExists('components/owner/FounderShell.tsx'), 'FounderShell exists');
const founderShell = readFile('components/owner/FounderShell.tsx');
assert(founderShell.includes('Founder OS'), 'FounderShell branded as Founder OS');

console.log('All Founder OS verification checks passed.');
console.log(`  Route: /dashboard/admin/owner`);
console.log(`  Owner email: ${OWNER_EMAIL}`);
console.log(`  Modules: ${MODULE_COMPONENTS.length}/13`);
console.log(`  API routes: ${API_ROUTES.length}`);
