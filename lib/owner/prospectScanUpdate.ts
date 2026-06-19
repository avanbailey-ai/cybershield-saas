import type { SupabaseClient } from '@supabase/supabase-js';
import { runScan } from '@/lib/scanner/runScan';
import { computeLeadScore } from '@/lib/owner/leadScore';
import { enrichProspect } from '@/lib/owner/prospectEnrichment';
import { topIssueFromFindings } from '@/lib/owner/pipeline';
import { ensureOutreachDraft } from '@/lib/owner/ensureOutreachDraft';
import { canCreateOutreachDraft } from '@/lib/owner/prospectQualityBrain';

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
      prospect_kind: (prospect.prospect_kind as 'smb' | 'agency' | null) ?? 'smb',
      agency_score: prospect.agency_opportunity_score as number | null,
      agency_label: prospect.agency_label as never,
    });

    const resolvedPipeline = enrichment.pipeline_state;

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
        contact_email_found: Boolean(enrichment.contact_email),
        contact_phone_found: enrichment.contact_phone_found,
        contact_linkedin_found: enrichment.contact_linkedin_found,
        contact_email: enrichment.contact_email,
        contact_phone: enrichment.contact_phone,
        contact_linkedin: enrichment.contact_linkedin,
        contact_confidence: enrichment.contact_confidence,
        qualification_reasons: enrichment.qualification_reasons,
        selection_reason: enrichment.selection_reason,
        quality_label: enrichment.quality_label,
        quality_stage: enrichment.quality_stage,
        rejection_reason: enrichment.rejection_reason,
        buying_trigger: enrichment.buying_trigger,
        why_now: enrichment.why_now,
        pipeline_state: resolvedPipeline,
        top_issue: topIssueFromFindings({ issues: result.issues }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { ok: false };

    if (updated && canCreateOutreachDraft(updated as never)) {
      await ensureOutreachDraft(admin, updated);
    }

    return { ok: true, prospect: updated ?? undefined };
  } catch {
    await admin.from('owner_prospects').update({ scan_status: 'failed' }).eq('id', id);
    return { ok: false };
  }
}
