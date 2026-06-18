import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { runScan } from '@/lib/scanner/runScan';
import { computeLeadScore } from '@/lib/owner/leadScore';
import { scoreOpportunity } from '@/lib/owner/opportunityScore';
import { openStreetMapProvider } from './sources/openstreetmap';
import { nominatimSearchProvider } from './sources/nominatimSearch';
import { directorySeedProvider } from './sources/seedDirectory';
import { validateProspectWebsite } from './validate';
import { websiteHostKey } from './normalize';
import { pipelineStateFromScan, topIssueFromFindings } from '../pipeline';
import type { DiscoveryRunResult, RawDiscoveredBusiness } from './types';
import type { ProviderDiagnostic, DiscoveryProvider } from './provider';
import {
  getDiscoverySettings,
  type DiscoverySettings,
  DEFAULT_DISCOVERY_SETTINGS,
} from './settings';

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

  const maxInsert = Math.min(settings.maxProspectsPerRun, 50);
  const maxScan = Math.min(settings.maxAutoScansPerRun, 10);
  const autoScan = options?.autoScan !== false;

  const existingHosts = await loadExistingHosts(admin);
  const customerHosts = await loadCustomerHosts(admin);
  const providerDiagnostics: ProviderDiagnostic[] = [];
  const errors: string[] = [];
  const raw: RawDiscoveredBusiness[] = [];

  const params = {
    location: settings.location || DEFAULT_DISCOVERY_SETTINGS.location,
    industry: settings.industry || DEFAULT_DISCOVERY_SETTINGS.industry,
    radiusMeters: settings.radiusMeters,
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
    for (const id of pendingScanIds.slice(0, maxScan)) {
      const ok = await scanProspect(admin, id);
      if (ok) scanned++;
    }
  }

  const errorSummary = errors.length ? errors.join('; ') : null;

  await admin.from('owner_discovery_runs').insert({
    source: 'combined',
    discovered_count: discovered,
    inserted_count: inserted,
    scanned_count: scanned,
    skipped_count: skipped,
    error_message: errorSummary,
    provider_diagnostics: providerDiagnostics,
  });

  return {
    discovered,
    inserted,
    scanned,
    skipped,
    validated,
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
