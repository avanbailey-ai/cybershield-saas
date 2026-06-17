import { createAdminClient } from '@/lib/supabase/admin';
import { getEffectivePlan } from '@/lib/auth/permissions';
import { getUserWithPlan } from '@/lib/billing/planService';
import { resolveAccountId } from './accountEmailPreferences';
import {
  buildFindingKey,
  isDigestEligible,
  planAllowsMonitoringEmail,
  shouldEmailImmediately,
} from './emailDecision';

export interface RecordAlertEventParams {
  userId: string;
  orgId: string | null;
  websiteId: string;
  scanId: string | null;
  alertId: string | null;
  eventType: string;
  severity: string;
  findingTitle: string;
  message?: string;
  previousSeverity?: string | null;
  previousScore?: number | null;
  currentScore?: number | null;
  isNew?: boolean;
  isWorsened?: boolean;
}

export async function recordAlertEvent(params: RecordAlertEventParams): Promise<string | null> {
  const supabase = createAdminClient();
  const accountId = resolveAccountId(params.userId, params.orgId);

  const userWithPlan = await getUserWithPlan(params.userId, params.orgId);
  const plan = getEffectivePlan(userWithPlan);

  if (!planAllowsMonitoringEmail(plan)) {
    return null;
  }

  const findingKey = buildFindingKey(params.eventType, params.findingTitle);
  const isNew = params.isNew ?? true;
  const isWorsened = params.isWorsened ?? false;
  const currentSeverity = params.severity;

  const shouldImmediate = shouldEmailImmediately({
    eventType: params.eventType,
    severity: currentSeverity,
    findingTitle: params.findingTitle,
    previousSeverity: params.previousSeverity,
    currentSeverity,
    previousScore: params.previousScore,
    currentScore: params.currentScore,
    isNew,
    isWorsened,
  });

  const digestEligible = isDigestEligible(currentSeverity, shouldImmediate);

  const { data, error } = await supabase
    .from('alert_events')
    .insert({
      account_id: accountId,
      user_id: params.userId,
      website_id: params.websiteId,
      scan_id: params.scanId,
      alert_id: params.alertId,
      event_type: params.eventType,
      severity: currentSeverity,
      finding_key: findingKey,
      finding_title: params.findingTitle,
      previous_severity: params.previousSeverity ?? null,
      current_severity: currentSeverity,
      previous_score: params.previousScore ?? null,
      current_score: params.currentScore ?? null,
      is_new: isNew,
      is_worsened: isWorsened,
      should_email_immediately: shouldImmediate,
      digest_eligible: digestEligible,
      email_status: shouldImmediate ? 'pending' : digestEligible ? 'queued_digest' : 'skipped',
      email_skip_reason: shouldImmediate
        ? null
        : digestEligible
          ? 'queued_for_digest'
          : 'not_email_worthy',
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[alertEvents] insert failed:', error.message);
    return null;
  }

  // Keep legacy alerts table in sync so the old grouped-email flush cannot double-send.
  if (params.alertId) {
    const legacyStatus = shouldImmediate ? 'pending' : 'skipped';
    const legacySkipReason = shouldImmediate
      ? null
      : digestEligible
        ? 'alert_events_digest'
        : 'not_email_worthy';
    await supabase
      .from('alerts')
      .update({
        email_dispatch_status: legacyStatus,
        email_skip_reason: legacySkipReason,
      })
      .eq('id', params.alertId);
  }

  return data?.id ?? null;
}

export async function getLastEmailedAtForFinding(
  accountId: string,
  websiteId: string,
  findingKey: string,
  severity: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('alert_events')
    .select('created_at')
    .eq('account_id', accountId)
    .eq('website_id', websiteId)
    .eq('finding_key', findingKey)
    .eq('severity', severity)
    .eq('email_status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1);

  return data?.[0]?.created_at ?? null;
}

/** Create alert row + alert_event in one step. */
export async function recordMonitoringAlert(params: {
  userId: string;
  orgId: string | null;
  websiteId: string;
  scanId: string;
  eventType: string;
  severity: string;
  title: string;
  message: string;
  previousScore?: number | null;
  currentScore?: number | null;
  isNew?: boolean;
  isWorsened?: boolean;
}): Promise<void> {
  const supabase = createAdminClient();

  const { data: alert } = await supabase
    .from('alerts')
    .insert({
      user_id: params.userId,
      website_id: params.websiteId,
      scan_id: params.scanId,
      org_id: params.orgId,
      title: params.title,
      message: params.message,
      severity: params.severity,
      type: params.eventType,
      is_read: false,
      email_dispatch_status: 'pending',
    })
    .select('id')
    .single();

  await recordAlertEvent({
    userId: params.userId,
    orgId: params.orgId,
    websiteId: params.websiteId,
    scanId: params.scanId,
    alertId: alert?.id ?? null,
    eventType: params.eventType,
    severity: params.severity,
    findingTitle: params.title,
    previousScore: params.previousScore,
    currentScore: params.currentScore,
    isNew: params.isNew ?? true,
    isWorsened: params.isWorsened ?? false,
  });
}
