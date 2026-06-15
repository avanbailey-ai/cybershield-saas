import { sendEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';
import { processRetentionQueueItem } from '@/lib/brain/retention';

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://cybershield-saas.vercel.app';

async function logEmailEvent(params: {
  userId?: string | null;
  email: string;
  eventType: string;
  template: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('email_events').insert({
    user_id: params.userId ?? null,
    email: params.email,
    event_type: params.eventType,
    template: params.template,
    metadata: params.metadata ?? {},
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstScanEmailHtml(domain: string, score: number, reportSummary: string): string {
  const scoreColor = score >= 70 ? '#16a34a' : score >= 40 ? '#ca8a04' : '#dc2626';
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <p style="color:#94a3b8;margin:0;font-size:12px;text-transform:uppercase;">CyberShield</p>
      <h1 style="color:#fff;margin:8px 0 0;font-size:22px;">Your Security Scan Results</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;">We scanned <strong>${escapeHtml(domain)}</strong> and here is what we found:</p>
      <div style="text-align:center;background:#f8fafc;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0;font-size:48px;font-weight:800;color:${scoreColor};">${score}<span style="font-size:20px;color:#94a3b8;">/100</span></p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(reportSummary)}</p>
      <a href="${siteUrl()}/scan-result?domain=${encodeURIComponent(domain)}&score=${score}" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">View Full Results →</a>
    </div>
  </div>
</body></html>`;
}

function followUpEmailHtml(domain: string, score: number): string {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Still thinking about ${escapeHtml(domain)}?</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;">Yesterday you scanned <strong>${escapeHtml(domain)}</strong> (score: ${score}/100). Security issues don't fix themselves — enable continuous monitoring to catch new vulnerabilities before attackers do.</p>
      <a href="${siteUrl()}/pricing" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">Start Monitoring →</a>
    </div>
  </div>
</body></html>`;
}

function highRiskEmailHtml(domain: string, score: number): string {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#dc2626;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">⚠ High Risk Detected</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;"><strong>${escapeHtml(domain)}</strong> scored <strong>${score}/100</strong> — this indicates critical security gaps that need immediate attention.</p>
      <p style="color:#374151;font-size:14px;">Unencrypted traffic, missing security headers, and misconfigurations leave your site vulnerable to attacks.</p>
      <a href="${siteUrl()}/pricing" style="display:block;margin-top:24px;background:#dc2626;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">Protect Your Site Now →</a>
    </div>
  </div>
</body></html>`;
}

export async function sendFirstScanEmail(
  email: string,
  domain: string,
  score: number,
  reportSummary: string,
  userId?: string | null,
): Promise<void> {
  const result = await sendEmail({
    to: email,
    subject: `Your CyberShield scan results for ${domain}`,
    html: firstScanEmailHtml(domain, score, reportSummary),
  });

  if (result.success) {
    await logEmailEvent({
      userId,
      email,
      eventType: 'sent',
      template: 'first_scan',
      metadata: { domain, score },
    });
  }
}

export async function scheduleFollowUpEmail(
  userId: string | null,
  email: string,
  domain: string,
  score: number,
): Promise<void> {
  const supabase = createAdminClient();
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('email_queue').insert({
    user_id: userId,
    email,
    template: 'follow_up_24h',
    scheduled_for: scheduledFor,
    metadata: { domain, score },
  });

  console.log(`[funnel] Follow-up queued for ${email} at ${scheduledFor}`);
}

export async function sendHighRiskEmail(
  email: string,
  domain: string,
  score: number,
  userId?: string | null,
): Promise<void> {
  const result = await sendEmail({
    to: email,
    subject: `⚠ High risk detected on ${domain} — action required`,
    html: highRiskEmailHtml(domain, score),
  });

  if (result.success) {
    await logEmailEvent({
      userId,
      email,
      eventType: 'sent',
      template: 'high_risk',
      metadata: { domain, score },
    });
  }
}

export async function sendQueuedFollowUp(
  email: string,
  domain: string,
  score: number,
  userId?: string | null,
): Promise<boolean> {
  const result = await sendEmail({
    to: email,
    subject: `Follow-up: ${domain} security scan`,
    html: followUpEmailHtml(domain, score),
  });

  if (result.success) {
    await logEmailEvent({
      userId,
      email,
      eventType: 'sent',
      template: 'follow_up_24h',
      metadata: { domain, score },
    });
    return true;
  }
  return false;
}

export async function triggerScanEmailFunnel(params: {
  userId: string;
  email: string;
  domain: string;
  score: number;
  reportSummary: string;
}): Promise<void> {
  const { userId, email, domain, score, reportSummary } = params;
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  const isFirstScan = (count ?? 0) <= 1;

  if (isFirstScan) {
    await sendFirstScanEmail(email, domain, score, reportSummary, userId);
    await scheduleFollowUpEmail(userId, email, domain, score);
  }

  if (score < 40) {
    await sendHighRiskEmail(email, domain, score, userId);
  }
}

export async function triggerPublicScanEmails(params: {
  email: string;
  domain: string;
  score: number;
  reportSummary: string;
}): Promise<void> {
  const { email, domain, score, reportSummary } = params;

  await sendFirstScanEmail(email, domain, score, reportSummary, null);
  await scheduleFollowUpEmail(null, email, domain, score);

  if (score < 40) {
    await sendHighRiskEmail(email, domain, score, null);
  }
}

export async function processEmailQueue(): Promise<{ processed: number; sent: number }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: dueItems } = await supabase
    .from('email_queue')
    .select('id, user_id, email, template, metadata')
    .eq('sent', false)
    .lte('scheduled_for', now)
    .limit(50);

  if (!dueItems || dueItems.length === 0) {
    return { processed: 0, sent: 0 };
  }

  let sent = 0;

  for (const item of dueItems) {
    const meta = (item.metadata ?? {}) as { domain?: string; score?: number };
    const domain = meta.domain ?? 'your site';
    const score = meta.score ?? 0;

    let success = false;

    if (item.template === 'follow_up_24h') {
      success = await sendQueuedFollowUp(item.email, domain, score, item.user_id);
    } else if (item.template.startsWith('retention_')) {
      success = await processRetentionQueueItem(
        item.email,
        item.template,
        domain,
        item.user_id,
      );
    }

    if (success) {
      await supabase.from('email_queue').update({ sent: true }).eq('id', item.id);
      sent++;
    }
  }

  return { processed: dueItems.length, sent };
}
