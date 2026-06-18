import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { isInternalCustomerEmail } from './founderCustomerFilters';
import { getOutreachSettings } from './outreachSettings';
import { scheduleFollowUps } from './followUpScheduler';
import { logOutreachEvent } from './outreachEvents';
import {
  appendAttributionLink,
  buildAttributionSignupUrl,
  getOrCreateAttributionToken,
} from './prospectAttribution';

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const COOLDOWN_DAYS = 30;

export interface SendApprovedOutreachOptions {
  approved?: boolean;
  skipCooldown?: boolean;
}

export interface SendApprovedOutreachResult {
  ok: boolean;
  error?: string;
  messageId?: string;
  recipient?: string;
  subject?: string;
}

function parseDraftContent(content: string, businessName: string): { subject: string; body: string } {
  const trimmed = content.trim();
  const subjectMatch = trimmed.match(/^Subject:\s*(.+?)(?:\n|$)/i);
  if (subjectMatch) {
    const subject = subjectMatch[1].trim();
    const body = trimmed.slice(subjectMatch[0].length).trim();
    return { subject, body };
  }
  return {
    subject: `Security findings for ${businessName}`,
    body: trimmed,
  };
}

function toHtml(body: string): string {
  if (body.includes('<')) return body;
  return `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;line-height:1.5">${body.replace(/</g, '&lt;')}</pre>`;
}

async function isCustomerEmail(admin: SupabaseClient, email: string): Promise<boolean> {
  const lower = email.toLowerCase();
  const { data } = await admin
    .from('profiles')
    .select('email, plan, subscription_status')
    .ilike('email', lower)
    .maybeSingle();

  if (!data?.email) return false;
  if (isInternalCustomerEmail(data.email)) return false;
  return data.subscription_status === 'active' || data.subscription_status === 'trialing';
}

async function withinCooldown(
  admin: SupabaseClient,
  email: string,
  prospectId: string | null,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString();

  const { count: sentCount } = await admin
    .from('owner_outreach_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .eq('recipient_email', email.toLowerCase())
    .gte('sent_at', cutoff);

  if ((sentCount ?? 0) > 0) return true;

  if (prospectId) {
    const { count: eventCount } = await admin
      .from('owner_outreach_events')
      .select('id', { count: 'exact', head: true })
      .eq('prospect_id', prospectId)
      .eq('event_type', 'email_sent')
      .gte('created_at', cutoff);

    if ((eventCount ?? 0) > 0) return true;
  }

  return false;
}

async function dailySendCount(admin: SupabaseClient): Promise<number> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { count } = await admin
    .from('owner_outreach_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', dayStart.toISOString());
  return count ?? 0;
}

export async function sendApprovedOutreach(
  admin: SupabaseClient,
  draftId: string,
  options: SendApprovedOutreachOptions = {},
): Promise<SendApprovedOutreachResult> {
  const settings = await getOutreachSettings(admin);

  if (settings.require_approval && options.approved !== true) {
    return { ok: false, error: 'Approval required before send' };
  }

  if (!settings.enable_outreach_sending) {
    return { ok: false, error: 'Outreach sending is disabled in settings' };
  }

  const { data: draft } = await admin
    .from('owner_outreach_drafts')
    .select('*')
    .eq('id', draftId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!draft) return { ok: false, error: 'Draft not found' };
  if (draft.status === 'sent') return { ok: false, error: 'Already sent' };

  let prospect: Record<string, unknown> | null = null;
  if (draft.prospect_id) {
    const { data } = await admin
      .from('owner_prospects')
      .select('*')
      .eq('id', draft.prospect_id)
      .maybeSingle();
    prospect = data;
  }

  if (prospect) {
    const state = prospect.pipeline_state as string;
    if (state === 'archived' || state === 'ignore_forever') {
      return { ok: false, error: 'Prospect is archived or ignored' };
    }
    if (prospect.scan_status !== 'completed') {
      return { ok: false, error: 'Scan must be completed before outreach' };
    }
  }

  const toEmail = (
    (prospect?.contact_email as string) ??
    (draft.recipient_email as string) ??
    ''
  ).trim().toLowerCase();

  if (!toEmail || !EMAIL_RE.test(toEmail)) {
    return { ok: false, error: 'Valid contact email required' };
  }

  if (isInternalCustomerEmail(toEmail)) {
    return { ok: false, error: 'Cannot send to internal/test email' };
  }

  if (await isCustomerEmail(admin, toEmail)) {
    return { ok: false, error: 'Recipient is an existing customer — not a prospect' };
  }

  if (!options.skipCooldown) {
    const isFollowUp = draft.outreach_type === 'follow_up';
    if (!isFollowUp && (await withinCooldown(admin, toEmail, draft.prospect_id as string | null))) {
      return { ok: false, error: `Cooldown active — already contacted within ${COOLDOWN_DAYS} days` };
    }
  }

  const sentToday = await dailySendCount(admin);
  if (sentToday >= settings.daily_outreach_limit) {
    return { ok: false, error: `Daily outreach limit (${settings.daily_outreach_limit}) reached` };
  }

  const businessName =
    (draft.business_name as string) ?? (prospect?.business_name as string) ?? 'your business';
  let { subject, body } = parseDraftContent(String(draft.content), businessName);

  if (draft.prospect_id && draft.outreach_type !== 'follow_up') {
    try {
      const token = await getOrCreateAttributionToken(admin, {
        prospectId: draft.prospect_id as string,
        draftId: draftId,
      });
      body = appendAttributionLink(body, buildAttributionSignupUrl(token));
    } catch {
      /* attribution optional — still send */
    }
  }

  const html = toHtml(body);

  const result = await sendEmail({ to: toEmail, subject, html });
  const now = new Date().toISOString();

  if (!result.success) {
    await admin
      .from('owner_outreach_drafts')
      .update({
        status: 'failed',
        send_error: result.error ?? 'Send failed',
        recipient_email: toEmail,
        email_subject: subject,
        email_body: body,
        updated_at: now,
      })
      .eq('id', draftId);

    await logOutreachEvent(admin, {
      draft_id: draftId,
      prospect_id: draft.prospect_id as string | null,
      event_type: 'email_failed',
      recipient_email: toEmail,
      subject,
      detail: result.error ?? 'Send failed',
    });

    return { ok: false, error: result.error ?? 'Send failed', recipient: toEmail, subject };
  }

  await admin
    .from('owner_outreach_drafts')
    .update({
      status: 'sent',
      sent_at: now,
      resend_message_id: result.messageId ?? null,
      recipient_email: toEmail,
      email_subject: subject,
      email_body: body,
      send_error: null,
      updated_at: now,
    })
    .eq('id', draftId);

  if (draft.prospect_id) {
    await admin
      .from('owner_prospects')
      .update({
        pipeline_state: 'contacted',
        updated_at: now,
      })
      .eq('id', draft.prospect_id);

    await scheduleFollowUps(admin, {
      prospectId: draft.prospect_id as string,
      draftId,
      scheduleDays: settings.follow_up_schedule,
    });
  }

  await logOutreachEvent(admin, {
    draft_id: draftId,
    prospect_id: draft.prospect_id as string | null,
    event_type: 'email_sent',
    recipient_email: toEmail,
    resend_message_id: result.messageId ?? null,
    subject,
    detail: `Sent to ${toEmail}`,
  });

  await logOutreachEvent(admin, {
    draft_id: draftId,
    prospect_id: draft.prospect_id as string | null,
    event_type: 'email_approved',
    recipient_email: toEmail,
    subject,
    detail: 'Founder approved outreach',
  });

  await admin.from('email_queue').insert({
    email: toEmail,
    template: 'founder_outreach',
    type: 'founder_outreach',
    scheduled_for: now,
    status: 'completed',
    sent: true,
    payload: {
      email: toEmail,
      template: 'founder_outreach',
      draft_id: draftId,
      message_id: result.messageId,
    },
    metadata: { draft_id: draftId, business_name: businessName },
  });

  return {
    ok: true,
    messageId: result.messageId,
    recipient: toEmail,
    subject,
  };
}
