import { sendEmail } from './email';
import { securityAlertEmail } from './emailTemplates';
import { createAdminClient } from './supabase/admin';
import { logEvent } from '@/lib/observability';

const ALERT_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SecurityAlertSendResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
}

export async function sendSecurityAlert(alertId: string): Promise<SecurityAlertSendResult> {
  const supabase = createAdminClient();

  const { data: alert, error: alertErr } = await supabase
    .from('alerts')
    .select('*, websites(url, user_id, last_alert_email_sent_at)')
    .eq('id', alertId)
    .single();

  if (alertErr || !alert) {
    console.warn(`[sendSecurityAlert] Alert not found: alertId=${alertId}`, alertErr?.message);
    return { sent: false, reason: 'alert_not_found' };
  }

  const websiteData = alert.websites as {
    url: string;
    user_id: string;
    last_alert_email_sent_at: string | null;
  } | null;

  if (websiteData?.last_alert_email_sent_at) {
    const msSinceLastEmail = Date.now() - new Date(websiteData.last_alert_email_sent_at).getTime();
    if (msSinceLastEmail < ALERT_EMAIL_COOLDOWN_MS) {
      const hoursRemaining = Math.ceil((ALERT_EMAIL_COOLDOWN_MS - msSinceLastEmail) / 3600000);
      console.log(
        `[sendSecurityAlert] Skipping email for alert=${alertId} website=${alert.website_id} — already sent ${Math.floor(msSinceLastEmail / 3600000)}h ago (cooldown: ${hoursRemaining}h remaining)`,
      );
      return { sent: false, skipped: true, reason: 'cooldown_active' };
    }
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', alert.user_id)
    .single();

  if (profileErr || !profile?.email) {
    console.warn(
      `[sendSecurityAlert] No profile email for user=${alert.user_id} alert=${alertId}`,
      profileErr?.message,
    );
    return { sent: false, reason: 'profile_email_missing' };
  }

  const { data: scan, error: scanErr } = await supabase
    .from('scans')
    .select('id, security_score, risk_level, issues')
    .eq('website_id', alert.website_id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (scanErr || !scan) {
    console.warn(
      `[sendSecurityAlert] No completed scan for website=${alert.website_id} alert=${alertId}`,
      scanErr?.message,
    );
    return { sent: false, reason: 'scan_not_found' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cybershield-saas.vercel.app';
  const reportUrl = `${siteUrl}/report/${scan.id}`;
  const websiteUrl = websiteData?.url ?? '';

  const emailResult = await sendEmail({
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

  if (!emailResult.success) {
    console.error(
      `[sendSecurityAlert] Email send failed for alert=${alertId} website=${alert.website_id} to=${profile.email}: ${emailResult.error ?? 'unknown error'}`,
    );
    void logEvent({
      type: 'alert_email_failed',
      layer: 'api',
      userId: alert.user_id,
      metadata: {
        alertId,
        websiteId: alert.website_id,
        error: emailResult.error,
      },
    });
    return { sent: false, reason: emailResult.error ?? 'send_failed' };
  }

  const { error: cooldownErr } = await supabase
    .from('websites')
    .update({ last_alert_email_sent_at: new Date().toISOString() })
    .eq('id', alert.website_id);

  if (cooldownErr) {
    console.warn(
      `[sendSecurityAlert] Email sent but cooldown update failed for website=${alert.website_id}:`,
      cooldownErr.message,
    );
  }

  console.log(
    `[sendSecurityAlert] Email sent for alert=${alertId} website=${alert.website_id} to=${profile.email} score=${scan.security_score}`,
  );
  void logEvent({
    type: 'alert_email_sent',
    layer: 'api',
    userId: alert.user_id,
    metadata: {
      alertId,
      websiteId: alert.website_id,
      score: scan.security_score,
    },
  });

  return { sent: true };
}
