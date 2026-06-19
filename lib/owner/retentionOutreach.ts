import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { buildEmailDocument } from '@/lib/email/template';
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

function retentionContent(
  template: RetentionTemplateType,
  input: RetentionEmailInput,
): { subject: string; title: string; bodyHtml: string; bodyText: string; cta: string; href: string; category: 'onboarding' | 'retention' | 'upgrade' | 'report' } {
  const site = resolveSiteUrl();
  const domain = input.domain ?? 'your site';

  const map = {
    onboarding: {
      subject: 'Welcome to CyberShield — set up your first scan',
      title: 'Get started with CyberShield Cloud',
      body: `Your account is ready. Add ${domain} and run your first security scan to establish a baseline score and enable monitoring alerts.`,
      cta: 'Open dashboard',
      href: `${site}/dashboard`,
      category: 'onboarding' as const,
    },
    re_engagement: {
      subject: 'Your site security may have changed',
      title: 'Time for a fresh security check',
      body: `We have not seen recent activity on your account. SSL certificates, headers, and vulnerabilities change — verify ${domain} is still protected.`,
      cta: 'Run a fresh scan',
      href: `${site}/dashboard`,
      category: 'retention' as const,
    },
    upgrade: {
      subject: 'More coverage for your growing footprint',
      title: 'Upgrade recommendation',
      body: `Based on your usage, ${input.toPlan ?? 'Growth'} adds more monitored sites and faster alerts${input.mrrGain ? ` (+$${input.mrrGain}/mo)` : ''}.`,
      cta: 'View plans',
      href: `${site}/dashboard/billing`,
      category: 'upgrade' as const,
    },
    report_summary: {
      subject: `Security summary for ${domain}`,
      title: 'Your monitoring summary',
      body: `Your latest security snapshot for ${domain} is ready. Review findings and share with your team.`,
      cta: 'View dashboard',
      href: `${site}/dashboard`,
      category: 'report' as const,
    },
  };

  const t = map[template];
  return {
    subject: t.subject,
    title: t.title,
    bodyHtml: `<p style="margin:0;">${t.body}</p>`,
    bodyText: t.body,
    cta: t.cta,
    href: t.href,
    category: t.category,
  };
}

export async function sendRetentionEmail(
  admin: SupabaseClient,
  input: RetentionEmailInput,
  options: { approved?: boolean } = {},
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  if (options.approved !== true) {
    return { ok: false, error: 'Approval required before send' };
  }

  const content = retentionContent(input.template, input);
  const doc = buildEmailDocument({
    title: content.title,
    bodyHtml: content.bodyHtml,
    bodyText: content.bodyText,
    category: content.category,
    reason:
      input.template === 'onboarding'
        ? 'You created a CyberShield Cloud account.'
        : 'You are an active CyberShield Cloud customer.',
    ctaLabel: content.cta,
    ctaHref: content.href,
    includeUnsubscribe: input.template !== 'onboarding',
  });

  const result = await sendEmail({
    to: input.email,
    subject: content.subject,
    html: doc.html,
    text: doc.text,
    category: content.category,
    template: input.template,
    userId: input.userId,
    trackOpens: true,
    trackClicks: true,
  });

  if (!result.success) {
    return { ok: false, error: result.error ?? 'Send failed' };
  }

  await logOutreachEvent(admin, {
    event_type: 'retention_sent',
    recipient_email: input.email,
    resend_message_id: result.messageId ?? null,
    subject: content.subject,
    detail: `Retention: ${input.template}`,
    metadata: { user_id: input.userId, template: input.template, delivery_id: result.deliveryId },
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
