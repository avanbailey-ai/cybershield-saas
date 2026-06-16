import { createAdminClient } from '@/lib/supabase/admin';

export type NotificationPreferences = {
  vulnerabilityAlerts: boolean;
  weeklyDigest: boolean;
  criticalThreats: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  vulnerabilityAlerts: true,
  weeklyDigest: true,
  criticalThreats: true,
};

type PreferenceRow = {
  notify_vulnerability_alerts?: boolean | null;
  notify_weekly_digest?: boolean | null;
  notify_critical_threats?: boolean | null;
};

export function rowToNotificationPreferences(row: PreferenceRow | null): NotificationPreferences {
  return {
    vulnerabilityAlerts: row?.notify_vulnerability_alerts ?? true,
    weeklyDigest: row?.notify_weekly_digest ?? true,
    criticalThreats: row?.notify_critical_threats ?? true,
  };
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('notify_vulnerability_alerts, notify_weekly_digest, notify_critical_threats')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[notificationPreferences] load failed', error.message);
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return rowToNotificationPreferences(data);
}

export function shouldSendMonitoringEmail(
  prefs: NotificationPreferences,
  severity: string | null | undefined,
): boolean {
  const normalized = (severity ?? 'medium').toLowerCase();
  if (normalized === 'critical') {
    return prefs.criticalThreats;
  }
  return prefs.vulnerabilityAlerts;
}
