import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { openStreetMapProvider } from './sources/openstreetmap';
import { nominatimSearchProvider } from './sources/nominatimSearch';
import { directorySeedProvider } from './sources/seedDirectory';
import { validateProspectWebsite } from './validate';
import { websiteHostKey } from './normalize';
import { applyProspectScan } from '../prospectScanUpdate';
import { enrichProspect } from '../prospectEnrichment';
import { classifyAgencyProspect } from '../agency/agencyEnrichment';
import type { AgencyType } from '../agency/agencyTypes';
import type { DiscoveryRunResult, RawDiscoveredBusiness } from './types';
import type { ProviderDiagnostic, DiscoveryProvider } from './provider';
import { skippedDiagnostic } from './provider';
import {
  getDiscoverySettings,
  radiusForScope,
  type DiscoverySettings,
  DEFAULT_DISCOVERY_SETTINGS,
} from './settings';
import { emptyDiscoveryBreakdown, formatDiscoverySummary } from '../prospectQualityBrain';
import { buildAgencySearchPlan, AGENCY_SEARCH_SEEDS, isNationwideAgencyScope } from './agencyQueries';
import { buildDiscoveryRunDiagnostics, formatZeroRawMessage } from './diagnostics';
import { geocodeLocation } from './geocode';

const ALL_PROVIDERS: DiscoveryProvider[] = [
  openStreetMapProvider,
  nominatimSearchProvider,
  directorySeedProvider,
];

async function loadExistingHosts(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin
    .from('owner_prospects')
    .select('website')
    .is('deleted_at', null);
  return new Set((data ?? []).map((r) => websiteHostKey(r.website as string)));
}

async function loadCustomerHosts(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin.from('websites').select('url').not('url', 'is', null);
  const hosts = new Set<string>();
  for (const row of data ?? []) {
    try {
      hosts.add(websiteHostKey(row.url as string));
    } catch {
      /* skip malformed */
    }
  }
  return hosts;
}

async function scanProspect(admin: SupabaseClient, prospectId: string): Promise<boolean> {
  const { data: prospect } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', prospectId)
    .single();

  if (!prospect) return false;
  const result = await applyProspectScan(admin, prospect);
  return result.ok;
}

function providerEnabled(settings: DiscoverySettings, name: string): boolean {
  const key = name as keyof DiscoverySettings['providers'];
  return settings.providers[key] !== false;
}

export async function runProspectDiscovery(options?: {
  settings?: Partial<DiscoverySettings>;
  autoScan?: boolean;
  agencyMode?: boolean;
  agencyType?: AgencyType;
}): Promise<DiscoveryRunResult> {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const baseSettings = await getDiscoverySettings(admin);
  const settings: DiscoverySettings = {
    ...baseSettings,
    ...options?.settings,
    providers: {
      ...baseSettings.providers,
      ...(options?.settings?.providers ?? {}),
    },
  };

  const agencyMode = options?.agencyMode === true;
  const agencyType: AgencyType = options?.agencyType ?? 'unknown';

  let agencySearchPlan: ReturnType<typeof buildAgencySearchPlan> | null = null;
  let searchQueries: string[] | undefined;

  if (agencyMode) {
    settings.industry = AGENCY_SEARCH_SEEDS[agencyType] ?? AGENCY_SEARCH_SEEDS.unknown;
    settings.providers = {
      openstreetmap: true,
      nominatim_search: true,
      directory_seed: settings.providers.directory_seed === true,
      google_places: false,
    };
    agencySearchPlan = buildAgencySearchPlan(agencyType, settings.location, {
      discoveryScope: settings.discoveryScope,
    });
    searchQueries = agencySearchPlan.queries;
  }

  const maxInsert = Math.min(settings.maxProspectsPerRun, 50);
  const autoScan = options?.autoScan !== false;

  const existingHosts = await loadExistingHosts(admin);
  const customerHosts = await loadCustomerHosts(admin);
  const providerDiagnostics: ProviderDiagnostic[] = [];
  const errors: string[] = [];
  const raw: RawDiscoveredBusiness[] = [];
  let rawResponseCount = 0;
  let rawBeforeWebsiteFilter = 0;

  const nationwideAgency =
    agencyMode && isNationwideAgencyScope(settings.discoveryScope);
  const location = settings.location.trim() || DEFAULT_DISCOVERY_SETTINGS.location;
  const geo = await geocodeLocation(location);

  const params = {
    location,
    industry: settings.industry || DEFAULT_DISCOVERY_SETTINGS.industry,
    radiusMeters: radiusForScope(settings),
    maxResults: maxInsert,
    seedDirectoryUrl: settings.seedDirectoryUrl,
    searchQueries,
    searchLocations: nationwideAgency ? agencySearchPlan?.osmSearchHubs : undefined,
  };

  for (const provider of ALL_PROVIDERS) {
    const enabled = providerEnabled(settings, provider.name);
    if (!enabled) {
      providerDiagnostics.push(
        skippedDiagnostic(provider.name, `${provider.name} disabled in discovery settings`, {
          providerEnabled: false,
        }).diagnostic,
      );
      continue;
    }

    if (provider.name === 'directory_seed' && !settings.seedDirectoryUrl?.trim()) {
      providerDiagnostics.push(
        skippedDiagnostic('directory_seed', 'No seed directory URL configured', {
          providerEnabled: true,
          providerCalled: false,
        }).diagnostic,
      );
      continue;
    }

    try {
      const { results, diagnostic } = await provider.discover(params);
      providerDiagnostics.push({
        ...diagnostic,
        providerEnabled: true,
        providerCalled: diagnostic.providerCalled ?? true,
      });
      if (diagnostic.status === 'failed' && diagnostic.failureReason) {
        errors.push(`${diagnostic.provider}: ${diagnostic.failureReason}`);
      }
      rawResponseCount += diagnostic.rawResponseCount ?? 0;
      rawBeforeWebsiteFilter += diagnostic.rawBeforeWebsiteFilter ?? results.length;
      raw.push(...results);
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${provider.name} failed`;
      errors.push(msg);
      providerDiagnostics.push({
        provider: provider.name,
        status: 'failed',
        found: 0,
        failureReason: msg,
        providerError: msg,
        providerEnabled: true,
        providerCalled: true,
      });
    }
  }

  const discovered = raw.length;
  let inserted = 0;
  let scanned = 0;
  let skipped = 0;
  let validated = 0;
  let rejectedDns = 0;

  const pendingScanIds: string[] = [];
  const seenThisRun = new Set<string>();

  for (const item of raw) {
    if (inserted >= maxInsert) break;

    const host = websiteHostKey(item.website);
    if (seenThisRun.has(host)) {
      skipped++;
      continue;
    }
    seenThisRun.add(host);

    if (existingHosts.has(host)) {
      skipped++;
      continue;
    }

    if (customerHosts.has(host)) {
      skipped++;
      continue;
    }

    const validation = await validateProspectWebsite(item.website);
    if (validation.rejected || !validation.dns_valid) {
      skipped++;
      rejectedDns++;
      continue;
    }

    validated++;

    const enrichment = await enrichProspect({
      business_name: item.business_name,
      website: item.website,
      industry: item.industry,
      dns_valid: validation.dns_valid,
      http_valid: validation.http_valid,
      scan_status: 'pending',
      skipContactFetch: false,
    });

    const { data, error } = await admin
      .from('owner_prospects')
      .insert({
        business_name: item.business_name,
        website: item.website,
        industry: item.industry,
        city: item.city,
        state: item.state,
        country: item.country,
        discovery_source: item.discovery_source,
        discovery_source_url: item.discovery_source_url,
        dns_valid: validation.dns_valid,
        http_valid: validation.http_valid,
        pipeline_state: 'new_discovery',
        scan_status: 'pending',
        lead_score: null,
        conversion_likelihood: enrichment.conversion_likelihood,
        estimated_mrr: enrichment.estimated_plan_fit,
        estimated_arr: enrichment.estimated_plan_fit ? enrichment.estimated_plan_fit * 12 : null,
        opportunity_priority: enrichment.opportunity_priority,
        opportunity_score: enrichment.opportunity_score,
        estimated_plan_fit: enrichment.estimated_plan_fit,
        contact_page_found: enrichment.contact_page_found,
        contact_email_found: enrichment.contact_email_found,
        contact_phone_found: enrichment.contact_phone_found,
        contact_linkedin_found: enrichment.contact_linkedin_found,
        contact_email: enrichment.contact_email,
        contact_phone: enrichment.contact_phone,
        contact_linkedin: enrichment.contact_linkedin,
        qualification_reasons: enrichment.qualification_reasons,
        selection_reason: enrichment.selection_reason,
      })
      .select('id')
      .single();

    if (error || !data) {
      skipped++;
      continue;
    }

    existingHosts.add(host);
    inserted++;
    pendingScanIds.push(data.id as string);
  }

  if (agencyMode) {
    for (const id of pendingScanIds) {
      try {
        await classifyAgencyProspect(admin, id, agencyType);
      } catch {
        /* classification best-effort */
      }
    }
  }

  if (autoScan) {
    for (const id of pendingScanIds) {
      const ok = await scanProspect(admin, id);
      if (ok) scanned++;
    }
  }

  let qualifiedCount = 0;
  let outreachReadyCount = 0;
  let estimatedOpportunityMrr = 0;
  if (pendingScanIds.length > 0) {
    const { data: fresh } = await admin
      .from('owner_prospects')
      .select('pipeline_state, estimated_plan_fit')
      .in('id', pendingScanIds);
    for (const row of fresh ?? []) {
      if (row.pipeline_state === 'qualified') qualifiedCount++;
      if (row.pipeline_state === 'outreach_ready') {
        outreachReadyCount++;
        estimatedOpportunityMrr += (row.estimated_plan_fit as number) ?? 0;
      }
    }
  }

  const breakdown = emptyDiscoveryBreakdown();
  breakdown.rawResults = discovered;
  breakdown.duplicatesSkipped = skipped;
  breakdown.rejectedLowFit = rejectedDns;
  breakdown.inserted = inserted;
  breakdown.qualified = qualifiedCount;
  breakdown.outreachReady = outreachReadyCount;

  const runDiagnostics = buildDiscoveryRunDiagnostics({
    runType: agencyMode ? 'agency' : 'smb',
    agencyType: agencyMode ? agencyType : undefined,
    location,
    normalizedLocation: geo?.displayName ?? agencySearchPlan?.normalizedLocation ?? location,
    searchScope: settings.discoveryScope,
    locationExpansion: agencySearchPlan?.expansionNote ?? null,
    metrosSearched: agencySearchPlan?.metrosSearched ?? [],
    queriesByMetro: agencySearchPlan?.queriesByMetro ?? {},
    providers: providerDiagnostics,
    queriesAttempted: searchQueries ?? [],
    rawResponseCount,
    rawCandidatesBeforeFilters: discovered,
    breakdown,
    durationMs: Date.now() - startedAt,
    envMissing: [],
  });

  const errorSummary = errors.length ? errors.join('; ') : null;

  const { data: runRow } = await admin
    .from('owner_discovery_runs')
    .insert({
      source: agencyMode ? `agency:${agencyType}` : 'combined',
      discovered_count: discovered,
      inserted_count: inserted,
      scanned_count: scanned,
      skipped_count: skipped,
      qualified_count: qualifiedCount,
      outreach_ready_count: outreachReadyCount,
      error_message: errorSummary,
      provider_diagnostics: providerDiagnostics,
      discovery_breakdown: breakdown,
      run_diagnostics: runDiagnostics,
    })
    .select('id')
    .single();

  const summaryMessage =
    discovered === 0
      ? formatZeroRawMessage(runDiagnostics)
      : formatDiscoverySummary(breakdown, inserted);

  return {
    discovered,
    inserted,
    scanned,
    skipped,
    validated,
    qualified: qualifiedCount,
    outreachReady: outreachReadyCount,
    estimatedOpportunityMrr,
    errors,
    providerDiagnostics,
    breakdown,
    summaryMessage,
    runDiagnostics,
    runId: runRow?.id as string | undefined,
  };
}

export async function scanPendingProspects(limit = 10): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('owner_prospects')
    .select('id')
    .eq('scan_status', 'pending')
    .is('deleted_at', null)
    .neq('pipeline_state', 'archived')
    .order('created_at', { ascending: true })
    .limit(limit);

  let scanned = 0;
  for (const row of data ?? []) {
    if (await scanProspect(admin, row.id as string)) scanned++;
  }
  return scanned;
}
