import type { SupabaseClient } from '@supabase/supabase-js';
import { runScan } from '@/lib/scanner/runScan';
import { computeLeadScore } from '@/lib/owner/leadScore';
import { enrichProspect } from '@/lib/owner/prospectEnrichment';
import { pipelineStateFromScan, topIssueFromFindings } from '@/lib/owner/pipeline';
import { ensureOutreachDraft } from '@/lib/owner/ensureOutreachDraft';

export async function applyProspectScan(
  admin: SupabaseClient,
  prospect: Record<string, unknown>,
): Promise<{ ok: boolean; prospect?: Record<string, unknown> }> {
  const id = prospect.id as string;

  await admin.from('owner_prospects').update({ scan_status: 'running' }).eq('id', id);

  try {
    let url = (prospect.website as string).trim();
    if (!url.startsWith('http')) url = `https://${url}`;

    const result = await runScan(url);
    const leadScore = computeLeadScore(result);
    const enrichment = await enrichProspect({
      business_name: prospect.business_name as string,
      website: prospect.website as string,
      industry: prospect.industry as string | null,
      scan_score: result.score,
      scan_risk_level: result.riskLevel,
      lead_score: leadScore,
      scan_status: 'completed',
      dns_valid: prospect.dns_valid as boolean | null,
      http_valid: prospect.http_valid as boolean | null,
      scan_findings: { issues: result.issues },
      skipContactFetch: false,
    });

    const pipeline_state = pipelineStateFromScan({
      scanStatus: 'completed',
      leadScore,
      currentState: prospect.pipeline_state as never,
      opportunityScore: enrichment.opportunity_score,
      hasContactEmail: Boolean(enrichment.contact_email),
    });

    const resolvedPipeline =
      !enrichment.contact_email && pipeline_state === 'needs_contact'
        ? enrichment.contact_page_found
          ? 'needs_contact'
          : 'no_contact_found'
        : pipeline_state;

    const { data: updated, error } = await admin
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
        pipeline_state: resolvedPipeline,
        top_issue: topIssueFromFindings({ issues: result.issues }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { ok: false };

    if (updated && resolvedPipeline === 'outreach_ready' && enrichment.contact_email) {
      await ensureOutreachDraft(admin, updated);
    } else if (
      updated &&
      resolvedPipeline === 'qualified' &&
      enrichment.contact_email &&
      (enrichment.opportunity_score ?? 0) >= 50
    ) {
      await ensureOutreachDraft(admin, updated);
    }

    return { ok: true, prospect: updated ?? undefined };
  } catch {
    await admin.from('owner_prospects').update({ scan_status: 'failed' }).eq('id', id);
    return { ok: false };
  }
}
