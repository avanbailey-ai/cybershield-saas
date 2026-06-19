import type { SupabaseClient } from '@supabase/supabase-js';
import { getEmailHealth, type EmailHealthSummary } from './emailHealth';
import { computeEmailEngagementRates } from './emailEngagementMetrics';
import { getOutreachSettings } from './outreachSettings';
import {
  EMAIL_ROOT_DOMAIN,
  getResendFromAddress,
  isMailSubdomainConfigured,
  isResendSandboxFrom,
} from '@/lib/email/config';
import type { GrowthAutopilotMode } from './growthAutopilotSettings';

export type DeliverabilityStatus = 'healthy' | 'caution' | 'paused';

export interface DeliverabilityGuardResult {
  status: DeliverabilityStatus;
  canSend: boolean;
  canLimitedAutopilot: boolean;
  reasons: string[];
  recommendedDailyCap: number;
  sendsToday: number;
  bounceRate: number;
  unsubscribeRate: number;
  complaintRate: number;
  checks: { id: string; ok: boolean; detail: string }[];
}

/** Warmup caps — do not exceed without manual override in settings. */
export const WARMUP_DAILY_CAPS: Record<1 | 2 | 3, { min: number; max: number }> = {
  1: { min: 5, max: 10 },
  2: { min: 10, max: 20 },
  3: { min: 20, max: 40 },
};

const BOUNCE_PAUSE_THRESHOLD = 5;
const UNSUB_PAUSE_THRESHOLD = 2;
const COMPLAINT_PAUSE_THRESHOLD = 0.5;

export function recommendedDailyCap(warmupWeek: 1 | 2 | 3): number {
  return WARMUP_DAILY_CAPS[warmupWeek].max;
}

async function dailySendCount(admin: SupabaseClient): Promise<number> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { count } = await admin
    .from('owner_outreach_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', dayStart.toISOString());
  return count ?? 0;
}

async function engagementRates(admin: SupabaseClient, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [sentRes, bouncedRes, openRes, clickRes, unsubRes, complaintRes] = await Promise.all([
    admin
      .from('owner_outreach_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', since),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'bounced')
      .gte('created_at', since),
    admin
      .from('owner_email_engagement_events')
      .select('delivery_id')
      .eq('event_type', 'opened')
      .gte('created_at', since),
    admin
      .from('owner_email_engagement_events')
      .select('delivery_id')
      .eq('event_type', 'clicked')
      .gte('created_at', since),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'unsubscribed')
      .gte('created_at', since),
    admin
      .from('owner_email_engagement_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'complained')
      .gte('created_at', since),
  ]);

  const sent = sentRes.count ?? 0;
  const bounced = bouncedRes.count ?? 0;
  const rates = computeEmailEngagementRates({
    sent,
    bounced,
    openEvents: openRes.data ?? [],
    clickEvents: clickRes.data ?? [],
  });

  const unsub = unsubRes.count ?? 0;
  const complaints = complaintRes.count ?? 0;

  return {
    sent,
    bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
    unsubscribeRate: sent > 0 ? (unsub / sent) * 100 : 0,
    complaintRate: sent > 0 ? (complaints / sent) * 100 : 0,
    uniqueOpenRate: rates.uniqueOpenRate,
  };
}

export async function isEmailSuppressed(
  admin: SupabaseClient,
  email: string,
): Promise<{ suppressed: boolean; reason: string | null }> {
  const lower = email.toLowerCase();
  const { count: unsub } = await admin
    .from('owner_email_engagement_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'unsubscribed')
    .ilike('metadata->>recipient_email', lower);

  if ((unsub ?? 0) > 0) {
    return { suppressed: true, reason: 'Contact unsubscribed' };
  }

  const { data: deliveries } = await admin
    .from('owner_email_deliveries')
    .select('id, status')
    .eq('recipient_email', lower)
    .in('status', ['bounced', 'complained', 'unsubscribed'])
    .limit(1);

  if (deliveries && deliveries.length > 0) {
    return { suppressed: true, reason: `Delivery status: ${deliveries[0]!.status}` };
  }

  return { suppressed: false, reason: null };
}

function evaluateDnsHealth(emailHealth: EmailHealthSummary): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const dkim = emailHealth.checks.find((c) => c.id === 'dkim');
  const spf = emailHealth.checks.find((c) => c.id === 'spf');
  const dmarc = emailHealth.checks.find((c) => c.id === 'dmarc');
  const resendDomain = emailHealth.checks.find((c) => c.id === 'resend_domain');

  if (dkim?.status === 'critical') reasons.push('DKIM not healthy');
  if (spf?.status === 'critical') reasons.push('SPF not healthy');
  if (!dmarc || dmarc.status === 'critical') {
    reasons.push('DMARC missing or misconfigured');
  } else if (dmarc.detail.toLowerCase().includes('p=none')) {
    /* warmup allowed */
  }

  if (resendDomain?.status === 'critical') {
    reasons.push(resendDomain.detail);
  }

  const from = getResendFromAddress('outreach');
  if (isResendSandboxFrom(from)) {
    reasons.push('Using Resend sandbox sender — not production-ready');
  }
  if (isMailSubdomainConfigured() && from.includes('mail.') && !from.includes(EMAIL_ROOT_DOMAIN)) {
    reasons.push('Unverified mail subdomain in sender — use verified root sender');
  }

  return { ok: reasons.length === 0, reasons };
}

/** Full deliverability guard — blocks sends when unsafe. */
export async function evaluateDeliverabilityGuard(
  admin: SupabaseClient,
  opts: { warmupWeek?: 1 | 2 | 3; mode?: GrowthAutopilotMode; manualApproval?: boolean } = {},
): Promise<DeliverabilityGuardResult> {
  const warmupWeek = opts.warmupWeek ?? 1;
  const manualApproval = opts.manualApproval === true;
  const [emailHealth, outreachSettings, sendsToday, rates] = await Promise.all([
    getEmailHealth(),
    getOutreachSettings(admin),
    dailySendCount(admin),
    engagementRates(admin),
  ]);

  const warmupCap = recommendedDailyCap(warmupWeek);
  const cap = manualApproval
    ? warmupCap
    : Math.min(warmupCap, outreachSettings.daily_outreach_limit);
  const checks: DeliverabilityGuardResult['checks'] = [];
  const reasons: string[] = [];

  const dns = evaluateDnsHealth(emailHealth);
  checks.push({
    id: 'dns',
    ok: dns.ok,
    detail: dns.ok ? 'DNS authentication healthy' : dns.reasons.join('; '),
  });
  if (!dns.ok) reasons.push(...dns.reasons);

  if (!outreachSettings.enable_outreach_sending) {
    reasons.push('Outreach sending disabled in settings');
    checks.push({ id: 'sending_enabled', ok: false, detail: 'Sending disabled' });
  } else {
    checks.push({ id: 'sending_enabled', ok: true, detail: 'Sending enabled' });
  }

  if (opts.mode === 'paused') {
    reasons.push('Autopilot mode is paused');
  }

  if (rates.bounceRate > BOUNCE_PAUSE_THRESHOLD) {
    reasons.push(`Bounce rate ${rates.bounceRate.toFixed(1)}% exceeds ${BOUNCE_PAUSE_THRESHOLD}% limit`);
    checks.push({ id: 'bounce_rate', ok: false, detail: `${rates.bounceRate.toFixed(1)}% bounce rate` });
  } else {
    checks.push({ id: 'bounce_rate', ok: true, detail: `${rates.bounceRate.toFixed(1)}% bounce rate` });
  }

  if (rates.unsubscribeRate > UNSUB_PAUSE_THRESHOLD) {
    reasons.push(`Unsubscribe rate ${rates.unsubscribeRate.toFixed(1)}% is high`);
    checks.push({ id: 'unsubscribe_rate', ok: false, detail: `${rates.unsubscribeRate.toFixed(1)}% unsubscribes` });
  } else {
    checks.push({ id: 'unsubscribe_rate', ok: true, detail: `${rates.unsubscribeRate.toFixed(1)}% unsubscribes` });
  }

  if (rates.complaintRate > COMPLAINT_PAUSE_THRESHOLD) {
    reasons.push('Spam complaint rate elevated');
    checks.push({ id: 'complaints', ok: false, detail: `${rates.complaintRate.toFixed(2)}% complaints` });
  } else {
    checks.push({ id: 'complaints', ok: true, detail: 'No elevated complaints' });
  }

  if (!manualApproval && sendsToday >= cap) {
    reasons.push(`Daily send cap reached (${sendsToday}/${cap})`);
    checks.push({ id: 'daily_cap', ok: false, detail: `${sendsToday}/${cap} sends today` });
  } else {
    checks.push({
      id: 'daily_cap',
      ok: true,
      detail: manualApproval
        ? `${sendsToday} sends today (manual approval — no daily cap; DNS and bounce rules still apply)`
        : `${sendsToday}/${cap} sends today`,
    });
  }

  const hasCritical = emailHealth.overall === 'critical' || rates.bounceRate > BOUNCE_PAUSE_THRESHOLD;
  const hasWarning =
    emailHealth.overall === 'warning' ||
    rates.unsubscribeRate > UNSUB_PAUSE_THRESHOLD ||
    (!manualApproval && sendsToday >= cap * 0.8);

  let status: DeliverabilityStatus = 'healthy';
  if (hasCritical || opts.mode === 'paused' || !outreachSettings.enable_outreach_sending) {
    status = 'paused';
  } else if (hasWarning || reasons.length > 0) {
    status = 'caution';
  }

  const canSend =
    status !== 'paused' && dns.ok && (manualApproval || sendsToday < cap);
  const canLimitedAutopilot =
    canSend &&
    opts.mode === 'limited' &&
    rates.bounceRate < 2 &&
    rates.unsubscribeRate < 1 &&
    dns.ok;

  return {
    status,
    canSend,
    canLimitedAutopilot,
    reasons: [...new Set(reasons)],
    recommendedDailyCap: cap,
    sendsToday,
    bounceRate: rates.bounceRate,
    unsubscribeRate: rates.unsubscribeRate,
    complaintRate: rates.complaintRate,
    checks,
  };
}

export async function assertCanSendOutreach(
  admin: SupabaseClient,
  email: string,
  opts: { warmupWeek?: 1 | 2 | 3; mode?: GrowthAutopilotMode; manualApproval?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await evaluateDeliverabilityGuard(admin, opts);
  if (!guard.canSend) {
    return { ok: false, error: guard.reasons[0] ?? 'Deliverability guard blocked send' };
  }
  const suppressed = await isEmailSuppressed(admin, email);
  if (suppressed.suppressed) {
    return { ok: false, error: suppressed.reason ?? 'Contact suppressed' };
  }
  return { ok: true };
}
