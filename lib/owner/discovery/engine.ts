import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { runScan } from '@/lib/scanner/runScan';
import { computeLeadScore } from '@/lib/owner/leadScore';
import { scoreOpportunity } from '@/lib/owner/opportunityScore';
import { discoverFromOpenStreetMap } from './sources/openstreetmap';
import { discoverFromPlatformWebsites } from './sources/platformWebsites';
import { validateProspectWebsite } from './validate';
import { websiteHostKey } from './normalize';
import { pipelineStateFromScan, topIssueFromFindings } from '../pipeline';
import type { DiscoveryRunResult, RawDiscoveredBusiness } from './types';

const MAX_INSERT_PER_RUN = 15;
const MAX_SCAN_PER_RUN = 8;

async function loadExistingHosts(admin: SupabaseClient): Promise<Set<string>> {
  const { data } = await admin
    .from('owner_prospects')
    .select('website')
    .is('deleted_at', null);
  return new Set((data ?? []).map((r) => websiteHostKey(r.website as string)));
}

async function scanProspect(admin: SupabaseClient, prospectId: string): Promise<boolean> {
  const { data: prospect } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', prospectId)
    .single();

  if (!prospect) return false;

  await admin.from('owner_prospects').update({ scan_status: 'running' }).eq('id', prospectId);

  try {
    let url = (prospect.website as string).trim();
    if (!url.startsWith('http')) url = `https://${url}`;

    const result = await runScan(url);
    const leadScore = computeLeadScore(result);
    const issueCount = result.issues?.length ?? 0;
    const opp = scoreOpportunity({
      leadScore,
      scanScore: result.score,
      scanRiskLevel: result.riskLevel,
      industry: prospect.industry as string | null,
      issueCount,
      scanCompleted: true,
    });

    const pipeline_state = pipelineStateFromScan({
      scanStatus: 'completed',
      leadScore,
    });

    await admin
      .from('owner_prospects')
      .update({
        scan_status: 'completed',
        scan_score: result.score,
        scan_risk_level: result.riskLevel,
        scan_findings: {
          issues: result.issues,
          passed: result.passed,
          headers: result.headers,
          ssl: result.ssl,
          explanation: result.explanation,
        },
        lead_score: leadScore,
        conversion_likelihood: opp.conversionLikelihood,
        estimated_mrr: opp.estimatedMrr,
        estimated_arr: opp.estimatedArr,
        opportunity_priority: opp.priority,
        pipeline_state,
        top_issue: topIssueFromFindings({ issues: result.issues }),
      })
      .eq('id', prospectId);

    return true;
  } catch {
    await admin.from('owner_prospects').update({ scan_status: 'failed' }).eq('id', prospectId);
    return false;
  }
}

export async function runProspectDiscovery(options?: {
  maxDiscover?: number;
  autoScan?: boolean;
}): Promise<DiscoveryRunResult> {
  const admin = createAdminClient();
  const maxDiscover = options?.maxDiscover ?? MAX_INSERT_PER_RUN;
  const autoScan = options?.autoScan !== false;
  const errors: string[] = [];

  const existingHosts = await loadExistingHosts(admin);
  const raw: RawDiscoveredBusiness[] = [];

  try {
    const osm = await discoverFromOpenStreetMap({ limit: maxDiscover });
    raw.push(...osm);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'OSM discovery failed');
  }

  try {
    const platform = await discoverFromPlatformWebsites(admin, Math.max(5, maxDiscover));
    raw.push(...platform);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Platform discovery failed');
  }

  const discovered = raw.length;
  let inserted = 0;
  let scanned = 0;
  let skipped = 0;

  const pendingScanIds: string[] = [];

  for (const item of raw) {
    if (inserted >= maxDiscover) break;
    const host = websiteHostKey(item.website);
    if (existingHosts.has(host)) {
      skipped++;
      continue;
    }

    const validation = await validateProspectWebsite(item.website);
    if (!validation.dns_valid) {
      skipped++;
      continue;
    }

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
        pipeline_state: 'new',
        scan_status: 'pending',
        lead_score: null,
        conversion_likelihood: null,
        estimated_mrr: null,
        estimated_arr: null,
        opportunity_priority: 0,
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

  if (autoScan) {
    for (const id of pendingScanIds.slice(0, MAX_SCAN_PER_RUN)) {
      const ok = await scanProspect(admin, id);
      if (ok) scanned++;
    }
  }

  await admin.from('owner_discovery_runs').insert({
    source: 'combined',
    discovered_count: discovered,
    inserted_count: inserted,
    scanned_count: scanned,
    skipped_count: skipped,
    error_message: errors.length ? errors.join('; ') : null,
  });

  return { discovered, inserted, scanned, skipped, errors };
}

export async function scanPendingProspects(limit = MAX_SCAN_PER_RUN): Promise<number> {
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
