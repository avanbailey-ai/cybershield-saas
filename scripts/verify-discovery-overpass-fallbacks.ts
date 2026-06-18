/**
 * Verifies Overpass fix, provider fallbacks, validation, and discovery diagnostics.
 * Run: npx tsx scripts/verify-discovery-overpass-fallbacks.ts
 */

import fs from 'fs';
import path from 'path';
import {
  isRejectedWebsite,
  validateProspectWebsite,
} from '../lib/owner/discovery/validate';
import { websiteHostKey } from '../lib/owner/discovery/normalize';

const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK: ${msg}`);
}

async function main() {
  const osm = read('lib/owner/discovery/sources/openstreetmap.ts');
  const engine = read('lib/owner/discovery/engine.ts');
  const nominatim = read('lib/owner/discovery/sources/nominatimSearch.ts');
  const seed = read('lib/owner/discovery/sources/seedDirectory.ts');
  const leadDiscovery = read('components/owner/LeadDiscovery.tsx');
  const migration = read('supabase/migrations/20260618120000_discovery_provider_diagnostics.sql');

  // 1. Overpass POST text/plain
  assert(osm.includes("method: 'POST'"), 'Overpass uses POST');
  assert(
    osm.includes("'Content-Type': 'text/plain; charset=utf-8'"),
    'Overpass uses text/plain content type',
  );
  assert(osm.includes('body: query'), 'Overpass sends raw query as body');
  assert(!osm.includes('application/x-www-form-urlencoded'), 'Overpass does not use form-urlencoded');
  assert(!osm.includes('JSON.stringify'), 'Overpass does not JSON-stringify query');

  // 2. Overpass failure does not fail full run
  assert(engine.includes('providerDiagnostics.push'), 'Engine records per-provider diagnostics');
  assert(engine.includes('catch (e)'), 'Engine catches provider errors');
  assert(!engine.includes('throw new Error(`Overpass'), 'Engine does not throw on Overpass failure');

  // 3. Fallback provider exists
  assert(nominatim.includes('nominatim_search'), 'Nominatim fallback provider defined');
  assert(seed.includes('directory_seed'), 'Directory seed fallback provider defined');
  assert(engine.includes('nominatimSearchProvider'), 'Engine registers Nominatim fallback');
  assert(engine.includes('directorySeedProvider'), 'Engine registers directory seed fallback');

  // 4. Example/test domains rejected
  assert(isRejectedWebsite('https://example.com'), 'example.com rejected');
  assert(isRejectedWebsite('https://foo.example-test.com'), 'example-* rejected');
  assert(isRejectedWebsite('http://localhost'), 'localhost rejected');
  const exampleValidation = await validateProspectWebsite('https://example.org');
  assert(exampleValidation.rejected, 'example.org validation rejected');

  // 5. Duplicate skip logic
  assert(engine.includes('existingHosts.has(host)'), 'Duplicate prospects skipped');
  assert(engine.includes('seenThisRun.has(host)'), 'In-run duplicates skipped');

  // 6. Customer websites skipped
  assert(engine.includes('loadCustomerHosts'), 'Customer host loader exists');
  assert(engine.includes('customerHosts.has(host)'), 'Customer websites skipped');

  // 7. Provider-level error logging
  assert(engine.includes('provider_diagnostics'), 'Discovery run stores provider_diagnostics');
  assert(migration.includes('provider_diagnostics'), 'Migration adds provider_diagnostics column');
  assert(osm.includes('queryHash'), 'Overpass logs query hash');
  assert(osm.includes('responseSnippet'), 'Overpass logs response snippet');

  // 8. No fake generated businesses
  assert(!engine.includes('generateFake'), 'No fake business generator');
  assert(!engine.includes('demoProspect'), 'No demo prospects');
  assert(!nominatim.includes('Math.random'), 'Nominatim does not randomize domains');

  // 9. Auto-scan limit
  assert(engine.includes('maxAutoScansPerRun'), 'Auto-scan limit from settings');
  assert(engine.includes('pendingScanIds.slice(0, maxScan)'), 'Auto-scan capped per run');

  // 10. UI provider diagnostics
  assert(leadDiscovery.includes('providerDiagnostics'), 'UI shows provider diagnostics');
  assert(leadDiscovery.includes('Discovery did not find new prospects'), 'UI shows zero-result help');
  assert(leadDiscovery.includes('Discovery settings'), 'UI has discovery settings');

  // Host key sanity
  assert(websiteHostKey('https://www.acme.com') === 'www.acme.com', 'Host key normalization');

  console.log('\nAll discovery Overpass + fallback checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
