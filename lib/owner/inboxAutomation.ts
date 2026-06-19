import type { SupabaseClient } from '@supabase/supabase-js';
import { scheduleRetentionEmails } from '@/lib/brain/retention';
import { sendApprovedOutreach } from '@/lib/owner/outreachExecution';
import { sendRetentionEmail,
  retentionTemplateForRisk,
  type RetentionTemplateType,
} from '@/lib/owner/retentionOutreach';
import { approveInterestedLead } from '@/lib/owner/interestedLeadApproval';
import { getCustomerHealth } from '@/lib/owner/customerHealth';
import { generateOutreach } from '@/lib/owner/generators/outreach';
import { logOutreachEvent } from '@/lib/owner/outreachEvents';

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
  const result = await sendApprovedOutreach(admin, draftId, { approved: true });
  return {
    ok: result.ok,
    action: 'outreach',
    detail: result.ok
      ? `Email sent to ${result.recipient}`
      : result.error ?? 'Outreach send failed',
  };
}

async function approveRetention(
  admin: SupabaseClient,
  userId: string,
  templateOverride?: RetentionTemplateType,
): Promise<InboxExecutionResult> {
  const health = await getCustomerHealth();
  const customer = health.customers.find((c) => c.userId === userId);

  if (customer?.email) {
    const template =
      templateOverride ?? retentionTemplateForRisk(customer.status);
    const sendResult = await sendRetentionEmail(
      admin,
      {
        userId,
        email: customer.email,
        template,
        plan: customer.plan,
      },
      { approved: true },
    );

    if (sendResult.ok) {
      return {
        ok: true,
        action: 'retention',
        detail: `Retention email sent (${template})`,
      };
    }
  }

  const churnRisk = customer?.score ?? 75;
  await scheduleRetentionEmails(userId, 100 - churnRisk);
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

  const { data: profile } = await admin
    .from('profiles')
    .select('email, plan')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.email) {
    const sendResult = await sendRetentionEmail(
      admin,
      {
        userId,
        email: profile.email as string,
        template: 'upgrade',
        plan: profile.plan as string,
        toPlan,
        mrrGain: typeof mrr === 'number' ? mrr : undefined,
      },
      { approved: true },
    );

    if (sendResult.ok) {
      return { ok: true, action: 'expansion', detail: 'Upgrade email sent' };
    }
  }

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
  followUpId?: string,
): Promise<InboxExecutionResult> {
  const { data: prospect } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', prospectId)
    .maybeSingle();

  if (!prospect?.contact_email) {
    return { ok: false, action: 'follow_up', detail: 'No contact email for follow-up' };
  }

  const issues = Array.isArray(prospect.scan_findings?.issues)
    ? (prospect.scan_findings.issues as string[])
    : undefined;

  const content = generateOutreach('follow_up', {
    businessName: prospect.business_name as string,
    website: prospect.website as string,
    industry: (prospect.industry as string) ?? undefined,
    scanScore: prospect.scan_score as number | undefined,
    issues,
    contactEmail: (prospect.contact_email as string) ?? undefined,
  });

  const { data: draft } = await admin
    .from('owner_outreach_drafts')
    .insert({
      prospect_id: prospectId,
      outreach_type: 'follow_up',
      business_name: prospect.business_name,
      content,
      status: 'draft',
    })
    .select()
    .single();

  if (!draft?.id) {
    return { ok: false, action: 'follow_up', detail: 'Failed to create follow-up draft' };
  }

  const sendResult = await sendApprovedOutreach(admin, draft.id as string, { approved: true });

  if (followUpId) {
    await admin
      .from('owner_follow_ups')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', followUpId);

    await logOutreachEvent(admin, {
      prospect_id: prospectId,
      draft_id: draft.id as string,
      event_type: 'follow_up_sent',
      recipient_email: prospect.contact_email as string,
      detail: 'Follow-up sent after approval',
    });
  }

  return {
    ok: sendResult.ok,
    action: 'follow_up',
    detail: sendResult.ok
      ? `Follow-up sent to ${sendResult.recipient}`
      : sendResult.error ?? 'Follow-up send failed',
  };
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
    const parts = id.replace('followup-', '').split(':');
    const prospectId = parts[0];
    const followUpId = parts[1];
    return approveFollowUp(admin, prospectId, followUpId);
  }

  if (id.startsWith('failed-')) {
    return approveOutreach(admin, id.replace('failed-', ''));
  }

  if (id.startsWith('interested-')) {
    const prospectId = id.replace('interested-', '');
    return approveInterestedLead(admin, prospectId);
  }

  if (id.startsWith('signup-')) {
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: recentSignups } = await admin
      .from('profiles')
      .select('id, email, plan')
      .gte('created_at', dayAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    let sent = 0;
    for (const s of recentSignups ?? []) {
      const email = s.email as string;
      if (!email) continue;
      const result = await sendRetentionEmail(
        admin,
        { userId: s.id as string, email, template: 'onboarding', plan: (s.plan as string) ?? 'free' },
        { approved: true },
      );
      if (result.ok) sent++;
    }

    if (sent > 0) {
      return { ok: true, action: 'onboarding', detail: `Onboarding email sent to ${sent} signup(s)` };
    }

    await queueAutopilotTask(admin, 'Review new signup onboarding path', 0);
    return { ok: true, action: 'signup_review', detail: 'No recent signups to email — task queued' };
  }

  return { ok: true, action: 'acknowledge', detail: 'Acknowledged' };
}

export async function dismissInboxItem(
  admin: SupabaseClient,
  inboxItemId: string,
): Promise<{ ok: boolean }> {
  const { error } = await admin.from('owner_inbox_dismissals').upsert(
    { inbox_item_id: inboxItemId, dismissed_at: new Date().toISOString() },
    { onConflict: 'inbox_item_id' },
  );
  return { ok: !error };
}
