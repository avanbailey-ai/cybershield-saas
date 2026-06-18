/**
 * Verify Automated Prospect Discovery & Dashboard Hygiene system.
 * Run: npx tsx scripts/verify-prospect-discovery-and-archive-system.ts
 */

import fs from 'fs';
import path from 'path';

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

// ── Discovery engine (real data only) ──
const engine = readFile('lib/owner/discovery/engine.ts');
assert(engine.includes('discoverFromOpenStreetMap'), 'Engine uses OpenStreetMap source');
assert(engine.includes('discoverFromPlatformWebsites'), 'Engine uses platform websites source');
assert(!engine.includes('generateProspectList'), 'Engine must not fabricate prospects');
assert(!engine.includes('Math.random'), 'Engine must not randomize fake data');
assert(engine.includes('validateProspectWebsite'), 'Engine validates DNS/HTTP');
assert(engine.includes('runScan'), 'Engine auto-scans on discovery');
assert(engine.includes('pipelineStateFromScan'), 'Engine updates pipeline state from scan');

const osm = readFile('lib/owner/discovery/sources/openstreetmap.ts');
assert(osm.includes('overpass-api.de'), 'OSM uses public Overpass API');

// ── Pipeline states & tabs ──
const pipeline = readFile('lib/owner/pipeline.ts');
const states = [
  'new',
  'scanned',
  'qualified',
  'outreach_ready',
  'contacted',
  'interested',
  'customer',
  'archived',
];
for (const s of states) {
  assert(pipeline.includes(`'${s}'`), `Pipeline includes state: ${s}`);
}
assert(pipeline.includes('New Discoveries'), 'Pipeline tab: New Discoveries');
assert(pipeline.includes('Qualified Prospects'), 'Pipeline tab: Qualified Prospects');
assert(pipeline.includes('Outreach Ready'), 'Pipeline tab: Outreach Ready');
assert(pipeline.includes('Archived'), 'Pipeline tab: Archived');

// ── Cron & manual run routes ──
assert(fileExists('app/api/cron/prospect-discovery/route.ts'), 'Nightly cron route exists');
const cron = readFile('app/api/cron/prospect-discovery/route.ts');
assert(cron.includes('runProspectDiscovery'), 'Cron runs discovery');
assert(cron.includes('runAutoArchive'), 'Cron runs auto-archive');

assert(fileExists('app/api/owner/discovery/run/route.ts'), 'Manual discovery run route exists');

const vercel = readFile('vercel.json');
assert(vercel.includes('/api/cron/prospect-discovery'), 'Vercel cron schedules prospect discovery');

// ── Discovery feed UI ──
const leadDiscovery = readFile('components/owner/LeadDiscovery.tsx');
assert(leadDiscovery.includes('Discovery feed'), 'LeadDiscovery has discovery feed');
assert(leadDiscovery.includes('No prospects discovered yet'), 'LeadDiscovery empty feed state');
assert(leadDiscovery.includes('/api/owner/discovery/run'), 'LeadDiscovery triggers discovery run');
assert(leadDiscovery.includes('ProspectPipeline'), 'LeadDiscovery uses ProspectPipeline');

const prospectPipeline = readFile('components/owner/ProspectPipeline.tsx');
assert(prospectPipeline.includes('Next step'), 'ProspectPipeline has next step column');
assert(prospectPipeline.includes('No prospects discovered yet'), 'ProspectPipeline empty state');
assert(prospectPipeline.includes('bulk'), 'ProspectPipeline supports bulk actions');

// ── Archive & delete API hygiene ──
const hygiene = readFile('lib/owner/hygiene.ts');
assert(hygiene.includes('hygieneUpdates'), 'Shared hygiene helper exists');

const ENTITY_ROUTES: { table: string; route: string }[] = [
  { table: 'owner_prospects', route: 'app/api/owner/prospects/[id]/route.ts' },
  { table: 'owner_crm_leads', route: 'app/api/owner/crm/[id]/route.ts' },
  { table: 'owner_campaigns', route: 'app/api/owner/campaigns/[id]/route.ts' },
  { table: 'owner_competitors', route: 'app/api/owner/competitors/[id]/route.ts' },
  { table: 'owner_content_posts', route: 'app/api/owner/content-posts/[id]/route.ts' },
];

for (const { route } of ENTITY_ROUTES) {
  const content = readFile(route);
  assert(content.includes('DELETE'), `${route} supports delete`);
  assert(
    content.includes('archive') || content.includes('hygieneUpdates'),
    `${route} supports archive`,
  );
}

const outreachDrafts = readFile('app/api/owner/outreach/drafts/route.ts');
assert(outreachDrafts.includes('hygieneUpdates'), 'Outreach drafts support hygiene');
assert(outreachDrafts.includes('DELETE'), 'Outreach drafts support delete');

const bulk = readFile('app/api/owner/prospects/bulk/route.ts');
assert(bulk.includes("'archive'"), 'Prospects bulk archive');
assert(bulk.includes("'delete'"), 'Prospects bulk delete');
assert(bulk.includes('generate_outreach'), 'Prospects bulk generate outreach');

// ── Auto-archive settings ──
const autoArchive = readFile('lib/owner/autoArchive.ts');
assert(autoArchive.includes('prospectInactiveDays: 90'), 'Default 90d inactive prospects');
assert(autoArchive.includes('campaignCompletedDays: 30'), 'Default 30d campaigns');
assert(autoArchive.includes('alertResolvedDays: 30'), 'Default 30d alerts');

assert(fileExists('app/api/owner/settings/route.ts'), 'Settings API exists');
const settingsView = readFile('components/owner/views/SettingsView.tsx');
assert(settingsView.includes('Auto-archive'), 'Settings UI for auto-archive');

// ── Migration ──
const migration = readFile('supabase/migrations/20260617400000_prospect_discovery_archive.sql');
assert(migration.includes('pipeline_state'), 'Migration adds pipeline_state');
assert(migration.includes('owner_discovery_runs'), 'Migration adds discovery runs table');
assert(migration.includes('archived_at'), 'Migration adds archived_at columns');

// ── UI hygiene controls ──
assert(fileExists('components/owner/HygieneControls.tsx'), 'HygieneControls component exists');
const UI_WITH_HYGIENE = [
  'components/owner/LeadCrm.tsx',
  'components/owner/CampaignPlanner.tsx',
  'components/owner/CompetitorIntel.tsx',
  'components/owner/ContentPerformance.tsx',
];
for (const ui of UI_WITH_HYGIENE) {
  assert(readFile(ui).includes('HygieneControls'), `${ui} uses HygieneControls`);
  assert(readFile(ui).includes('Archived'), `${ui} has archived view`);
}

// ── No fake data patterns in discovery paths ──
const DISCOVERY_PATHS = [
  'lib/owner/discovery/engine.ts',
  'lib/owner/discovery/sources/openstreetmap.ts',
  'lib/owner/discovery/sources/platformWebsites.ts',
  'components/owner/LeadDiscovery.tsx',
  'components/owner/ProspectPipeline.tsx',
];
for (const rel of DISCOVERY_PATHS) {
  const content = readFile(rel);
  assert(!content.includes('generateProspectList'), `${rel} must not fabricate data`);
  assert(!content.includes('DEFAULT_BENCHMARKS'), `${rel} must not use fake benchmarks`);
}

console.log('All prospect discovery & archive system checks passed.');
console.log(`  Pipeline states: ${states.length}`);
console.log(`  Hygiene entities: ${ENTITY_ROUTES.length + 1}`);
