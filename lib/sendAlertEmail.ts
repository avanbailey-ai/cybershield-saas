import { sendEmail } from './email';
import { monitoringAlertEmail } from './emailTemplates';
import { createAdminClient } from './supabase/admin';
import { logEvent } from '@/lib/observability';
import { canAccessFeature } from '@/lib/auth/featureGate';
import { getUserWithPlan } from '@/lib/billing/planService';
import { getActiveOrgId } from '@/lib/org/context';
import {
  getNotificationPreferences,
  shouldSendMonitoringEmail,
} from '@/lib/notifications/preferences';
import {
  getRecommendedFixForAlertType,
  mapAlertTypeToMonitoring,
  type MonitoringAlertType,
  type MonitoringChangeDetail,
} from './scanner/diffDetection';

const ALERT_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export type { MonitoringAlertType, MonitoringChangeDetail };

export interface MonitoringAlertSendOptions {
  changeDetails?: MonitoringChangeDetail[];
  previousScore?: number;
  currentScore?: number;
}

export interface SecurityAlertSendResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
}

type WebsiteCooldownRow = {
  url: string;
  user_id: string;
  last_alert_email_sent_at: string | null;
  alert_email_cooldowns: Record<string, string> | null;
};

function parseCooldownMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

function isCooldownActive(lastSentAt: string | undefined): boolean {
  if (!lastSentAt) return false;
  return Date.now() - new Date(lastSentAt).getTime() < ALERT_EMAIL_COOLDOWN_MS;
}

function monitoringSubject(alertType: MonitoringAlertType, websiteUrl: string): string {
  switch (alertType) {
    case 'security_score_drop':
      return `Security score dropped on ${websiteUrl}`;
    case 'ssl_changed':
      return `SSL/HTTPS change detected on ${websiteUrl}`;
    case 'header_removed':
      return `Security header removed on ${websiteUrl}`;
    case 'new_script_detected':
      return `New script detected on ${websiteUrl}`;
    case 'change_detected':
      return `Website change detected on ${websiteUrl}`;
    default:
      return `Security monitoring alert for ${websiteUrl}`;
  }
}

async function loadScanChangeDetails(
  scanId: string,
): Promise<MonitoringChangeDetail[]> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from('scan_changes')
    .select('type, severity, description')
    .eq('scan_id', scanId)
    .order('detected_at', { ascending: true });

  if (!rows || rows.length === 0) return [];

  return rows.map((row) => ({
    label: String(row.type).replace(/_/g, ' '),
    severity: row.severity as MonitoringChangeDetail['severity'],
    summary: row.description,
    before: '—',
    after: row.description,
  }));
}

export async function sendMonitoringAlert(
  alertId: string,
  options: MonitoringAlertSendOptions = {},
): Promise<SecurityAlertSendResult> {
  const supabase = createAdminClient();

  const { data: alert, error: alertErr } = await supabase
    .from('alerts')
    .select('*, websites(url, user_id, last_alert_email_sent_at, alert_email_cooldowns)')
    .eq('id', alertId)
    .single();

  if (alertErr || !alert) {
    console.warn(`[sendMonitoringAlert] Alert not found: alertId=${alertId}`, alertErr?.message);
    return { sent: false, reason: 'alert_not_found' };
  }

  const websiteData = alert.websites as WebsiteCooldownRow | null;
  const monitoringType = mapAlertTypeToMonitoring(alert.type ?? 'general');
  const cooldowns = parseCooldownMap(websiteData?.alert_email_cooldowns);

  if (isCooldownActive(cooldowns[monitoringType])) {
    const msSinceLastEmail = Date.now() - new Date(cooldowns[monitoringType]).getTime();
    const hoursRemaining = Math.ceil((ALERT_EMAIL_COOLDOWN_MS - msSinceLastEmail) / 3600000);
    console.log(
      `[sendMonitoringAlert] Skipping email for alert=${alertId} website=${alert.website_id} type=${monitoringType} — cooldown: ${hoursRemaining}h remaining`,
    );
    return { sent: false, skipped: true, reason: 'cooldown_active' };
  }

  // Legacy global cooldown fallback when per-type map is empty
  if (
    Object.keys(cooldowns).length === 0 &&
    websiteData?.last_alert_email_sent_at &&
    isCooldownActive(websiteData.last_alert_email_sent_at)
  ) {
    const msSinceLastEmail = Date.now() - new Date(websiteData.last_alert_email_sent_at).getTime();
    const hoursRemaining = Math.ceil((ALERT_EMAIL_COOLDOWN_MS - msSinceLastEmail) / 3600000);
    console.log(
      `[sendMonitoringAlert] Skipping email for alert=${alertId} website=${alert.website_id} — legacy cooldown: ${hoursRemaining}h remaining`,
    );
    return { sent: false, skipped: true, reason: 'cooldown_active' };
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', alert.user_id)
    .single();

  if (profileErr || !profile?.email) {
    console.warn(
      `[sendMonitoringAlert] No profile email for user=${alert.user_id} alert=${alertId}`,
      profileErr?.message,
    );
    return { sent: false, reason: 'profile_email_missing' };
  }

  const orgId = await getActiveOrgId(alert.user_id);
  const userWithPlan = await getUserWithPlan(alert.user_id, orgId);
  if (
    !canAccessFeature(
      {
        email: profile.email,
        plan: userWithPlan.plan,
        subscription_status: userWithPlan.subscription_status,
      },
      'alerts',
    )
  ) {
    console.log(
      `[sendMonitoringAlert] Skipping email for alert=${alertId} — plan ${userWithPlan.plan} does not include email alerts`,
    );
    return { sent: false, skipped: true, reason: 'plan_gated' };
  }

  const notificationPrefs = await getNotificationPreferences(alert.user_id);
  if (!shouldSendMonitoringEmail(notificationPrefs, alert.severity)) {
    console.log(
      `[sendMonitoringAlert] Skipping email for alert=${alertId} — user notification preference disabled`,
    );
    return { sent: false, skipped: true, reason: 'preference_disabled' };
  }

  const scanQuery = alert.scan_id
    ? supabase
        .from('scans')
        .select('id, security_score, risk_level, issues')
        .eq('id', alert.scan_id)
        .single()
    : supabase
        .from('scans')
        .select('id, security_score, risk_level, issues')
        .eq('website_id', alert.website_id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

  const { data: scan, error: scanErr } = await scanQuery;

  if (scanErr || !scan) {
    console.warn(
      `[sendMonitoringAlert] No scan for website=${alert.website_id} alert=${alertId}`,
      scanErr?.message,
    );
    return { sent: false, reason: 'scan_not_found' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cybershield-saas.vercel.app';
  const reportUrl = `${siteUrl}/report/${scan.id}`;
  const websiteUrl = websiteData?.url ?? '';

  const changeDetails =
    options.changeDetails ??
    (alert.scan_id ? await loadScanChangeDetails(alert.scan_id) : []);

  const currentScore = options.currentScore ?? scan.security_score ?? undefined;
  const previousScore = options.previousScore;

  const recommendedFix = getRecommendedFixForAlertType(monitoringType);
  const headline = `We detected a ${monitoringType.replace(/_/g, ' ')} on ${websiteUrl}.`;

  const emailResult = await sendEmail({
    to: profile.email,
    subject: monitoringSubject(monitoringType, websiteUrl),
    html: monitoringAlertEmail({
      websiteUrl,
      alertType: monitoringType,
      severity: alert.severity ?? 'medium',
      headline,
      summary: alert.message,
      changes: changeDetails,
      recommendedFix,
      reportUrl,
      previousScore,
      currentScore,
    }),
  });

  if (!emailResult.success) {
    console.error(
      `[sendMonitoringAlert] Email send failed for alert=${alertId} website=${alert.website_id} type=${monitoringType} to=${profile.email}: ${emailResult.error ?? 'unknown error'}`,
    );
    void logEvent({
      type: 'alert_email_failed',
      layer: 'api',
      userId: alert.user_id,
      metadata: {
        alertId,
        websiteId: alert.website_id,
        alertType: monitoringType,
        error: emailResult.error,
      },
    });
    return { sent: false, reason: emailResult.error ?? 'send_failed' };
  }

  const sentAt = new Date().toISOString();
  const updatedCooldowns = { ...cooldowns, [monitoringType]: sentAt };

  const { error: cooldownErr } = await supabase
    .from('websites')
    .update({
      alert_email_cooldowns: updatedCooldowns,
      last_alert_email_sent_at: sentAt,
    })
    .eq('id', alert.website_id);

  if (cooldownErr) {
    console.warn(
      `[sendMonitoringAlert] Email sent but cooldown update failed for website=${alert.website_id}:`,
      cooldownErr.message,
    );
  }

  console.log(
    `[sendMonitoringAlert] Email sent for alert=${alertId} website=${alert.website_id} type=${monitoringType} to=${profile.email}`,
  );
  void logEvent({
    type: 'alert_email_sent',
    layer: 'api',
    userId: alert.user_id,
    metadata: {
      alertId,
      websiteId: alert.website_id,
      alertType: monitoringType,
      score: scan.security_score,
    },
  });

  return { sent: true };
}

/** Backward-compatible wrapper — routes all alert emails through sendMonitoringAlert. */
export async function sendSecurityAlert(alertId: string): Promise<SecurityAlertSendResult> {
  return sendMonitoringAlert(alertId);
}
