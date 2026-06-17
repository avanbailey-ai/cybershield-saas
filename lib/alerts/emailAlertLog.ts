import { createAdminClient } from '@/lib/supabase/admin';

export interface EmailAlertLogInput {
  accountId?: string;
  userId: string;
  orgId?: string | null;
  recipient: string;
  emailType: string;
  subject: string;
  websiteIds?: string[];
  alertIds?: string[];
  alertEventIds?: string[];
  severitySummary?: string;
  status: 'queued' | 'sent' | 'skipped' | 'failed';
  skipReason?: string;
  errorMessage?: string;
  providerMessageId?: string;
  cronRunId?: string;
  sentAt?: string;
  budgetMonth?: string;
}

function budgetMonthFromDate(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function logEmailAlert(input: EmailAlertLogInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    const accountId = input.accountId ?? input.orgId ?? input.userId;
    await supabase.from('email_alert_logs').insert({
      account_id: accountId,
      user_id: input.userId,
      org_id: input.orgId ?? null,
      recipient: input.recipient,
      email_type: input.emailType,
      subject: input.subject,
      website_ids: input.websiteIds ?? [],
      alert_ids: input.alertIds ?? [],
      related_alert_event_ids: input.alertEventIds ?? [],
      severity_summary: input.severitySummary ?? null,
      provider: 'resend',
      provider_message_id: input.providerMessageId ?? null,
      status: input.status,
      skip_reason: input.skipReason ?? null,
      error_message: input.errorMessage ?? null,
      cron_run_id: input.cronRunId ?? null,
      budget_month: input.budgetMonth ?? budgetMonthFromDate(),
      sent_at: input.sentAt ?? (input.status === 'sent' ? new Date().toISOString() : null),
    });
  } catch (err) {
    console.warn('[emailAlertLog] insert failed:', err);
  }
}

export async function getMonthlyEmailUsage(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  budgetMonth: string;
}> {
  const supabase = createAdminClient();
  const budgetMonth = budgetMonthFromDate();
  const monthStart = `${budgetMonth}-01T00:00:00.000Z`;

  const [sent, skipped, failed] = await Promise.all([
    supabase.from('email_alert_logs').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', monthStart),
    supabase.from('email_alert_logs').select('id', { count: 'exact', head: true }).eq('status', 'skipped').gte('created_at', monthStart),
    supabase.from('email_alert_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', monthStart),
  ]);

  return {
    sent: sent.count ?? 0,
    skipped: skipped.count ?? 0,
    failed: failed.count ?? 0,
    budgetMonth,
  };
}

export async function createCronMonitoringRun(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('cron_monitoring_runs')
    .insert({ started_at: new Date().toISOString() })
    .select('id')
    .single();

  if (error || !data) {
    console.warn('[cronMonitoringRun] create failed:', error?.message);
    return '';
  }
  return data.id;
}

export async function completeCronMonitoringRun(
  runId: string,
  stats: {
    websitesConsidered: number;
    websitesDue: number;
    websitesEnqueued: number;
    websitesSkipped: number;
    websitesBlocked: number;
    websitesErrors: number;
    batchProcessed: number;
    batchFailed: number;
    emailsAttempted: number;
    emailsSent: number;
    emailsSkipped: number;
    errors?: unknown;
  },
): Promise<void> {
  if (!runId) return;
  const supabase = createAdminClient();
  await supabase
    .from('cron_monitoring_runs')
    .update({
      completed_at: new Date().toISOString(),
      websites_considered: stats.websitesConsidered,
      websites_due: stats.websitesDue,
      websites_enqueued: stats.websitesEnqueued,
      websites_skipped: stats.websitesSkipped,
      websites_blocked: stats.websitesBlocked,
      websites_errors: stats.websitesErrors,
      batch_processed: stats.batchProcessed,
      batch_failed: stats.batchFailed,
      emails_attempted: stats.emailsAttempted,
      emails_sent: stats.emailsSent,
      emails_skipped: stats.emailsSkipped,
      errors: stats.errors ? JSON.parse(JSON.stringify(stats.errors)) : null,
    })
    .eq('id', runId);
}
