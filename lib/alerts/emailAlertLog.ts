import { createAdminClient } from '@/lib/supabase/admin';

export interface EmailAlertLogInput {
  userId: string;
  orgId?: string | null;
  recipient: string;
  emailType: string;
  subject: string;
  websiteIds?: string[];
  alertIds?: string[];
  severitySummary?: string;
  status: 'sent' | 'skipped' | 'failed';
  skipReason?: string;
  errorMessage?: string;
  providerMessageId?: string;
  cronRunId?: string;
}

export async function logEmailAlert(input: EmailAlertLogInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('email_alert_logs').insert({
      user_id: input.userId,
      org_id: input.orgId ?? null,
      recipient: input.recipient,
      email_type: input.emailType,
      subject: input.subject,
      website_ids: input.websiteIds ?? [],
      alert_ids: input.alertIds ?? [],
      severity_summary: input.severitySummary ?? null,
      provider: 'resend',
      provider_message_id: input.providerMessageId ?? null,
      status: input.status,
      skip_reason: input.skipReason ?? null,
      error_message: input.errorMessage ?? null,
      cron_run_id: input.cronRunId ?? null,
    });
  } catch (err) {
    console.warn('[emailAlertLog] insert failed:', err);
  }
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
