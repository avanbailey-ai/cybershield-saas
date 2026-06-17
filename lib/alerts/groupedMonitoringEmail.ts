import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { groupedMonitoringAlertEmail } from '@/lib/emailTemplates';
import { canAccessFeature } from '@/lib/auth/featureGate';
import { getUserWithPlan } from '@/lib/billing/planService';
import { getActiveOrgId } from '@/lib/org/context';
import {
  getNotificationPreferences,
  shouldSendMonitoringEmail,
} from '@/lib/notifications/preferences';
import { mapAlertTypeToMonitoring } from '@/lib/scanner/diffDetection';
import { logEmailAlert } from '@/lib/alerts/emailAlertLog';
import {
  isBatchUnderAttack,
  shouldQueueAlertEmail,
} from '@/lib/alerts/alertEmailRules';

type PendingAlert = {
  id: string;
  user_id: string;
  website_id: string;
  org_id: string | null;
  scan_id: string | null;
  title: string;
  message: string;
  severity: string;
  type: string | null;
  created_at: string;
  websites: { url: string; alert_email_cooldowns: Record<string, string> | null } | { url: string; alert_email_cooldowns: Record<string, string> | null }[] | null;
};

function websiteFromJoin(
  websites: PendingAlert['websites'],
): { url: string; alert_email_cooldowns: Record<string, string> | null } | null {
  if (!websites) return null;
  if (Array.isArray(websites)) return websites[0] ?? null;
  return websites;
}

function parseCooldownMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

function isTypeCooldownActive(lastSentAt: string | undefined, hours = 24): boolean {
  if (!lastSentAt) return false;
  return Date.now() - new Date(lastSentAt).getTime() < hours * 60 * 60 * 1000;
}

const USER_EMAIL_DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 grouped email per owner per day

/** Sent monitoring emails that count toward the daily owner cap (includes legacy type). */
const OWNER_DAILY_EMAIL_TYPES = [
  'daily_monitoring_digest',
  'immediate_attack_alert',
  'immediate_critical_alert',
] as const;

export async function markAlertPendingEmail(alertId: string, severity: string): Promise<void> {
  if (!shouldQueueAlertEmail(severity)) {
    const supabase = createAdminClient();
    await supabase
      .from('alerts')
      .update({ email_dispatch_status: 'skipped', email_skip_reason: 'severity_dashboard_only' })
      .eq('id', alertId);
    return;
  }

  const supabase = createAdminClient();
  await supabase
    .from('alerts')
    .update({ email_dispatch_status: 'pending' })
    .eq('id', alertId);
}

function groupedSubject(count: number): string {
  if (count === 1) return 'CyberShield alert: 1 website needs attention';
  return `CyberShield alert: ${count} websites need attention`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export interface FlushGroupedAlertsResult {
  attempted: number;
  sent: number;
  skipped: number;
}

export async function flushGroupedMonitoringAlerts(options?: {
  cronRunId?: string;
}): Promise<FlushGroupedAlertsResult> {
  const supabase = createAdminClient();
  const result: FlushGroupedAlertsResult = { attempted: 0, sent: 0, skipped: 0 };

  const { data: pending, error } = await supabase
    .from('alerts')
    .select(
      'id, user_id, website_id, org_id, scan_id, title, message, severity, type, created_at, websites(url, alert_email_cooldowns)',
    )
    .eq('email_dispatch_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(500);

  if (error || !pending?.length) {
    return result;
  }

  const byUser = new Map<string, PendingAlert[]>();
  for (const row of pending) {
    const alert = row as PendingAlert;
    const list = byUser.get(alert.user_id) ?? [];
    list.push(alert);
    byUser.set(alert.user_id, list);
  }

  for (const [userId, alerts] of byUser) {
    result.attempted++;

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile?.email) {
      await markAlertsSkipped(
        supabase,
        alerts.map((a) => a.id),
        'profile_email_missing',
        options?.cronRunId,
        userId,
        '',
      );
      result.skipped++;
      continue;
    }

    const orgId = alerts[0]?.org_id ?? (await getActiveOrgId(userId));
    const userWithPlan = await getUserWithPlan(userId, orgId);
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
      await markAlertsSkipped(
        supabase,
        alerts.map((a) => a.id),
        'plan_gated',
        options?.cronRunId,
        userId,
        profile.email,
      );
      result.skipped++;
      continue;
    }

    const notificationPrefs = await getNotificationPreferences(userId);

    const emailable: PendingAlert[] = [];
    const skippedIds: { id: string; reason: string }[] = [];

    for (const alert of alerts) {
      if (!shouldSendMonitoringEmail(notificationPrefs, alert.severity)) {
        skippedIds.push({ id: alert.id, reason: 'preference_disabled' });
        continue;
      }

      const monitoringType = mapAlertTypeToMonitoring(alert.type ?? 'general');
      const siteRow = websiteFromJoin(alert.websites);
      const cooldowns = parseCooldownMap(siteRow?.alert_email_cooldowns);
      if (isTypeCooldownActive(cooldowns[monitoringType], 24)) {
        skippedIds.push({ id: alert.id, reason: 'cooldown_active' });
        continue;
      }

      emailable.push(alert);
    }

    if (skippedIds.length) {
      for (const s of skippedIds) {
        await supabase
          .from('alerts')
          .update({ email_dispatch_status: 'skipped', email_skip_reason: s.reason })
          .eq('id', s.id);
      }
      await logEmailAlert({
        userId,
        orgId,
        recipient: profile.email,
        emailType: 'immediate_critical_alert',
        subject: '(skipped)',
        websiteIds: [],
        alertIds: skippedIds.map((s) => s.id),
        severitySummary: 'skipped',
        status: 'skipped',
        skipReason: skippedIds.map((s) => s.reason).join(', '),
        cronRunId: options?.cronRunId,
      });
    }

    if (emailable.length === 0) {
      result.skipped++;
      continue;
    }

    const { data: recentGrouped } = await supabase
      .from('email_alert_logs')
      .select('created_at')
      .eq('user_id', userId)
      .in('email_type', [...OWNER_DAILY_EMAIL_TYPES])
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(1);

    const dailyCapActive =
      recentGrouped?.[0]?.created_at &&
      Date.now() - new Date(recentGrouped[0].created_at).getTime() < USER_EMAIL_DAILY_COOLDOWN_MS;

    const underAttack = isBatchUnderAttack(emailable);

    if (dailyCapActive && !underAttack) {
      await markAlertsSkipped(
        supabase,
        emailable.map((a) => a.id),
        'user_daily_email_limit',
        options?.cronRunId,
        userId,
        profile.email,
      );
      result.skipped++;
      continue;
    }

    const isAttackEmail = underAttack && dailyCapActive;
    const emailType = isAttackEmail ? 'immediate_attack_alert' : 'daily_monitoring_digest';
    const emailTypeLabel = isAttackEmail
      ? 'Urgent security alert'
      : 'Daily monitoring digest';
    const reason = isAttackEmail
      ? 'You are receiving this urgent alert because CyberShield detected signs your website(s) may be under attack or have sharply worsened since your daily digest earlier today.'
      : 'You are receiving this once-daily summary because CyberShield monitoring detected critical or high-risk issues on your websites. We limit monitoring emails to one digest per day unless an active attack is detected.';

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cybershield-saas-1o19.vercel.app';
    const dashboardUrl = `${siteUrl}/dashboard/alerts`;

    const items = emailable.map((alert) => {
      const siteRow = websiteFromJoin(alert.websites);
      return {
      domain: extractDomain(siteRow?.url ?? alert.title),
      severity: alert.severity,
      issue: alert.title,
      whyItMatters: alert.message,
      reportUrl: alert.scan_id ? `${siteUrl}/report/${alert.scan_id}` : dashboardUrl,
    };
    });

    const subjectPrefix = isAttackEmail ? 'URGENT: ' : '';
    const subject = `${subjectPrefix}${groupedSubject(items.length)}`;
    const html = groupedMonitoringAlertEmail({
      websiteCount: items.length,
      items,
      dashboardUrl,
      emailTypeLabel,
      reason,
    });

    const emailResult = await sendEmail({ to: profile.email, subject, html });

    if (!emailResult.success) {
      await markAlertsSkipped(
        supabase,
        emailable.map((a) => a.id),
        'send_failed',
        options?.cronRunId,
        userId,
        profile.email,
        emailResult.error,
      );
      result.skipped++;
      continue;
    }

    const sentAt = new Date().toISOString();
    const websiteIds = [...new Set(emailable.map((a) => a.website_id))];
    const alertIds = emailable.map((a) => a.id);

    for (const alert of emailable) {
      const monitoringType = mapAlertTypeToMonitoring(alert.type ?? 'general');
      const siteRow = websiteFromJoin(alert.websites);
      const cooldowns = parseCooldownMap(siteRow?.alert_email_cooldowns);
      cooldowns[monitoringType] = sentAt;

      await supabase
        .from('websites')
        .update({
          alert_email_cooldowns: cooldowns,
          last_alert_email_sent_at: sentAt,
        })
        .eq('id', alert.website_id);
    }

    await supabase
      .from('alerts')
      .update({ email_dispatch_status: 'sent', email_skip_reason: null })
      .in('id', alertIds);

    await logEmailAlert({
      userId,
      orgId,
      recipient: profile.email,
      emailType,
      subject,
      websiteIds,
      alertIds,
      severitySummary: items.map((i) => `${i.domain}:${i.severity}`).join(', '),
      status: 'sent',
      skipReason: isAttackEmail ? 'attack_bypass' : undefined,
      providerMessageId: emailResult.messageId,
      cronRunId: options?.cronRunId,
    });

    result.sent++;
  }

  return result;
}

async function markAlertsSkipped(
  supabase: ReturnType<typeof createAdminClient>,
  alertIds: string[],
  reason: string,
  cronRunId: string | undefined,
  userId: string,
  recipient: string,
  errorMessage?: string,
): Promise<void> {
  if (!alertIds.length) return;
  await supabase
    .from('alerts')
    .update({ email_dispatch_status: 'skipped', email_skip_reason: reason })
    .in('id', alertIds);

  await logEmailAlert({
    userId,
    recipient,
    emailType: 'immediate_critical_alert',
    subject: '(skipped)',
    websiteIds: [],
    alertIds,
    severitySummary: reason,
    status: 'skipped',
    skipReason: reason,
    errorMessage,
    cronRunId,
  });
}
