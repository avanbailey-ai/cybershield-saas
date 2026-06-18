import type { SupabaseClient } from '@supabase/supabase-js';
import { logOutreachEvent } from './outreachEvents';

async function ensureAutopilotCampaign(admin: SupabaseClient): Promise<string> {
  const { data: existing } = await admin
    .from('owner_campaigns')
    .select('id')
    .eq('name', 'Founder Autopilot')
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created } = await admin
    .from('owner_campaigns')
    .insert({
      name: 'Founder Autopilot',
      duration_days: 30,
      status: 'active',
      start_date: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single();

  return (created?.id as string) ?? '';
}

async function queueNextActions(
  admin: SupabaseClient,
  businessName: string,
): Promise<void> {
  const campaignId = await ensureAutopilotCampaign(admin);
  if (!campaignId) return;

  const tasks = [
    { title: `Schedule call with ${businessName}`, day_offset: 0 },
    { title: `Send plan/pricing link to ${businessName}`, day_offset: 1 },
    { title: `Send follow-up email to ${businessName}`, day_offset: 3 },
  ];

  for (const task of tasks) {
    await admin.from('owner_campaign_tasks').insert({
      campaign_id: campaignId,
      title: task.title,
      day_offset: task.day_offset,
      completed: false,
    });
  }
}

export async function approveInterestedLead(
  admin: SupabaseClient,
  prospectId: string,
): Promise<{ ok: boolean; action: string; detail?: string }> {
  const { data: prospect, error } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', prospectId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !prospect) {
    return { ok: false, action: 'interested', detail: 'Prospect not found' };
  }

  const now = new Date().toISOString();
  const interestSource =
    (prospect.pipeline_state as string) === 'interested'
      ? 'founder_inbox_confirm'
      : 'founder_inbox_promoted';

  await admin
    .from('owner_prospects')
    .update({ pipeline_state: 'interested', updated_at: now })
    .eq('id', prospectId);

  const { data: crmByProspect } = await admin
    .from('owner_crm_leads')
    .select('id')
    .eq('prospect_id', prospectId)
    .is('deleted_at', null)
    .maybeSingle();

  const crmPayload = {
    business_name: prospect.business_name as string,
    website: prospect.website as string,
    industry: prospect.industry as string | null,
    contact_email: prospect.contact_email as string | null,
    lead_score: prospect.lead_score as string | null,
    potential_revenue: prospect.estimated_plan_fit as number | null,
    stage: 'demo' as const,
    prospect_id: prospectId,
    interest_at: now,
    interest_source: interestSource,
    last_contact_at: now,
    notes: `Interested lead approved from Founder Inbox. ${prospect.selection_reason ?? ''}`.trim(),
  };

  if (crmByProspect?.id) {
    await admin.from('owner_crm_leads').update(crmPayload).eq('id', crmByProspect.id);
  } else if (prospect.contact_email) {
    const { data: crmByEmail } = await admin
      .from('owner_crm_leads')
      .select('id')
      .ilike('contact_email', prospect.contact_email as string)
      .is('deleted_at', null)
      .maybeSingle();

    if (crmByEmail?.id) {
      await admin.from('owner_crm_leads').update(crmPayload).eq('id', crmByEmail.id);
    } else {
      await admin.from('owner_crm_leads').insert(crmPayload);
    }
  } else {
    await admin.from('owner_crm_leads').insert(crmPayload);
  }

  await logOutreachEvent(admin, {
    prospect_id: prospectId,
    event_type: 'prospect_interested',
    recipient_email: prospect.contact_email as string | null,
    detail: `${prospect.business_name} moved to Interested — CRM updated`,
    metadata: { interest_source: interestSource },
  });

  await queueNextActions(admin, prospect.business_name as string);

  await admin.from('owner_inbox_dismissals').upsert(
    { inbox_item_id: `interested-${prospectId}`, dismissed_at: now },
    { onConflict: 'inbox_item_id' },
  );

  return {
    ok: true,
    action: 'interested',
    detail: `${prospect.business_name} → Interested. CRM updated, next actions queued.`,
  };
}
