import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { emitEvent } from './eventBus';

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://cybershield-saas.vercel.app';

function retentionEmailHtml(template: string, domain: string): string {
  const subjects: Record<string, { title: string; body: string; cta: string }> = {
    retention_outdated_security: {
      title: 'Your security posture may be outdated',
      body: `It's been a while since your last scan. New vulnerabilities are discovered daily — ${domain} may have drifted since your last check.`,
      cta: 'Run a fresh scan',
    },
    retention_similar_vulnerabilities: {
      title: 'Sites like yours are being targeted',
      body: `We detected similar vulnerabilities on websites in your industry. Don't wait for an incident — verify ${domain} is still protected.`,
      cta: 'Check my site now',
    },
    retention_new_scan: {
      title: 'Time for a new security scan',
      body: `Continuous monitoring works best when you stay engaged. Run a quick scan on ${domain} to see your current risk score.`,
      cta: 'Scan now — free',
    },
  };

  const content = subjects[template] ?? subjects.retention_new_scan;

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">${content.title}</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;">${content.body}</p>
      <a href="${siteUrl()}/dashboard" style="display:block;margin-top:24px;background:#2563eb;color:#fff;text-decoration:none;padding:14px;border-radius:8px;text-align:center;font-weight:600;">${content.cta} →</a>
    </div>
  </div>
</body></html>`;
}

const RETENTION_TEMPLATES = [
  'retention_outdated_security',
  'retention_similar_vulnerabilities',
  'retention_new_scan',
] as const;

/**
 * Queue retention emails via email_queue (non-blocking).
 * Triggered when churn risk exceeds 60.
 */
export async function scheduleRetentionEmails(
  userId: string,
  churnRisk: number,
): Promise<void> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('email, plan')
    .eq('id', userId)
    .single();

  if (!profile?.email) return;

  const { data: website } = await admin
    .from('websites')
    .select('url')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const domain = website?.url?.replace(/^https?:\/\//, '').split('/')[0] ?? 'your site';

  const { count: recentRetention } = await admin
    .from('email_queue')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .like('template', 'retention_%')
    .gte('scheduled_for', new Date(Date.now() - 7 * 86400000).toISOString());

  if ((recentRetention ?? 0) > 0) return;

  const template =
    churnRisk > 80
      ? RETENTION_TEMPLATES[0]
      : churnRisk > 70
        ? RETENTION_TEMPLATES[1]
        : RETENTION_TEMPLATES[2];

  const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await admin.from('email_queue').insert({
    user_id: userId,
    email: profile.email,
    template,
    scheduled_for: scheduledFor,
    metadata: { domain, churnRisk },
  });
}

export async function processRetentionQueueItem(
  email: string,
  template: string,
  domain: string,
  userId?: string | null,
): Promise<boolean> {
  const result = await sendEmail({
    to: email,
    subject:
      template === 'retention_outdated_security'
        ? 'Your security posture may be outdated'
        : template === 'retention_similar_vulnerabilities'
          ? 'Similar sites are being targeted'
          : 'Time for a new security scan',
    html: retentionEmailHtml(template, domain),
  });

  if (result.success) {
    await emitEvent(
      'retention_email_sent',
      { template, domain },
      userId ?? null,
      null,
      'brain',
    );
    return true;
  }
  return false;
}
