import { sendEmail } from './email';
import { securityAlertEmail } from './emailTemplates';
import { createAdminClient } from './supabase/admin';

const ALERT_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function sendSecurityAlert(alertId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: alert } = await supabase
    .from('alerts')
    .select('*, websites(url, user_id, last_alert_email_sent_at)')
    .eq('id', alertId)
    .single();

  if (!alert) return;

  // 24-hour deduplication: skip if we already sent an alert email for this website recently
  const websiteData = alert.websites as { url: string; user_id: string; last_alert_email_sent_at: string | null } | null;
  if (websiteData?.last_alert_email_sent_at) {
    const msSinceLastEmail = Date.now() - new Date(websiteData.last_alert_email_sent_at).getTime();
    if (msSinceLastEmail < ALERT_EMAIL_COOLDOWN_MS) {
      const hoursRemaining = Math.ceil((ALERT_EMAIL_COOLDOWN_MS - msSinceLastEmail) / 3600000);
      console.log(
        `[sendSecurityAlert] Skipping email for alert=${alertId} website=${alert.website_id} — already sent ${Math.floor(msSinceLastEmail / 3600000)}h ago (cooldown: ${hoursRemaining}h remaining)`,
      );
      return;
    }
  }

  // Get the user's email via a separate profiles query (safer than join)
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', alert.user_id)
    .single();

  if (!profile?.email) return;

  const { data: scan } = await supabase
    .from('scans')
    .select('id, security_score, risk_level, issues')
    .eq('website_id', alert.website_id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (!scan) return;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://cybershield-saas.vercel.app';
  const reportUrl = `${siteUrl}/report/${scan.id}`;

  const websiteUrl = websiteData?.url ?? '';

  await sendEmail({
    to: profile.email,
    subject: `Security Alert: ${websiteUrl} needs attention`,
    html: securityAlertEmail({
      userEmail: profile.email,
      websiteUrl,
      score: scan.security_score ?? 0,
      riskLevel: scan.risk_level ?? 'unknown',
      issues: (Array.isArray(scan.issues) ? (scan.issues as string[]) : []).slice(0, 5),
      reportUrl,
    }),
  });

  // Update the website's last_alert_email_sent_at to enforce the 24h cooldown
  await supabase
    .from('websites')
    .update({ last_alert_email_sent_at: new Date().toISOString() })
    .eq('id', alert.website_id);

  console.log(`[sendSecurityAlert] Email sent for alert=${alertId} website=${alert.website_id} to ${profile.email}`);
}
