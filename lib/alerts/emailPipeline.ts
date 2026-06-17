import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { groupedMonitoringAlertEmail } from '@/lib/emailTemplates';
import { canAccessFeature } from '@/lib/auth/featureGate';
import { getUserWithPlan } from '@/lib/billing/planService';
import { getActiveOrgId } from '@/lib/org/context';
import { checkEmailBudget } from './emailBudget';
import {
  countAccountEmailsSentToday,
  getAccountEmailPreferences,
} from './accountEmailPreferences';
import { logEmailAlert } from './emailAlertLog';
import { getLastEmailedAtForFinding } from './alertEvents';
import {
  immediateSkipReasonForSeverity,
  isCriticalRepeatCooldownActive,
  planAllowsMonitoringEmail,
  shouldEmailImmediately,
} from './emailDecision';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { flushLegacyGroupedAlerts } from './groupedMonitoringEmail';

type PendingEvent = {
  id: string;
  account_id: string;
  user_id: string;
  website_id: string;
  scan_id: string | null;
  event_type: string;
  severity: string;
  finding_key: string;
  finding_title: string;
  is_new: boolean;
  is_worsened: boolean;
  should_email_immediately: boolean;
  websites: { url: string } | { url: string }[] | null;
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function websiteUrl(row: PendingEvent['websites']): string {
  if (!row) return '';
  if (Array.isArray(row)) return row[0]?.url ?? '';
  return row.url;
}

export interface ProcessAlertEventsResult {
  attempted: number;
  sent: number;
  skipped: number;
  queuedDigest: number;
}

export async function processPendingAlertEvents(options?: {
  cronRunId?: string;
}): Promise<ProcessAlertEventsResult> {
  const supabase = createAdminClient();
  const result: ProcessAlertEventsResult = { attempted: 0, sent: 0, skipped: 0, queuedDigest: 0 };

  const { data: pending, error } = await supabase
    .from('alert_events')
    .select(
      'id, account_id, user_id, website_id, scan_id, event_type, severity, finding_key, finding_title, is_new, is_worsened, should_email_immediately, websites(url)',
    )
    .eq('email_status', 'pending')
    .eq('should_email_immediately', true)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error || !pending?.length) {
    return result;
  }

  const byAccount = new Map<string, PendingEvent[]>();
  for (const row of pending) {
    const list = byAccount.get(row.account_id) ?? [];
    list.push(row as PendingEvent);
    byAccount.set(row.account_id, list);
  }

  for (const [accountId, events] of byAccount) {
    result.attempted++;
    const userId = events[0]!.user_id;

    const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
    if (!profile?.email) {
      await skipEvents(supabase, events, 'profile_email_missing', options?.cronRunId, accountId, userId, '');
      result.skipped++;
      continue;
    }

    const orgId = await getActiveOrgId(userId);
    const userWithPlan = await getUserWithPlan(userId, orgId);
    const plan = getEffectivePlan(userWithPlan);

    if (!planAllowsMonitoringEmail(plan)) {
      await skipEvents(supabase, events, 'plan_free', options?.cronRunId, accountId, userId, profile.email);
      result.skipped++;
      continue;
    }

    const prefs = await getAccountEmailPreferences(accountId);
    if (!prefs.criticalAlertsEnabled) {
      await skipEvents(supabase, events, 'preference_disabled', options?.cronRunId, accountId, userId, profile.email);
      result.skipped++;
      continue;
    }

    if (
      !canAccessFeature(
        { email: profile.email, plan: userWithPlan.plan, subscription_status: userWithPlan.subscription_status },
        'alerts',
      )
    ) {
      await skipEvents(supabase, events, 'plan_gated', options?.cronRunId, accountId, userId, profile.email);
      result.skipped++;
      continue;
    }

    const emailable: PendingEvent[] = [];
    for (const event of events) {
      const severitySkip = immediateSkipReasonForSeverity(event.severity);
      if (severitySkip && !event.should_email_immediately) {
        await markEventSkipped(supabase, event.id, severitySkip);
        result.queuedDigest++;
        continue;
      }

      if (!shouldEmailImmediately({
        eventType: event.event_type,
        severity: event.severity,
        findingTitle: event.finding_title,
        currentSeverity: event.severity,
        isNew: event.is_new,
        isWorsened: event.is_worsened,
      })) {
        await supabase
          .from('alert_events')
          .update({ email_status: 'queued_digest', email_skip_reason: 'digest_only' })
          .eq('id', event.id);
        result.queuedDigest++;
        continue;
      }

      const lastSent = await getLastEmailedAtForFinding(
        accountId,
        event.website_id,
        event.finding_key,
        event.severity,
      );
      if (!event.is_new && !event.is_worsened && isCriticalRepeatCooldownActive(lastSent)) {
        await markEventSkipped(supabase, event.id, 'critical_repeat_cooldown_7d');
        result.skipped++;
        continue;
      }

      emailable.push(event);
    }

    if (emailable.length === 0) {
      result.skipped++;
      continue;
    }

    const accountEmailsToday = await countAccountEmailsSentToday(accountId);
    if (accountEmailsToday >= prefs.maxAlertEmailsPerDay) {
      await skipEvents(
        supabase,
        emailable,
        'max_alert_emails_per_day',
        options?.cronRunId,
        accountId,
        userId,
        profile.email,
      );
      result.skipped++;
      continue;
    }

    const budget = await checkEmailBudget('critical_alert');
    if (!budget.allowed) {
      await skipEvents(
        supabase,
        emailable,
        budget.reason ?? 'budget_blocked',
        options?.cronRunId,
        accountId,
        userId,
        profile.email,
      );
      result.skipped++;
      continue;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cybershield-saas-1o19.vercel.app';
    const dashboardUrl = `${siteUrl}/dashboard/alerts`;

    const items = emailable.map((event) => ({
      domain: extractDomain(websiteUrl(event.websites) || event.finding_title),
      severity: event.severity,
      issue: event.finding_title,
      whyItMatters: event.is_worsened
        ? 'This issue worsened since the last check.'
        : 'CyberShield detected a new critical issue during monitoring.',
      reportUrl: event.scan_id ? `${siteUrl}/report/${event.scan_id}` : dashboardUrl,
    }));

    const subject =
      items.length === 1
        ? 'CyberShield alert: 1 website needs attention'
        : `CyberShield alert: ${items.length} websites need attention`;

    const html = groupedMonitoringAlertEmail({
      websiteCount: items.length,
      items,
      dashboardUrl,
      emailTypeLabel: 'Critical alert',
      reason:
        'You are receiving this because CyberShield detected new or worsened critical issues on your websites.',
    });

    const emailResult = await sendEmail({ to: profile.email, subject, html });

    if (!emailResult.success) {
      await skipEvents(
        supabase,
        emailable,
        'send_failed',
        options?.cronRunId,
        accountId,
        userId,
        profile.email,
        emailResult.error,
      );
      result.skipped++;
      continue;
    }

    const sentAt = new Date().toISOString();
    const eventIds = emailable.map((e) => e.id);
    const websiteIds = [...new Set(emailable.map((e) => e.website_id))];

    await supabase
      .from('alert_events')
      .update({ email_status: 'sent', email_skip_reason: null })
      .in('id', eventIds);

    const { data: alertLinks } = await supabase
      .from('alert_events')
      .select('alert_id')
      .in('id', eventIds);
    const alertIds = (alertLinks ?? []).map((r) => r.alert_id).filter(Boolean) as string[];
    if (alertIds.length) {
      await supabase.from('alerts').update({ email_dispatch_status: 'sent' }).in('id', alertIds);
    }

    await logEmailAlert({
      accountId,
      userId,
      orgId,
      recipient: profile.email,
      emailType: 'critical_alert',
      subject,
      websiteIds,
      alertEventIds: eventIds,
      severitySummary: items.map((i) => `${i.domain}:${i.severity}`).join(', '),
      status: 'sent',
      providerMessageId: emailResult.messageId,
      cronRunId: options?.cronRunId,
      sentAt,
    });

    result.sent++;
  }

  return result;
}

async function markEventSkipped(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from('alert_events')
    .update({ email_status: 'skipped', email_skip_reason: reason })
    .eq('id', eventId);
}

async function skipEvents(
  supabase: ReturnType<typeof createAdminClient>,
  events: PendingEvent[],
  reason: string,
  cronRunId: string | undefined,
  accountId: string,
  userId: string,
  recipient: string,
  errorMessage?: string,
): Promise<void> {
  const ids = events.map((e) => e.id);
  if (!ids.length) return;

  await supabase
    .from('alert_events')
    .update({ email_status: 'skipped', email_skip_reason: reason })
    .in('id', ids);

  await logEmailAlert({
    accountId,
    userId,
    recipient,
    emailType: 'critical_alert',
    subject: '(skipped)',
    alertEventIds: ids,
    severitySummary: reason,
    status: 'skipped',
    skipReason: reason,
    errorMessage,
    cronRunId,
  });
}

/** Cron + manual flush: new alert_events pipeline + legacy alerts table. */
export async function flushGroupedMonitoringAlerts(options?: {
  cronRunId?: string;
}): Promise<{ attempted: number; sent: number; skipped: number }> {
  const events = await processPendingAlertEvents(options);
  const legacy = await flushLegacyGroupedAlerts(options);
  return {
    attempted: events.attempted + legacy.attempted,
    sent: events.sent + legacy.sent,
    skipped: events.skipped + legacy.skipped,
  };
}
