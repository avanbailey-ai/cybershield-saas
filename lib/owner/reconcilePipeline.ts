import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichProspect } from './prospectEnrichment';
import { pipelineStateFromScan, topIssueFromFindings } from './pipeline';
import { ensureOutreachDraft } from './ensureOutreachDraft';
import type { ProspectPipelineState } from './discovery/types';
import type { LeadScore } from './types';
import type { ContactSignals } from './contactDiscovery';
import { sanitizePhone } from './placeholderPhone';

function resolvePipelineState(input: {
  scanStatus: string;
  leadScore: LeadScore | null;
  currentState: ProspectPipelineState | null;
  opportunityScore: number;
  contactEmail: string | null;
  contactPageFound: boolean;
  scanIssues?: string[];
}): ProspectPipelineState {
  const pipeline = pipelineStateFromScan({
    scanStatus: input.scanStatus,
    leadScore: input.leadScore,
    currentState: input.currentState,
    opportunityScore: input.opportunityScore,
    hasContactEmail: Boolean(input.contactEmail?.trim()),
    scanIssues: input.scanIssues,
  });

  if (input.scanStatus === 'completed' && !input.contactEmail?.trim()) {
    return input.contactPageFound ? 'needs_contact' : pipeline === 'bad_fit' ? 'bad_fit' : 'no_contact_found';
  }

  return pipeline;
}

/** Recompute pipeline_state for one prospect from stored scan + contact data. */
export async function reconcileOneProspect(
  admin: SupabaseClient,
  prospect: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const terminal: ProspectPipelineState[] = [
    'contacted',
    'interested',
    'customer',
    'archived',
    'ignore_forever',
    'follow_up_scheduled',
    'follow_up_due',
  ];
  const current = (prospect.pipeline_state as ProspectPipelineState) ?? 'new_discovery';
  if (terminal.includes(current)) return null;

  const scanStatus = (prospect.scan_status as string) ?? 'pending';
  const findings = prospect.scan_findings as { issues?: string[] } | null;

  const enrichment = await enrichProspect({
    business_name: prospect.business_name as string,
    website: prospect.website as string,
    industry: prospect.industry as string | null,
    scan_score: prospect.scan_score as number | null,
    scan_risk_level: prospect.scan_risk_level as string | null,
    lead_score: prospect.lead_score as LeadScore | null,
    scan_status: scanStatus,
    dns_valid: prospect.dns_valid as boolean | null,
    http_valid: prospect.http_valid as boolean | null,
    scan_findings: findings,
    skipContactFetch: Boolean((prospect.contact_email as string | null)?.trim()),
    contact_signals: (prospect.contact_email as string | null)?.trim()
      ? {
          contact_page_found: Boolean(prospect.contact_page_found),
          contact_email_found: true,
          contact_phone_found: Boolean(prospect.contact_phone_found),
          contact_linkedin_found: Boolean(prospect.contact_linkedin_found),
          contact_email: prospect.contact_email as string,
          contact_phone: (prospect.contact_phone as string) ?? null,
          contact_linkedin: (prospect.contact_linkedin as string) ?? null,
          contact_confidence:
            (prospect.contact_confidence as ContactSignals['contact_confidence']) ?? 'likely_business_email',
        }
      : undefined,
  });

  const contactEmail = enrichment.contact_email ?? (prospect.contact_email as string | null);
  const pipeline_state = resolvePipelineState({
    scanStatus,
    leadScore: prospect.lead_score as LeadScore | null,
    currentState: current,
    opportunityScore: enrichment.opportunity_score,
    contactEmail,
    contactPageFound: enrichment.contact_page_found,
    scanIssues: findings?.issues,
  });

  const { data: updated, error } = await admin
    .from('owner_prospects')
    .update({
      opportunity_score: enrichment.opportunity_score,
      estimated_plan_fit: enrichment.estimated_plan_fit,
      conversion_likelihood: enrichment.conversion_likelihood,
      contact_page_found: enrichment.contact_page_found,
      contact_email_found: Boolean(contactEmail?.trim()),
      contact_phone_found: enrichment.contact_phone_found,
      contact_linkedin_found: enrichment.contact_linkedin_found,
      contact_email: contactEmail,
      contact_phone: sanitizePhone(enrichment.contact_phone ?? (prospect.contact_phone as string)),
      contact_linkedin: enrichment.contact_linkedin ?? prospect.contact_linkedin,
      qualification_reasons: enrichment.qualification_reasons,
      selection_reason: enrichment.selection_reason,
      pipeline_state,
      top_issue: topIssueFromFindings(findings),
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospect.id as string)
    .select()
    .single();

  if (error || !updated) return null;

  if (
    (pipeline_state === 'outreach_ready' || pipeline_state === 'qualified') &&
    contactEmail?.trim()
  ) {
    await ensureOutreachDraft(admin, updated);
  }

  return updated;
}

export async function reconcileProspectPipeline(admin: SupabaseClient): Promise<{
  updated: number;
  outreachReady: number;
}> {
  const { data: rows } = await admin
    .from('owner_prospects')
    .select('*')
    .is('deleted_at', null)
    .not('pipeline_state', 'in', '("archived","ignore_forever","customer","contacted","interested")')
    .limit(200);

  let updated = 0;
  let outreachReady = 0;
  for (const row of rows ?? []) {
    const next = await reconcileOneProspect(admin, row);
    if (next) {
      updated++;
      if (next.pipeline_state === 'outreach_ready') outreachReady++;
    }
  }
  return { updated, outreachReady };
}
