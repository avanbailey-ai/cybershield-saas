import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseUrlBatch, parseCsvImport } from './prospectDiscovery';
import { websiteHostKey } from './discovery/normalize';
import { validateProspectWebsite } from './discovery/validate';
import { enrichProspect } from './prospectEnrichment';
import { applyProspectScan } from './prospectScanUpdate';
import { classifyAgencyProspect } from './agency/agencyEnrichment';
import { discoverFreeSourcePack } from './sourcePacks';
import { discoverFromSeedDirectory } from './discovery/sources/seedDirectory';
import type { RawDiscoveredBusiness } from './discovery/types';
import {
  buildRevenueActionCard,
  DEFAULT_REVENUE_LIMITS,
  formatRevenueEngineSummary,
  hasUsefulRevenueAction,
  isWeakScanScore,
  type RevenueEngineResult,
  type RevenueSourceMode,
  type RevenueTarget,
} from './revenueEngine';

export interface RunRevenueEngineOptions {
  source: RevenueSourceMode;
  target?: RevenueTarget;
  urls?: string;
  csv?: string;
  sourceUrl?: string;
  locationFilter?: string;
  limits?: Partial<typeof DEFAULT_REVENUE_LIMITS>;
}

async function loadExistingHosts(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await admin
    .from('owner_prospects')
    .select('id, website')
    .is('deleted_at', null);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(websiteHostKey(row.website as string), row.id as string);
  }
  return map;
}

async function loadCustomerHosts(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin.from('websites').select('url').not('url', 'is', null);
  const hosts = new Set<string>();
  for (const row of data ?? []) {
    try {
      hosts.add(websiteHostKey(row.url as string));
    } catch {
      /* skip */
    }
  }
  return hosts;
}

async function collectCandidates(
  admin: SupabaseClient,
  opts: RunRevenueEngineOptions,
  limits: typeof DEFAULT_REVENUE_LIMITS,
): Promise<{ items: RawDiscoveredBusiness[]; existingIds: string[] }> {
  const target = opts.target ?? 'both';
  const existingIds: string[] = [];

  const fromPaste = (rows: ReturnType<typeof parseUrlBatch>): RawDiscoveredBusiness[] =>
    rows.map((r) => ({
      ...r,
      discovery_source: 'url_batch',
      discovery_source_url: null,
      confidence: 1,
    }));

  if (opts.source === 'paste_urls') {
    return { items: fromPaste(parseUrlBatch(opts.urls ?? '')), existingIds };
  }
  if (opts.source === 'csv') {
    return {
      items: fromPaste(parseCsvImport(opts.csv ?? opts.urls ?? '')),
      existingIds,
    };
  }
  if (opts.source === 'source_url' && opts.sourceUrl?.trim()) {
    const pack = await discoverFromSeedDirectory({
      location: opts.locationFilter ?? 'United States',
      industry: target === 'agency' ? 'web_design_agency' : 'general',
      radiusMeters: 40_000,
      maxResults: limits.maxCandidates,
      seedDirectoryUrl: opts.sourceUrl.trim(),
    });
    return { items: pack.results, existingIds };
  }
  if (opts.source === 'existing_pipeline') {
    const { data } = await admin
      .from('owner_prospects')
      .select('id, business_name, website, industry, city, state, country')
      .is('deleted_at', null)
      .neq('pipeline_state', 'archived')
      .neq('pipeline_state', 'ignore_forever')
      .or(
        'scan_status.eq.pending,scan_status.eq.failed,pipeline_state.eq.needs_contact,pipeline_state.eq.no_contact_found,pipeline_state.eq.new_discovery',
      )
      .order('updated_at', { ascending: true })
      .limit(limits.maxCandidates);

    const items: RawDiscoveredBusiness[] = [];
    for (const row of data ?? []) {
      existingIds.push(row.id as string);
      items.push({
        business_name: row.business_name as string,
        website: row.website as string,
        industry: (row.industry as string) ?? 'General',
        city: (row.city as string) ?? null,
        state: (row.state as string) ?? null,
        country: (row.country as string) ?? null,
        discovery_source: 'revenue_engine',
        discovery_source_url: null,
        confidence: 1,
      });
    }
    return { items, existingIds };
  }

  const raw = await discoverFreeSourcePack(target, limits.maxCandidates);
  if (opts.locationFilter?.trim()) {
    const filter = opts.locationFilter.toLowerCase();
    return {
      items: raw.filter(
        (r) =>
          r.city?.toLowerCase().includes(filter) ||
          r.state?.toLowerCase().includes(filter) ||
          `${r.city ?? ''} ${r.state ?? ''}`.toLowerCase().includes(filter),
      ),
      existingIds,
    };
  }
  return { items: raw, existingIds };
}

async function prospectHasDraft(admin: SupabaseClient, prospectId: string): Promise<boolean> {
  const { count } = await admin
    .from('owner_outreach_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('prospect_id', prospectId)
    .is('deleted_at', null)
    .in('status', ['draft', 'approved']);
  return (count ?? 0) > 0;
}

export async function runRevenueEngine(
  opts: RunRevenueEngineOptions,
): Promise<RevenueEngineResult> {
  const admin = createAdminClient();
  const limits = { ...DEFAULT_REVENUE_LIMITS, ...opts.limits };
  const target = opts.target ?? 'both';
  const agencyMode = target === 'agency' || target === 'both';

  const existingHosts = await loadExistingHosts(admin);
  const customerHosts = await loadCustomerHosts(admin);
  const { items: candidates, existingIds: pipelineExistingIds } = await collectCandidates(
    admin,
    opts,
    limits,
  );

  const result: RevenueEngineResult = {
    websitesFound: candidates.length,
    websitesScanned: 0,
    weakScoreLeads: 0,
    contactPathsFound: 0,
    draftsGenerated: 0,
    alreadyInPipeline: 0,
    notUrgent: 0,
    failedScans: 0,
    needsContact: 0,
    rejected: 0,
    summaryMessage: '',
    nextRecommendedAction: 'Find more websites or enrich contacts on weak-score prospects',
    results: [],
  };

  let scansDone = 0;
  const seenRun = new Set<string>();

  for (const item of candidates) {
    if (scansDone >= limits.maxScans && opts.source !== 'existing_pipeline') break;

    const host = websiteHostKey(item.website);
    if (seenRun.has(host)) {
      result.alreadyInPipeline++;
      continue;
    }
    seenRun.add(host);

    if (customerHosts.has(host)) continue;

    const existingId = existingHosts.get(host);
    let prospectId = existingId;
    let isDuplicate = Boolean(existingId);

    if (opts.source === 'existing_pipeline' && existingId) {
      prospectId = existingId;
      isDuplicate = true;
    } else if (!existingId) {
      const validation = await validateProspectWebsite(item.website);
      if (validation.rejected || !validation.dns_valid) {
        result.rejected++;
        continue;
      }

      const enrichment = await enrichProspect({
        business_name: item.business_name,
        website: item.website,
        industry: item.industry,
        dns_valid: validation.dns_valid,
        http_valid: validation.http_valid,
        scan_status: 'pending',
        skipContactFetch: true,
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
          discovery_source: item.discovery_source ?? 'revenue_engine',
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
        })
        .select('*')
        .single();

      if (error || !data) continue;
      prospectId = data.id as string;
      existingHosts.set(host, prospectId);
      isDuplicate = false;
    } else {
      result.alreadyInPipeline++;
    }

    if (!prospectId) continue;

    const { data: beforeScan } = await admin
      .from('owner_prospects')
      .select('*')
      .eq('id', prospectId)
      .single();
    if (!beforeScan) continue;

    const needsScan =
      beforeScan.scan_status !== 'completed' || opts.source === 'existing_pipeline';
    let prospect = beforeScan;

    if (needsScan && scansDone < limits.maxScans) {
      const scanResult = await applyProspectScan(admin, prospect);
      scansDone++;
      result.websitesScanned++;
      if (!scanResult.ok) {
        result.failedScans++;
        continue;
      }
      if (scanResult.prospect) prospect = scanResult.prospect;
    }

    if (agencyMode && prospect.prospect_kind !== 'agency') {
      try {
        await classifyAgencyProspect(admin, prospectId, 'web_design');
        const { data: refreshed } = await admin
          .from('owner_prospects')
          .select('*')
          .eq('id', prospectId)
          .single();
        if (refreshed) prospect = refreshed;
      } catch {
        /* best effort */
      }
    }

    const hasDraft = await prospectHasDraft(admin, prospectId);
    if (hasDraft) result.draftsGenerated++;

    const weak = isWeakScanScore(
      prospect.scan_score as number | null,
      prospect.scan_risk_level as string | null,
    );
    if (weak) result.weakScoreLeads++;

    const path = buildRevenueActionCard(prospect as never, { isDuplicate, hasDraft });
    if (path.contactPath !== 'no_contact_found') result.contactPathsFound++;
    if (path.status === 'needs_contact') result.needsContact++;
    if (path.status === 'not_urgent') result.notUrgent++;
    if (path.status === 'rejected') result.rejected++;

    result.results.push(path);
  }

  result.alreadyInPipeline += pipelineExistingIds.length > 0 ? 0 : 0;

  result.summaryMessage = formatRevenueEngineSummary(result);
  if (!hasUsefulRevenueAction(result)) {
    result.nextRecommendedAction =
      'No revenue actions yet — paste website URLs, use free web sources, or rescan existing pipeline prospects.';
  } else if (result.draftsGenerated > 0) {
    result.nextRecommendedAction = 'Review drafts ready for approval in Inbox';
  } else if (result.contactPathsFound > 0) {
    result.nextRecommendedAction = 'Open contact forms or enrich emails on weak-score sites';
  } else if (result.needsContact > 0) {
    result.nextRecommendedAction = 'Run contact enrichment on weak-score prospects';
  }

  return result;
}
