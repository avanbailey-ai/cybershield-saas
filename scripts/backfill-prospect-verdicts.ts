/**
 * Recompute stored prospect verdicts using current read-time ICP / agency logic.
 *
 * Safe: no deletes, no emails, no draft sends, no contact fabrication.
 *
 * Usage:
 *   npx tsx scripts/backfill-prospect-verdicts.ts --dry-run
 *   npx tsx scripts/backfill-prospect-verdicts.ts --apply
 *   npx tsx scripts/backfill-prospect-verdicts.ts --dry-run --limit=100
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { enrichProspect } from '../lib/owner/prospectEnrichment';
import {
  computeIcpQueueSnapshot,
  evaluateBuyerFit,
  type RevenueQueue,
} from '../lib/owner/icpGate';
import { resolveProspectScores, isTrulyOutreachReady } from '../lib/owner/prospectDisplay';
import {
  isRealAgencyLead,
  prospectVerdict,
  recommendedOutreachAction,
} from '../lib/owner/prospectVerdict';
import { AGENCY_PLAN_PRICE } from '../lib/owner/agency/agencyScore';
import type { OwnerProspect } from '../lib/owner/types';
import type { ContactSignals } from '../lib/owner/contactDiscovery';
import type { ContactConfidence } from '../lib/owner/prospectQualityBrain';

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
  }
}

loadLocalEnv();

const SKIP_PIPELINE = new Set([
  'archived',
  'ignore_forever',
  'customer',
  'contacted',
  'interested',
]);

const AUDIT_NAMES = [
  'PLEXIS',
  'Western Lumber',
  'DSV',
  'Centennial',
  'centennialco',
  'McDonald',
  'mcdonalds',
  'Dollar General',
  'dollargeneral',
  'Heart Hospital',
  'stdavids',
  'Church',
  'School',
];

const DRAFT_BLOCK_PREFIX = 'Draft blocked — buyer-fit/contact rules failed';

const CONFIDENCE_RANK: Record<string, number> = {
  verified_public_email: 5,
  likely_business_email: 4,
  generic_public_inbox: 3,
  personal_public_contact: 2,
  unverified_guess: 1,
  no_contact: 0,
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: !args.includes('--apply'),
    limit: Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0) || undefined,
    auditOnly: args.includes('--audit-only'),
    inputFile: args.find((a) => a.startsWith('--input='))?.split('=')[1],
    sqlOut: args.find((a) => a.startsWith('--sql-out='))?.split('=')[1],
  };
}

function signalsFromRow(row: OwnerProspect): ContactSignals {
  return {
    contact_page_found: row.contact_page_found ?? false,
    contact_email_found: row.contact_email_found ?? Boolean(row.contact_email?.trim()),
    contact_phone_found: row.contact_phone_found ?? Boolean(row.contact_phone?.trim()),
    contact_linkedin_found: row.contact_linkedin_found ?? false,
    contact_email: row.contact_email ?? null,
    contact_phone: row.contact_phone ?? null,
    contact_linkedin: row.contact_linkedin ?? null,
    contact_confidence: (row.contact_confidence as ContactConfidence) ?? 'no_contact',
  };
}

function pickContactConfidence(
  stored: string | null | undefined,
  computed: ContactConfidence,
): ContactConfidence | undefined {
  const storedRank = CONFIDENCE_RANK[stored ?? ''] ?? -1;
  const computedRank = CONFIDENCE_RANK[computed] ?? 0;
  if (storedRank >= computedRank) return undefined;
  return computed;
}

function correctProspectKind(row: OwnerProspect): 'smb' | 'agency' {
  return isRealAgencyLead(row) ? 'agency' : 'smb';
}

async function recomputeVerdict(row: OwnerProspect) {
  const kind = correctProspectKind(row);
  const signals = signalsFromRow(row);

  const enrichment = await enrichProspect({
    business_name: row.business_name,
    website: row.website,
    industry: row.industry,
    scan_score: row.scan_score,
    scan_risk_level: row.scan_risk_level,
    lead_score: row.lead_score,
    scan_status: row.scan_status,
    dns_valid: row.dns_valid,
    http_valid: row.http_valid,
    scan_findings: row.scan_findings as { issues?: string[] } | null,
    contact_signals: signals,
    skipContactFetch: true,
    prospect_kind: kind,
    agency_score: row.agency_opportunity_score,
    agency_label: row.agency_label,
    agency_discovery_mode: row.prospect_kind === 'agency',
  });

  const merged: OwnerProspect = {
    ...row,
    ...resolveProspectScores({
      ...row,
      prospect_kind: kind,
      opportunity_score: enrichment.opportunity_score,
      estimated_plan_fit: enrichment.estimated_plan_fit,
      conversion_likelihood: enrichment.conversion_likelihood,
    }),
    prospect_kind: kind,
    pipeline_state: enrichment.pipeline_state,
    quality_label: enrichment.quality_label,
    quality_stage: enrichment.quality_stage,
    rejection_reason: enrichment.rejection_reason,
    buying_trigger: enrichment.buying_trigger,
    why_now: enrichment.why_now,
    contact_confidence: enrichment.contact_confidence as ContactConfidence,
    estimated_plan_fit: enrichment.estimated_plan_fit,
    opportunity_score: enrichment.opportunity_score,
    conversion_likelihood: enrichment.conversion_likelihood,
    qualification_reasons: enrichment.qualification_reasons,
    selection_reason: enrichment.selection_reason,
  };

  const fit = evaluateBuyerFit(merged);
  return { merged, fit, enrichment, kind };
}

function buildPatch(
  row: OwnerProspect,
  next: OwnerProspect,
  enrichment: Awaited<ReturnType<typeof enrichProspect>>,
  kind: 'smb' | 'agency',
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const now = new Date().toISOString();

  const set = (key: string, value: unknown, current: unknown) => {
    if (value === current) return;
    if (value === null && current === undefined) return;
    patch[key] = value;
  };

  set('prospect_kind', kind, row.prospect_kind ?? 'smb');
  set('pipeline_state', next.pipeline_state, row.pipeline_state);
  set('quality_label', next.quality_label, row.quality_label);
  set('quality_stage', next.quality_stage, row.quality_stage);
  set('rejection_reason', next.rejection_reason, row.rejection_reason);
  set('buying_trigger', next.buying_trigger, row.buying_trigger);
  set('why_now', next.why_now, row.why_now);
  set('opportunity_score', next.opportunity_score, row.opportunity_score);
  set('conversion_likelihood', next.conversion_likelihood, row.conversion_likelihood);
  set('estimated_plan_fit', next.estimated_plan_fit, row.estimated_plan_fit);
  set('qualification_reasons', enrichment.qualification_reasons, row.qualification_reasons);
  set('selection_reason', enrichment.selection_reason, row.selection_reason);

  const conf = pickContactConfidence(row.contact_confidence, enrichment.contact_confidence);
  if (conf) patch.contact_confidence = conf;

  if (row.prospect_kind === 'agency' && kind === 'smb') {
    set('agency_label', 'NOT AGENCY FIT', row.agency_label);
    if (row.estimated_plan_fit === AGENCY_PLAN_PRICE) {
      set('estimated_plan_fit', next.estimated_plan_fit, row.estimated_plan_fit);
    }
  }

  if (Object.keys(patch).length > 0) patch.updated_at = now;
  return patch;
}

function queueCounts(prospects: OwnerProspect[]) {
  return computeIcpQueueSnapshot(prospects);
}

async function loadProspects(admin: SupabaseClient | null, limit?: number, inputFile?: string) {
  if (inputFile) {
    const raw = readFileSync(resolve(process.cwd(), inputFile), 'utf8');
    const parsed = JSON.parse(raw) as OwnerProspect[];
    return limit ? parsed.slice(0, limit) : parsed;
  }
  if (!admin) throw new Error('Supabase admin client required without --input');
  let query = admin.from('owner_prospects').select('*').is('deleted_at', null).order('updated_at', {
    ascending: false,
  });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load prospects: ${error.message}`);
  return (data ?? []) as OwnerProspect[];
}

async function blockIneligibleDrafts(
  admin: SupabaseClient,
  prospectById: Map<string, OwnerProspect>,
  dryRun: boolean,
) {
  const { data: drafts, error } = await admin
    .from('owner_outreach_drafts')
    .select('id, prospect_id, business_name, status, send_error, sent_at')
    .is('deleted_at', null)
    .is('sent_at', null)
    .in('status', ['draft', 'approved']);

  if (error) throw new Error(`Failed to load drafts: ${error.message}`);

  let blocked = 0;
  const blockedNames: string[] = [];

  for (const draft of drafts ?? []) {
    const prospectId = draft.prospect_id as string | null;
    if (!prospectId) continue;
    const prospect = prospectById.get(prospectId);
    if (!prospect) continue;

    const resolved = resolveProspectScores(prospect);
    const fit = evaluateBuyerFit(resolved);
    const eligible = isTrulyOutreachReady(resolved) && fit.sendQueueEligible;

    if (eligible) continue;

    const reason = fit.blockReason ?? 'Buyer-fit/contact rules failed';
    const message = `${DRAFT_BLOCK_PREFIX}: ${reason}`;
    if (draft.send_error === message && draft.status === 'draft') continue;

    blocked++;
    blockedNames.push(String(draft.business_name ?? draft.id));

    if (!dryRun) {
      await admin
        .from('owner_outreach_drafts')
        .update({
          status: 'draft',
          send_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id as string);
    }
  }

  return { blocked, blockedNames };
}

function auditExamples(prospects: OwnerProspect[]) {
  const hits: Array<{
    name: string;
    website: string;
    kind: string;
    planFit: number | null;
    quality: string | null;
    pipeline: string;
    icp: string;
    queue: RevenueQueue;
    sendEligible: boolean;
    verdict: string;
    action: string;
  }> = [];

  for (const row of prospects) {
    const hay = `${row.business_name} ${row.website}`.toLowerCase();
    if (!AUDIT_NAMES.some((n) => hay.includes(n.toLowerCase()))) continue;

    const resolved = resolveProspectScores(row);
    const fitEval = evaluateBuyerFit(resolved);
    const action = recommendedOutreachAction(resolved);

    hits.push({
      name: row.business_name,
      website: row.website,
      kind: correctProspectKind(resolved),
      planFit: fitEval.planFit ?? resolved.estimated_plan_fit,
      quality: resolved.quality_label ?? null,
      pipeline: resolved.pipeline_state,
      icp: fitEval.icpStatus,
      queue: fitEval.revenueQueue,
      sendEligible: fitEval.sendQueueEligible,
      verdict: prospectVerdict(resolved),
      action: action.label,
    });
  }

  return hits;
}

async function main() {
  const { dryRun, limit, auditOnly, inputFile, sqlOut } = parseArgs();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  let admin: SupabaseClient | null = null;
  if (!inputFile) {
    if (!supabaseUrl || !serviceKey) {
      console.error(
        'Missing Supabase credentials. Set SUPABASE_SERVICE_ROLE_KEY in .env.local or pass --input=prospects.json.',
      );
      process.exit(1);
    }
    admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  }

  const prospects = await loadProspects(admin, limit, inputFile);

  const beforeResolved = prospects.map((p) => resolveProspectScores(p));
  const beforeQueues = queueCounts(beforeResolved);

  console.log(`\nCyberShield — prospect verdict backfill (${dryRun ? 'DRY RUN' : 'APPLY'})`);
  console.log(`Loaded ${prospects.length} prospect(s)\n`);
  console.log('Queue snapshot BEFORE (read-time on stored rows):');
  console.log(JSON.stringify(beforeQueues, null, 2));

  const auditBefore = auditExamples(beforeResolved);
  if (auditBefore.length > 0) {
    console.log('\nNamed audit examples BEFORE:');
    for (const a of auditBefore) {
      console.log(`  ${a.name} | kind=${a.kind} plan=$${a.planFit ?? '—'} queue=${a.queue} send=${a.sendEligible} | ${a.verdict}`);
    }
  }

  if (auditOnly) return;

  let updated = 0;
  let agencyCorrected = 0;
  const changedSamples: string[] = [];
  const sqlStatements: string[] = [];

  for (const row of prospects) {
    if (SKIP_PIPELINE.has(row.pipeline_state)) continue;

    const { merged, fit, enrichment, kind } = await recomputeVerdict(row);
    const patch = buildPatch(row, merged, enrichment, kind);

    const wasFalseAgency = row.prospect_kind === 'agency' && kind === 'smb';
    if (wasFalseAgency) agencyCorrected++;

    if (Object.keys(patch).length === 0) continue;

    updated++;
    if (changedSamples.length < 15) {
      changedSamples.push(
        `${row.business_name}: ${Object.keys(patch).filter((k) => k !== 'updated_at').join(', ')} → queue=${fit.revenueQueue}`,
      );
    }

    if (sqlOut) {
      const sets = Object.entries(patch)
        .map(([k, v]) => {
          if (v === null) return `${k} = NULL`;
          if (typeof v === 'number') return `${k} = ${v}`;
          if (typeof v === 'boolean') return `${k} = ${v}`;
          if (Array.isArray(v)) return `${k} = '${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
          return `${k} = '${String(v).replace(/'/g, "''")}'`;
        })
        .join(', ');
      sqlStatements.push(`UPDATE owner_prospects SET ${sets} WHERE id = '${row.id}';`);
    } else if (!dryRun && admin) {
      const { error } = await admin.from('owner_prospects').update(patch).eq('id', row.id);
      if (error) {
        console.error(`Update failed for ${row.business_name}: ${error.message}`);
      }
    }
  }

  const afterRows = dryRun || sqlOut
    ? await Promise.all(
        prospects.map(async (row) => {
          if (SKIP_PIPELINE.has(row.pipeline_state)) return resolveProspectScores(row);
          const { merged } = await recomputeVerdict(row);
          return merged;
        }),
      )
    : admin
      ? (await loadProspects(admin, limit, inputFile)).map((p) => resolveProspectScores(p))
      : prospects.map((p) => resolveProspectScores(p));

  const afterQueues = queueCounts(afterRows);
  const prospectById = new Map(afterRows.map((p) => [p.id, p]));
  const { blocked, blockedNames } = admin
    ? await blockIneligibleDrafts(admin, prospectById, dryRun || Boolean(sqlOut))
    : { blocked: 0, blockedNames: [] as string[] };

  const auditAfter = auditExamples(afterRows);

  console.log('\n--- Results ---');
  console.log(`Prospects updated: ${updated}${dryRun ? ' (would update)' : ''}`);
  console.log(`False agency labels corrected: ${agencyCorrected}`);
  console.log(`Drafts blocked: ${blocked}${dryRun ? ' (would block)' : ''}`);
  if (blockedNames.length > 0) {
    console.log(`Blocked drafts: ${blockedNames.slice(0, 10).join('; ')}${blockedNames.length > 10 ? '…' : ''}`);
  }

  console.log('\nQueue snapshot AFTER:');
  console.log(JSON.stringify(afterQueues, null, 2));

  if (changedSamples.length > 0) {
    console.log('\nSample changes:');
    for (const s of changedSamples) console.log(`  ${s}`);
  }

  if (auditAfter.length > 0) {
    console.log('\nNamed audit examples AFTER:');
    for (const a of auditAfter) {
      console.log(
        `  ${a.name} | kind=${a.kind} plan=$${a.planFit ?? '—'} queue=${a.queue} send=${a.sendEligible} | ${a.verdict} | action: ${a.action}`,
      );
    }
  }

  if (sqlOut && sqlStatements.length > 0) {
    writeFileSync(resolve(process.cwd(), sqlOut), sqlStatements.join('\n') + '\n', 'utf8');
    console.log(`\nWrote ${sqlStatements.length} SQL statement(s) to ${sqlOut}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
