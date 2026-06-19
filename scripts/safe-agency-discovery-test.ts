/**
 * Safe agency discovery tests — Medford regional + Nationwide bounded metros.
 * Run: npx tsx scripts/safe-agency-discovery-test.ts
 * No emails, no DB insert, no outreach approval.
 */

import {
  buildAgencySearchPlan,
  NATIONWIDE_AGENCY_LIMITS,
  NATIONWIDE_AGENCY_METROS,
} from '../lib/owner/discovery/agencyQueries';
import { buildDiscoveryRunDiagnostics } from '../lib/owner/discovery/diagnostics';
import { discoverFromNominatimSearch } from '../lib/owner/discovery/sources/nominatimSearch';
import { discoverFromOpenStreetMap } from '../lib/owner/discovery/sources/openstreetmap';
import { emptyDiscoveryBreakdown } from '../lib/owner/prospectQualityBrain';

async function runProviderTest(label: string, plan: ReturnType<typeof buildAgencySearchPlan>) {
  console.log(`\n=== ${label} ===`);
  console.log(`Scope queries: ${plan.queries.length}`);
  plan.queries.slice(0, 4).forEach((q) => console.log(`  - ${q}`));
  if (plan.queries.length > 4) console.log(`  … +${plan.queries.length - 4} more`);
  if (plan.expansionNote) console.log(`Note: ${plan.expansionNote}`);
  if (plan.metrosSearched.length) {
    console.log(`Metros: ${plan.metrosSearched.join(', ')}`);
  }

  const nom = await discoverFromNominatimSearch({
    location: plan.normalizedLocation,
    industry: 'web_design_agency',
    radiusMeters: 40_000,
    maxResults: 12,
    searchQueries: plan.queries.slice(0, 6),
  });

  const osm = await discoverFromOpenStreetMap({
    location: plan.normalizedLocation,
    industry: 'web_design_agency',
    radiusMeters: 40_000,
    maxResults: 12,
    searchLocations: plan.osmSearchHubs,
  });

  const rawCandidates = nom.results.length + osm.results.length;
  const breakdown = emptyDiscoveryBreakdown();
  breakdown.rawResults = rawCandidates;

  const diag = buildDiscoveryRunDiagnostics({
    runType: 'agency',
    agencyType: 'web_design',
    location: plan.normalizedLocation,
    searchScope: plan.nationwide ? 'nationwide' : 'regional',
    metrosSearched: plan.metrosSearched,
    queriesByMetro: plan.queriesByMetro,
    providers: [nom.diagnostic, osm.diagnostic],
    queriesAttempted: plan.queries,
    rawResponseCount: (nom.diagnostic.rawResponseCount ?? 0) + (osm.diagnostic.rawResponseCount ?? 0),
    rawCandidatesBeforeFilters: rawCandidates,
    breakdown,
    durationMs: 0,
  });

  console.log('\nProviders:');
  for (const p of [nom.diagnostic, osm.diagnostic]) {
    console.log(
      `  ${p.provider}: called=${p.providerCalled} status=${p.status} found=${p.found} hits=${p.rawResponseCount ?? 0}`,
    );
    if (p.metrosSearched?.length) {
      console.log(`    metros: ${p.metrosSearched.join(', ')}`);
    }
    if (p.rawByMetro) {
      console.log(
        `    raw by metro: ${Object.entries(p.rawByMetro)
          .map(([k, v]) => `${k.split(',')[0]}=${v}`)
          .join(', ')}`,
      );
    }
  }

  console.log(`\nRaw candidates: ${rawCandidates}`);
  if (rawCandidates === 0) {
    console.log(`Zero reason: ${diag.zeroRawReason}`);
    console.log(`Suggested: ${diag.nextRecommendedAction}`);
  }

  return { rawCandidates, nom, osm, diag };
}

async function main() {
  console.log('Safe agency discovery tests (no emails, no auto-send, no DB)\n');

  const medfordPlan = buildAgencySearchPlan('web_design', 'Medford, OR', {
    discoveryScope: 'regional',
    maxQueries: 8,
  });
  const test1 = await runProviderTest('Test 1 — Agency web design · Medford, OR · Regional', medfordPlan);

  const nationwidePlan = buildAgencySearchPlan('web_design', 'Medford, OR', {
    discoveryScope: 'nationwide',
  });
  assertBoundedNationwide(nationwidePlan);
  const test2 = await runProviderTest('Test 2 — Agency web design · Nationwide', nationwidePlan);

  console.log('\n--- Summary ---');
  console.log(`Medford regional raw: ${test1.rawCandidates}`);
  console.log(`Nationwide raw: ${test2.rawCandidates}`);
  console.log(`Nationwide metros capped at: ${NATIONWIDE_AGENCY_LIMITS.maxMetrosPerRun}`);
  console.log('Emails sent: no · Auto-send: no · DB insert: no');
}

function assertBoundedNationwide(plan: ReturnType<typeof buildAgencySearchPlan>) {
  if (plan.metrosSearched.length > NATIONWIDE_AGENCY_LIMITS.maxMetrosPerRun) {
    throw new Error('Nationwide metros exceed cap');
  }
  if (plan.queries.length > NATIONWIDE_AGENCY_LIMITS.maxQueriesTotal) {
    throw new Error('Nationwide queries exceed cap');
  }
  if (!plan.nationwide) {
    throw new Error('Expected nationwide plan');
  }
  console.log(
    `\nNationwide bounds OK: ${plan.metrosSearched.length}/${NATIONWIDE_AGENCY_METROS.length} metros, ${plan.queries.length} queries`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
