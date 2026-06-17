import { createAdminClient } from '@/lib/supabase/admin';

export interface AccountEmailPreferences {
  accountId: string;
  criticalAlertsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  monthlyReportEnabled: boolean;
  allClearEnabled: boolean;
  maxAlertEmailsPerDay: number;
  preferredDigestDay: number | null;
  timezone: string | null;
}

const DEFAULTS: Omit<AccountEmailPreferences, 'accountId'> = {
  criticalAlertsEnabled: true,
  weeklyDigestEnabled: true,
  monthlyReportEnabled: true,
  allClearEnabled: false,
  maxAlertEmailsPerDay: 3,
  preferredDigestDay: null,
  timezone: null,
};

export function resolveAccountId(userId: string, orgId: string | null): string {
  return orgId ?? userId;
}

export async function getAccountEmailPreferences(accountId: string): Promise<AccountEmailPreferences> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('account_email_preferences')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!data) {
    return { accountId, ...DEFAULTS };
  }

  return {
    accountId,
    criticalAlertsEnabled: data.critical_alerts_enabled ?? true,
    weeklyDigestEnabled: data.weekly_digest_enabled ?? true,
    monthlyReportEnabled: data.monthly_report_enabled ?? true,
    allClearEnabled: data.all_clear_enabled ?? false,
    maxAlertEmailsPerDay: data.max_alert_emails_per_day ?? 3,
    preferredDigestDay: data.preferred_digest_day ?? null,
    timezone: data.timezone ?? null,
  };
}

export async function countAccountEmailsSentToday(accountId: string): Promise<number> {
  const supabase = createAdminClient();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('email_alert_logs')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('status', 'sent')
    .in('email_type', ['critical_alert', 'immediate_attack_alert', 'daily_monitoring_digest'])
    .gte('created_at', dayStart.toISOString());

  return count ?? 0;
}
