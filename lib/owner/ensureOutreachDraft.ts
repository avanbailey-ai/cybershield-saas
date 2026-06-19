import type { SupabaseClient } from '@supabase/supabase-js';
import { generateOutreach } from './generators/outreach';

/**
 * Create an outreach draft when a prospect is ready — idempotent per prospect.
 */
export async function ensureOutreachDraft(
  admin: SupabaseClient,
  prospect: Record<string, unknown>,
): Promise<{ created: boolean; draftId?: string }> {
  const prospectId = prospect.id as string;
  const contactEmail = (prospect.contact_email as string | null)?.trim();
  const pipelineState = (prospect.pipeline_state as string) ?? '';

  if (!contactEmail) return { created: false };
  if (prospect.scan_status !== 'completed') return { created: false };
  if (pipelineState === 'archived' || pipelineState === 'ignore_forever') return { created: false };
  if (pipelineState !== 'outreach_ready' && pipelineState !== 'qualified') return { created: false };

  const { count } = await admin
    .from('owner_outreach_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('prospect_id', prospectId)
    .is('deleted_at', null)
    .in('status', ['draft', 'approved']);

  if ((count ?? 0) > 0) return { created: false };

  const findings = prospect.scan_findings as { issues?: string[] } | null;
  const content = generateOutreach('cold_email', {
    businessName: prospect.business_name as string,
    website: prospect.website as string,
    industry: (prospect.industry as string) ?? undefined,
    city: (prospect.city as string) ?? undefined,
    scanScore: prospect.scan_score as number | undefined,
    riskLevel: prospect.scan_risk_level as string | undefined,
    issues: findings?.issues,
    contactEmail: contactEmail,
  });

  const { data: draft, error } = await admin
    .from('owner_outreach_drafts')
    .insert({
      prospect_id: prospectId,
      outreach_type: 'cold_email',
      business_name: prospect.business_name,
      content,
      status: 'draft',
      recipient_email: contactEmail,
    })
    .select('id')
    .single();

  if (error || !draft?.id) return { created: false };

  return { created: true, draftId: draft.id as string };
}
