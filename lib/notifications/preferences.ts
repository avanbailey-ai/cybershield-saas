import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/org/context';
import {
  getAccountEmailPreferences,
  resolveAccountId,
  type AccountEmailPreferences,
} from '@/lib/alerts/accountEmailPreferences';

export type NotificationPreferences = {
  criticalAlerts: boolean;
  weeklyDigest: boolean;
  monthlyReport: boolean;
  allClearUpdates: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  criticalAlerts: true,
  weeklyDigest: true,
  monthlyReport: true,
  allClearUpdates: false,
};

/** @deprecated Legacy shape — use NotificationPreferences */
export type LegacyNotificationPreferences = {
  vulnerabilityAlerts: boolean;
  weeklyDigest: boolean;
  criticalThreats: boolean;
};

function accountPrefsToNotification(prefs: AccountEmailPreferences): NotificationPreferences {
  return {
    criticalAlerts: prefs.criticalAlertsEnabled,
    weeklyDigest: prefs.weeklyDigestEnabled,
    monthlyReport: prefs.monthlyReportEnabled,
    allClearUpdates: prefs.allClearEnabled,
  };
}

type ProfileRow = {
  notify_vulnerability_alerts?: boolean | null;
  notify_weekly_digest?: boolean | null;
  notify_critical_threats?: boolean | null;
};

function profileFallbackToNotification(row: ProfileRow | null): NotificationPreferences {
  return {
    criticalAlerts: row?.notify_critical_threats ?? row?.notify_vulnerability_alerts ?? true,
    weeklyDigest: row?.notify_weekly_digest ?? true,
    monthlyReport: true,
    allClearUpdates: false,
  };
}

export async function getNotificationPreferences(
  userId: string,
  orgId?: string | null,
): Promise<NotificationPreferences> {
  const resolvedOrgId = orgId ?? (await getActiveOrgId(userId));
  const accountId = resolveAccountId(userId, resolvedOrgId);
  const accountPrefs = await getAccountEmailPreferences(accountId);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('account_email_preferences')
    .select('account_id')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!error && data) {
    return accountPrefsToNotification(accountPrefs);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('notify_vulnerability_alerts, notify_weekly_digest, notify_critical_threats')
    .eq('id', userId)
    .maybeSingle();

  return profileFallbackToNotification(profile);
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>,
  orgId?: string | null,
): Promise<NotificationPreferences> {
  const resolvedOrgId = orgId ?? (await getActiveOrgId(userId));
  const accountId = resolveAccountId(userId, resolvedOrgId);
  const current = await getNotificationPreferences(userId, resolvedOrgId);
  const next: NotificationPreferences = { ...current, ...patch };

  const supabase = createAdminClient();
  const row = {
    account_id: accountId,
    critical_alerts_enabled: next.criticalAlerts,
    weekly_digest_enabled: next.weeklyDigest,
    monthly_report_enabled: next.monthlyReport,
    all_clear_enabled: next.allClearUpdates,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('account_email_preferences').upsert(row, {
    onConflict: 'account_id',
  });

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from('profiles')
    .update({
      notify_critical_threats: next.criticalAlerts,
      notify_vulnerability_alerts: next.criticalAlerts,
      notify_weekly_digest: next.weeklyDigest,
    })
    .eq('id', userId);

  return next;
}

export function shouldSendMonitoringEmail(
  prefs: NotificationPreferences | LegacyNotificationPreferences,
  severity: string | null | undefined,
): boolean {
  const normalized = (severity ?? 'medium').toLowerCase();
  if ('criticalAlerts' in prefs) {
    return normalized === 'critical' ? prefs.criticalAlerts : prefs.criticalAlerts;
  }
  const legacy = prefs as LegacyNotificationPreferences;
  if (normalized === 'critical') {
    return legacy.criticalThreats;
  }
  return legacy.vulnerabilityAlerts;
}
