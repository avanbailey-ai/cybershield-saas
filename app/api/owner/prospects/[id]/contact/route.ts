import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/owner/requireOwner';
import { createAdminClient } from '@/lib/supabase/admin';
import { discoverContactSignals } from '@/lib/owner/contactDiscovery';
import { enrichProspect } from '@/lib/owner/prospectEnrichment';
import { pipelineStateFromScan } from '@/lib/owner/pipeline';
import { logOutreachEvent } from '@/lib/owner/outreachEvents';
import { ensureOutreachDraft } from '@/lib/owner/ensureOutreachDraft';
import type { ProspectPipelineState } from '@/lib/owner/discovery/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: prospect, error: fetchErr } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !prospect) {
    return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
  }

  const signals = await discoverContactSignals(prospect.website as string);
  const enrichment = await enrichProspect({
    business_name: prospect.business_name as string,
    website: prospect.website as string,
    industry: prospect.industry as string | null,
    scan_score: prospect.scan_score as number | null,
    scan_risk_level: prospect.scan_risk_level as string | null,
    lead_score: prospect.lead_score as never,
    scan_status: prospect.scan_status as string,
    dns_valid: prospect.dns_valid as boolean | null,
    http_valid: prospect.http_valid as boolean | null,
    scan_findings: prospect.scan_findings as { issues?: string[] } | null,
    contact_signals: signals,
    skipContactFetch: true,
  });

  let pipeline_state: ProspectPipelineState = pipelineStateFromScan({
    scanStatus: (prospect.scan_status as string) ?? 'pending',
    leadScore: prospect.lead_score as never,
    currentState: prospect.pipeline_state as ProspectPipelineState,
    opportunityScore: enrichment.opportunity_score,
    hasContactEmail: Boolean(enrichment.contact_email),
  });

  if (prospect.scan_status === 'completed' && !enrichment.contact_email) {
    pipeline_state = signals.contact_page_found ? 'needs_contact' : 'no_contact_found';
  }

  const { data: updated, error } = await admin
    .from('owner_prospects')
    .update({
      contact_page_found: enrichment.contact_page_found,
      contact_email_found: enrichment.contact_email_found,
      contact_phone_found: enrichment.contact_phone_found,
      contact_linkedin_found: enrichment.contact_linkedin_found,
      contact_email: enrichment.contact_email,
      contact_phone: enrichment.contact_phone,
      contact_linkedin: enrichment.contact_linkedin,
      pipeline_state,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (enrichment.contact_email) {
    await logOutreachEvent(admin, {
      prospect_id: id,
      event_type: 'contact_found',
      recipient_email: enrichment.contact_email,
      detail: `Contact found for ${prospect.business_name}`,
    });

    if (
      updated &&
      ((updated.pipeline_state as string) === 'outreach_ready' ||
        (updated.pipeline_state as string) === 'qualified')
    ) {
      await ensureOutreachDraft(admin, updated);
    }
  }

  return NextResponse.json({ ok: true, prospect: updated });
}
