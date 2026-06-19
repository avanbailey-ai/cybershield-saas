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
import {
  getDiscoverySettings,
  radiusForScope,
  type DiscoverySettings,
  DEFAULT_DISCOVERY_SETTINGS,
} from './settings';

/** Nominatim search seed terms per agency type (keys exist in nominatimSearch). */
const AGENCY_SEARCH_SEEDS: Record<AgencyType, string> = {
  web_design: 'web_design_agency',
  wordpress: 'wordpress_agency',
  shopify: 'shopify_agency',
  ecommerce: 'ecommerce_agency',
  seo: 'seo_agency',
  marketing: 'marketing_agency',
  branding: 'branding_agency',
  creative_studio: 'creative_agency',
  dev_shop: 'dev_agency',
  msp: 'msp_agency',
  unknown: 'web_agency',
};

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

function providersForSettings(settings: DiscoverySettings): DiscoveryProvider[] {
  const all = [openStreetMapProvider, nominatimSearchProvider, directorySeedProvider];
  return all.filter((p) => {
    const key = p.name as keyof DiscoverySettings['providers'];
    return settings.providers[key] !== false;
  });
}

export async function runProspectDiscovery(options?: {
  settings?: Partial<DiscoverySettings>;
  autoScan?: boolean;
  /** When true, discovered prospects are classified as agencies (Founder OS). */
  agencyMode?: boolean;
  /** Preferred agency type for agency mode (also seeds the search terms). */
  agencyType?: AgencyType;
}): Promise<DiscoveryRunResult> {
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

  // In agency mode, drive the search with agency seed terms and prefer the
  // free-text Nominatim provider (geospatial amenity filters don't model
  // agencies well). SMB discovery is untouched.
  if (agencyMode) {
    settings.industry = AGENCY_SEARCH_SEEDS[agencyType] ?? AGENCY_SEARCH_SEEDS.unknown;
    settings.providers = {
      openstreetmap: false,
      nominatim_search: true,
      directory_seed: settings.providers.directory_seed === true,
      google_places: false,
    };
  }

  const maxInsert = Math.min(settings.maxProspectsPerRun, 50);
  const autoScan = options?.autoScan !== false;

  const existingHosts = await loadExistingHosts(admin);
  const customerHosts = await loadCustomerHosts(admin);
  const providerDiagnostics: ProviderDiagnostic[] = [];
  const errors: string[] = [];
  const raw: RawDiscoveredBusiness[] = [];

  const params = {
    location: settings.location || DEFAULT_DISCOVERY_SETTINGS.location,
    industry: settings.industry || DEFAULT_DISCOVERY_SETTINGS.industry,
    radiusMeters: radiusForScope(settings),
    maxResults: maxInsert,
    seedDirectoryUrl: settings.seedDirectoryUrl,
  };

  for (const provider of providersForSettings(settings)) {
    try {
      const { results, diagnostic } = await provider.discover(params);
      providerDiagnostics.push(diagnostic);
      if (diagnostic.status === 'failed' && diagnostic.failureReason) {
        errors.push(`${diagnostic.provider}: ${diagnostic.failureReason}`);
      }
      raw.push(...results);
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${provider.name} failed`;
      errors.push(msg);
      providerDiagnostics.push({
        provider: provider.name,
        status: 'failed',
        found: 0,
        failureReason: msg,
      });
    }
  }

  const discovered = raw.length;
  let inserted = 0;
  let scanned = 0;
  let skipped = 0;
  let validated = 0;

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

  // FIX 1 (HIGH): In agency mode we MUST classify each inserted prospect BEFORE
  // the auto-scan step. applyProspectScan() (invoked by scanProspect during
  // autoScan) calls ensureOutreachDraft(), which keys the draft type off
  // prospect_kind. If classification ran after the scan, every agency prospect
  // would still be prospect_kind='smb' at draft time and get an SMB cold_email
  // draft; the later agency draft would then be skipped (a draft already exists).
  // Classifying first sets prospect_kind='agency' (only for real agency fits —
  // see decideProspectKind) so the scan's ensureOutreachDraft builds the agency
  // draft, while NOT-AGENCY-FIT rows stay 'smb' and get the normal SMB draft.
  // SMB discovery (agencyMode=false) is byte-for-byte unaffected.
  if (agencyMode) {
    for (const id of pendingScanIds) {
      try {
        await classifyAgencyProspect(admin, id, agencyType);
      } catch {
        /* classification best-effort — never fail the whole run */
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

  const errorSummary = errors.length ? errors.join('; ') : null;

  await admin.from('owner_discovery_runs').insert({
    source: 'combined',
    discovered_count: discovered,
    inserted_count: inserted,
    scanned_count: scanned,
    skipped_count: skipped,
    qualified_count: qualifiedCount,
    outreach_ready_count: outreachReadyCount,
    error_message: errorSummary,
    provider_diagnostics: providerDiagnostics,
  });

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
