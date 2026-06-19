/**
 * Discovery diagnostics verification — scopes, nationwide bounds, provider honesty.
 * Run: npx tsx scripts/verify-discovery-diagnostics.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildAgencySearchPlan,
  NATIONWIDE_AGENCY_LIMITS,
  NATIONWIDE_AGENCY_METROS,
  localZeroRawSuggestion,
} from '../lib/owner/discovery/agencyQueries';
import { buildDiscoveryRunDiagnostics, formatZeroRawMessage } from '../lib/owner/discovery/diagnostics';
import { DISCOVERY_SCOPE_OPTIONS, DEFAULT_DISCOVERY_SETTINGS } from '../lib/owner/discovery/settings';
import { emptyDiscoveryBreakdown } from '../lib/owner/prospectQualityBrain';
import { discoverFromNominatimSearch } from '../lib/owner/discovery/sources/nominatimSearch';
import { discoverFromOpenStreetMap } from '../lib/owner/discovery/sources/openstreetmap';

function read(rel: string): string {
  return existsSync(join(process.cwd(), rel)) ? readFileSync(join(process.cwd(), rel), 'utf8') : '';
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

console.log('Discovery diagnostics verification\n');

const engine = read('lib/owner/discovery/engine.ts');
const nominatim = read('lib/owner/discovery/sources/nominatimSearch.ts');
const osm = read('lib/owner/discovery/sources/openstreetmap.ts');
const leadDiscovery = read('components/owner/LeadDiscovery.tsx');
const settings = read('lib/owner/discovery/settings.ts');
const migration = read('supabase/migrations/20260621120000_discovery_run_diagnostics.sql');

const scopeIds = DISCOVERY_SCOPE_OPTIONS.map((o) => o.id);
assert(scopeIds.includes('local'), 'local scope exists');
assert(scopeIds.includes('regional'), 'regional scope exists');
assert(scopeIds.includes('statewide'), 'statewide scope exists');
assert(scopeIds.includes('nationwide'), 'nationwide scope exists');
assert(scopeIds.includes('custom'), 'custom scope exists');
assert(!scopeIds.includes('internet_wide' as typeof scopeIds[number]), 'no internet_wide scope advertised');
assert(!scopeIds.includes('global' as typeof scopeIds[number]), 'no global scope advertised as shipping');
assert(DEFAULT_DISCOVERY_SETTINGS.discoveryScope === 'regional', 'default scope is regional not nationwide');
assert(!leadDiscovery.includes("discoveryScope: 'internet_wide'"), 'agency toggle does not default to internet_wide');
assert(!leadDiscovery.includes('Internet-wide'), 'no Internet-wide UI label');
assert(leadDiscovery.includes('Nationwide discovery searches selected US metro markets'), 'nationwide caution in UI');

assert(engine.includes('buildDiscoveryRunDiagnostics'), 'engine builds run diagnostics');
assert(engine.includes('run_diagnostics'), 'engine stores run_diagnostics');
assert(migration.includes('run_diagnostics'), 'migration adds run_diagnostics column');
assert(engine.includes('buildAgencySearchPlan'), 'engine uses agency search plan');
assert(engine.includes('openstreetmap: true'), 'agency mode enables OpenStreetMap');
assert(engine.includes('isNationwideAgencyScope'), 'engine gates nationwide metro sampling');
assert(nominatim.includes('searchQueries'), 'Nominatim supports multi-query');
assert(nominatim.includes('queriesAttempted'), 'Nominatim records queries attempted');
assert(osm.includes('discoverFromMetroHubs'), 'OSM supports bounded metro hub sampling');
assert(osm.includes('rawByMetro'), 'OSM records raw by metro');
assert(osm.includes('metrosSearched'), 'OSM records metros searched');
assert(leadDiscovery.includes('Discovery finished — no raw candidates'), 'UI warns on zero raw');
assert(leadDiscovery.includes('metrosSearched'), 'UI shows metros searched');
assert(!engine.includes('generateFake'), 'no fake prospect generator');

const regionalPlan = buildAgencySearchPlan('web_design', 'Medford, OR', {
  discoveryScope: 'regional',
});
assert(regionalPlan.nationwide === false, 'regional plan is not nationwide');
assert(regionalPlan.queries.some((q) => q.includes('Medford')), 'regional uses entered location');
assert(
  regionalPlan.locationsUsed.length > 1 || regionalPlan.expansionNote !== null,
  'Medford regional documents broader regional coverage',
);

const nationwidePlan = buildAgencySearchPlan('web_design', 'Medford, OR', {
  discoveryScope: 'nationwide',
});
assert(nationwidePlan.nationwide === true, 'nationwide plan flagged');
assert(
  nationwidePlan.metrosSearched.length <= NATIONWIDE_AGENCY_LIMITS.maxMetrosPerRun,
  'nationwide metro count bounded',
);
assert(
  nationwidePlan.queries.length <= NATIONWIDE_AGENCY_LIMITS.maxQueriesTotal,
  'nationwide query count bounded',
);
assert(
  nationwidePlan.metrosSearched.every((m) => NATIONWIDE_AGENCY_METROS.includes(m as (typeof NATIONWIDE_AGENCY_METROS)[number])),
  'nationwide metros from approved list',
);
assert(
  !nationwidePlan.queries.some((q) => q.toLowerCase().includes('medford')),
  'nationwide does not silently use Medford anchor in queries',
);
assert(
  nationwidePlan.queries.every((q) => nationwidePlan.metrosSearched.some((m) => q.includes(m))),
  'nationwide queries are metro-scoped',
);

assert(
  localZeroRawSuggestion('Medford, OR').includes('Rogue Valley'),
  'Medford zero-raw suggests Rogue Valley or Nationwide',
);

const zeroDiag = buildDiscoveryRunDiagnostics({
  runType: 'agency',
  location: 'Medford, OR',
  searchScope: 'regional',
  providers: [
    {
      provider: 'nominatim_search',
      status: 'succeeded',
      found: 0,
      providerCalled: true,
      rawResponseCount: 0,
    },
  ],
  queriesAttempted: regionalPlan.queries,
  rawResponseCount: 0,
  rawCandidatesBeforeFilters: 0,
  breakdown: emptyDiscoveryBreakdown(),
  durationMs: 100,
});
assert(zeroDiag.zeroRawReason !== null, 'zero raw includes provider reason');
assert(
  Boolean(
    zeroDiag.nextRecommendedAction?.includes('Rogue Valley') ||
      zeroDiag.nextRecommendedAction?.includes('Nationwide'),
  ),
  'zero raw suggests wider scope not quality filters',
);
assert(
  !formatZeroRawMessage(zeroDiag).includes('rejected low-fit'),
  'raw=0 does not blame quality filters',
);

console.log('\nLive provider smoke (Medford regional, no DB, no emails)…');

async function liveSmoke() {
  const plan = buildAgencySearchPlan('web_design', 'Medford, OR', { discoveryScope: 'regional' });
  const nomResult = await discoverFromNominatimSearch({
    location: 'Medford, OR',
    industry: 'web_design_agency',
    radiusMeters: 40_000,
    maxResults: 5,
    searchQueries: plan.queries.slice(0, 2),
  });
  assert(nomResult.diagnostic.providerCalled === true, 'Nominatim provider was called');
  assert(Array.isArray(nomResult.diagnostic.queriesAttempted), 'diagnostics include query count');

  const osmResult = await discoverFromOpenStreetMap({
    location: 'Medford, OR',
    industry: 'web_design_agency',
    radiusMeters: 40_000,
    maxResults: 8,
  });
  assert(osmResult.diagnostic.providerCalled === true, 'OpenStreetMap provider was called');
  console.log(
    `  Medford: Nominatim ${nomResult.diagnostic.rawResponseCount ?? 0} hits / OSM ${osmResult.results.length} with website`,
  );
}

liveSmoke()
  .then(() => {
    console.log('\nAll discovery diagnostics checks passed.');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
