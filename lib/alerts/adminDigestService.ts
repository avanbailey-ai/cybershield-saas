import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { isOwner } from '@/lib/auth/owner';
import { checkEmailBudget } from './emailBudget';
import { logEmailAlert } from './emailAlertLog';

export async function sendAdminDigest(ownerEmail: string): Promise<boolean> {
  const supabase = createAdminClient();
  if (!isOwner(ownerEmail)) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', ownerEmail)
    .maybeSingle();

  const ownerUserId = profile?.id ?? ownerEmail;

  const budget = await checkEmailBudget('admin_digest');
  if (!budget.allowed) {
    await logEmailAlert({
      userId: ownerUserId,
      recipient: ownerEmail,
      emailType: 'admin_digest',
      subject: '(skipped)',
      status: 'skipped',
      skipReason: budget.reason,
    });
    return false;
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count: sentToday } = await supabase
    .from('email_alert_logs')
    .select('id', { count: 'exact', head: true })
    .eq('email_type', 'admin_digest')
    .eq('status', 'sent')
    .gte('created_at', dayStart.toISOString());

  if ((sentToday ?? 0) > 0) return false;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [failedEmails, cronErrors, openLeads] = await Promise.all([
    supabase
      .from('email_alert_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', since24h),
    supabase
      .from('cron_monitoring_runs')
      .select('id', { count: 'exact', head: true })
      .gt('websites_errors', 0)
      .gte('started_at', since24h),
    supabase.from('enterprise_leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ]);

  const subject = 'CyberShield admin digest';
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px;">
    <h2>Admin digest (24h)</h2>
    <ul>
      <li>Failed emails: ${failedEmails.count ?? 0}</li>
      <li>Cron runs with errors: ${cronErrors.count ?? 0}</li>
      <li>New enterprise leads: ${openLeads.count ?? 0}</li>
    </ul>
    <p style="color:#666;font-size:12px;">One grouped admin summary per day.</p>
  </body></html>`;

  const result = await sendEmail({ to: ownerEmail, subject, html });
  if (!result.success) return false;

  await logEmailAlert({
    userId: ownerUserId,
    recipient: ownerEmail,
    emailType: 'admin_digest',
    subject,
    status: 'sent',
    providerMessageId: result.messageId,
    sentAt: new Date().toISOString(),
  });

  return true;
}
