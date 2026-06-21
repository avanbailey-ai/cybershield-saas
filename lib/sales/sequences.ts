import { sendEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';

import { resolveSiteUrl } from '@/lib/site/getSiteUrl';

const siteUrl = () => resolveSiteUrl();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SEQUENCE_STEPS = [
  { step: 1, days: 1, template: 'enterprise_risk_reminder' },
  { step: 3, days: 3, template: 'enterprise_case_study' },
  { step: 7, days: 7, template: 'enterprise_monitoring_cta' },
] as const;

export type EnterpriseEmailTemplate = (typeof SEQUENCE_STEPS)[number]['template'];

function riskReminderHtml(name: string, domain?: string | null): string {
  const target = domain ? escapeHtml(domain) : 'your web assets';
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Enterprise Security Risk Reminder</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;">Hi ${escapeHtml(name)},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;">Thanks for reaching out about securing ${target}. Enterprise teams face evolving threats — misconfigurations, missing headers, and compliance gaps compound quickly at scale.</p>
      <p style="color:#374151;font-size:14px;">CyberShield provides scheduled monitoring with scan history and multi-tenant org controls for security teams.</p>
      <a href="${siteUrl()}/enterprise/pricing" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">View Enterprise Plans →</a>
    </div>
  </div>
</body></html>`;
}

function caseStudyHtml(name: string): string {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">How teams use continuous monitoring</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;">Hi ${escapeHtml(name)},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;">Illustrative example: a SaaS team uses scheduled header and SSL checks plus change alerts to prioritize fixes across many domains.</p>
      <p style="color:#374151;font-size:14px;">Key capabilities: automated header checks, weekly digests, and scan history exports.</p>
      <a href="${siteUrl()}/enterprise/case-studies" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">Read Case Studies →</a>
    </div>
  </div>
</body></html>`;
}

function monitoringCtaHtml(name: string): string {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#2563eb;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Continuous Monitoring for Your Stack</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;">Hi ${escapeHtml(name)},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;">One-time scans show today's posture — continuous monitoring helps you notice configuration drift over time. CyberShield sends email alerts when supported changes or issues are detected.</p>
      <p style="color:#6b7280;font-size:13px;">This is an automated follow-up. No phone call is required or scheduled.</p>
      <a href="${siteUrl()}/enterprise/pricing?focus=continuousMonitoring" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">View Continuous Monitoring →</a>
    </div>
  </div>
</body></html>`;
}

export async function scheduleEnterpriseEmailSequences(
  leadId: string,
  email: string,
  name: string,
  domain?: string | null,
): Promise<void> {
  const supabase = createAdminClient();
  const now = Date.now();

  const rows = SEQUENCE_STEPS.map(({ step, days, template }) => ({
    lead_id: leadId,
    sequence_step: step,
    scheduled_for: new Date(now + days * 24 * 60 * 60 * 1000).toISOString(),
    sent: false,
    template,
  }));

  await supabase.from('enterprise_email_sequences').insert(rows);
  console.log(`[sales/sequences] Scheduled ${rows.length} emails for lead ${leadId} (${email}, ${name}, ${domain ?? 'no domain'})`);
}

async function sendSequenceEmail(
  template: string,
  email: string,
  name: string,
  leadId: string,
  domain?: string | null,
): Promise<boolean> {
  let subject: string;
  let html: string;

  switch (template) {
    case 'enterprise_risk_reminder':
      subject = 'Enterprise security risk reminder — CyberShield';
      html = riskReminderHtml(name, domain);
      break;
    case 'enterprise_case_study':
      subject = 'Case study: 62% risk reduction in 90 days';
      html = caseStudyHtml(name);
      break;
    case 'enterprise_monitoring_cta':
      subject = 'Upgrade to continuous monitoring — CyberShield';
      html = monitoringCtaHtml(name);
      break;
    default:
      return false;
  }

  const result = await sendEmail({ to: email, subject, html });
  return result.success;
}

export async function processEnterpriseEmailSequences(): Promise<{ processed: number; sent: number }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: dueItems } = await supabase
    .from('enterprise_email_sequences')
    .select('id, lead_id, template')
    .eq('sent', false)
    .lte('scheduled_for', now)
    .limit(50);

  if (!dueItems?.length) {
    return { processed: 0, sent: 0 };
  }

  let sent = 0;

  for (const item of dueItems) {
    const { data: lead } = await supabase
      .from('enterprise_leads')
      .select('name, email, domain')
      .eq('id', item.lead_id)
      .single();

    if (!lead?.email) continue;

    const success = await sendSequenceEmail(
      item.template,
      lead.email,
      lead.name ?? 'there',
      item.lead_id,
      lead.domain,
    );

    if (success) {
      await supabase.from('enterprise_email_sequences').update({ sent: true }).eq('id', item.id);
      sent++;
    }
  }

  return { processed: dueItems.length, sent };
}
