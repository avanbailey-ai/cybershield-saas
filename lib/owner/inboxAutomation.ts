import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { scheduleRetentionEmails } from '@/lib/brain/retention';

export interface InboxExecutionResult {
  ok: boolean;
  action: string;
  detail?: string;
}

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

async function queueAutopilotTask(
  admin: SupabaseClient,
  title: string,
  dayOffset = 0,
): Promise<void> {
  const campaignId = await ensureAutopilotCampaign(admin);
  if (!campaignId) return;

  await admin.from('owner_campaign_tasks').insert({
    campaign_id: campaignId,
    title,
    day_offset: dayOffset,
    completed: false,
  });
}

async function approveOutreach(
  admin: SupabaseClient,
  draftId: string,
): Promise<InboxExecutionResult> {
  const { data: draft } = await admin
    .from('owner_outreach_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle();

  if (!draft) return { ok: false, action: 'outreach', detail: 'Draft not found' };

  let prospect: { contact_email?: string; business_name?: string } | null = null;
  if (draft.prospect_id) {
    const { data } = await admin
      .from('owner_prospects')
      .select('contact_email, business_name')
      .eq('id', draft.prospect_id)
      .maybeSingle();
    prospect = data;
  }

  let sent = false;
  const toEmail = prospect?.contact_email;

  if (toEmail && draft.content) {
    const subject = `Security findings for ${draft.business_name ?? prospect?.business_name ?? 'your business'}`;
    const html = String(draft.content).includes('<')
      ? String(draft.content)
      : `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${String(draft.content)}</pre>`;

    const result = await sendEmail({ to: toEmail, subject, html });
    sent = result.success;

    await admin.from('email_queue').insert({
      email: toEmail,
      template: 'founder_outreach',
      type: 'founder_outreach',
      scheduled_for: new Date().toISOString(),
      status: sent ? 'completed' : 'pending',
      sent,
      payload: {
        email: toEmail,
        template: 'founder_outreach',
        draft_id: draftId,
        sent,
      },
      metadata: { draft_id: draftId, business_name: draft.business_name },
    });
  }

  await admin
    .from('owner_outreach_drafts')
    .update({ status: sent ? 'sent' : 'approved' })
    .eq('id', draftId);

  if (draft.prospect_id) {
    await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'contacted', updated_at: new Date().toISOString() })
      .eq('id', draft.prospect_id);
  }

  return {
    ok: true,
    action: 'outreach',
    detail: sent ? `Email sent to ${toEmail}` : toEmail ? 'Approved — queued for send' : 'Approved — no contact email',
  };
}

async function approveRetention(
  admin: SupabaseClient,
  userId: string,
): Promise<InboxExecutionResult> {
  const { data: profile } = await admin
    .from('profiles')
    .select('churn_risk_score')
    .eq('id', userId)
    .maybeSingle();

  const churnRisk = (profile?.churn_risk_score as number) ?? 75;
  await scheduleRetentionEmails(userId, churnRisk);
  await queueAutopilotTask(admin, `Retention outreach queued for ${userId}`, 0);

  return { ok: true, action: 'retention', detail: 'Retention emails scheduled' };
}

async function approveExpansion(
  admin: SupabaseClient,
  userId: string,
  meta?: Record<string, unknown>,
): Promise<InboxExecutionResult> {
  const toPlan = (meta?.toPlan as string) ?? 'upgrade';
  const mrr = meta?.mrr ?? meta?.mrrGain;
  await queueAutopilotTask(
    admin,
    `Expansion offer: ${userId} → ${toPlan}${mrr ? ` (+$${mrr}/mo)` : ''}`,
    1,
  );

  return { ok: true, action: 'expansion', detail: 'Expansion task created' };
}

async function approveFollowUp(
  admin: SupabaseClient,
  prospectId: string,
): Promise<InboxExecutionResult> {
  const { data: prospect } = await admin
    .from('owner_prospects')
    .select('contact_email, business_name')
    .eq('id', prospectId)
    .maybeSingle();

  const scheduledFor = new Date(Date.now() + 3 * 86400000).toISOString();

  if (prospect?.contact_email) {
    await admin.from('email_queue').insert({
      email: prospect.contact_email,
      template: 'founder_follow_up',
      type: 'founder_follow_up',
      scheduled_for: scheduledFor,
      status: 'pending',
      payload: {
        email: prospect.contact_email,
        template: 'founder_follow_up',
        prospect_id: prospectId,
        scheduled_for: scheduledFor,
      },
      metadata: { prospect_id: prospectId, business_name: prospect.business_name },
    });
  }

  await queueAutopilotTask(
    admin,
    `Follow-up scheduled: ${prospect?.business_name ?? prospectId}`,
    3,
  );

  return { ok: true, action: 'follow_up', detail: 'Follow-up scheduled in 3 days' };
}

export async function executeInboxApproval(
  admin: SupabaseClient,
  id: string,
  meta?: Record<string, unknown>,
): Promise<InboxExecutionResult> {
  if (id.startsWith('draft-')) {
    return approveOutreach(admin, id.replace('draft-', ''));
  }

  if (id.startsWith('risk-')) {
    const userId = (meta?.userId as string) ?? id.replace('risk-', '');
    return approveRetention(admin, userId);
  }

  if (id.startsWith('churn-')) {
    const userId = id.replace('churn-', '');
    return approveRetention(admin, userId);
  }

  if (id.startsWith('exp-')) {
    const userId = (meta?.userId as string) ?? id.replace('exp-', '');
    return approveExpansion(admin, userId, meta);
  }

  if (id.startsWith('followup-')) {
    const prospectId = id.replace('followup-', '');
    return approveFollowUp(admin, prospectId);
  }

  if (id.startsWith('signup-')) {
    await queueAutopilotTask(admin, 'Review new signup onboarding path', 0);
    return { ok: true, action: 'signup_review', detail: 'Signup review task created' };
  }

  return { ok: true, action: 'acknowledge', detail: 'Acknowledged' };
}
