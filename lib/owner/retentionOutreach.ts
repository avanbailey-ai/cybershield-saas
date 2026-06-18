import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { logOutreachEvent } from './outreachEvents';
import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

export type RetentionTemplateType =
  | 'onboarding'
  | 're_engagement'
  | 'upgrade'
  | 'report_summary';

export interface RetentionEmailInput {
  userId: string;
  email: string;
  template: RetentionTemplateType;
  domain?: string;
  plan?: string;
  mrrGain?: number;
  toPlan?: string;
}

function retentionHtml(template: RetentionTemplateType, input: RetentionEmailInput): {
  subject: string;
  html: string;
} {
  const site = resolveSiteUrl();
  const domain = input.domain ?? 'your site';

  const templates: Record<
    RetentionTemplateType,
    { subject: string; title: string; body: string; cta: string; href: string }
  > = {
    onboarding: {
      subject: 'Welcome to CyberShield — your first scan',
      title: 'Get the most from CyberShield',
      body: `Your account is active. Add ${domain} and run your first security scan to establish a baseline score.`,
      cta: 'Open dashboard',
      href: `${site}/dashboard`,
    },
    re_engagement: {
      subject: 'We noticed you have been away',
      title: 'Your security posture may have changed',
      body: `It's been a while since your last activity. New vulnerabilities are discovered daily — verify ${domain} is still protected.`,
      cta: 'Run a fresh scan',
      href: `${site}/dashboard`,
    },
    upgrade: {
      subject: 'You may be ready for more coverage',
      title: 'Upgrade recommendation',
      body: `Based on your usage, ${input.toPlan ?? 'Growth'} would give you more sites and faster alerts${input.mrrGain ? ` (+$${input.mrrGain}/mo)` : ''}.`,
      cta: 'View plans',
      href: `${site}/dashboard/billing`,
    },
    report_summary: {
      subject: `Security summary for ${domain}`,
      title: 'Your monthly security snapshot',
      body: `Here's your latest monitoring summary for ${domain}. Review findings and share with your team.`,
      cta: 'View report',
      href: `${site}/dashboard`,
    },
  };

  const t = templates[template];
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${t.title}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;">${t.body}</p>
      <a href="${t.href}" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">${t.cta} →</a>
    </div>
  </div>
</body></html>`;

  return { subject: t.subject, html };
}

export async function sendRetentionEmail(
  admin: SupabaseClient,
  input: RetentionEmailInput,
  options: { approved?: boolean } = {},
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  if (options.approved !== true) {
    return { ok: false, error: 'Approval required before send' };
  }

  const { subject, html } = retentionHtml(input.template, input);
  const result = await sendEmail({ to: input.email, subject, html });

  if (!result.success) {
    return { ok: false, error: result.error ?? 'Send failed' };
  }

  await logOutreachEvent(admin, {
    event_type: 'retention_sent',
    recipient_email: input.email,
    resend_message_id: result.messageId ?? null,
    subject,
    detail: `Retention: ${input.template}`,
    metadata: { user_id: input.userId, template: input.template },
  });

  await admin.from('email_queue').insert({
    email: input.email,
    template: `retention_${input.template}`,
    type: `retention_${input.template}`,
    scheduled_for: new Date().toISOString(),
    status: 'completed',
    sent: true,
    user_id: input.userId,
    payload: { email: input.email, template: input.template, user_id: input.userId },
  });

  return { ok: true, messageId: result.messageId };
}

export function retentionTemplateForRisk(
  status: 'Critical' | 'At Risk' | 'Healthy',
): RetentionTemplateType {
  if (status === 'Critical') return 're_engagement';
  if (status === 'At Risk') return 're_engagement';
  return 'report_summary';
}
