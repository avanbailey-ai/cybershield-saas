/**
 * CEO alerts — threshold-based warnings for owner review.
 * Stores alerts in ceo_alerts; optional non-blocking email to owner.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { OWNER_EMAIL } from '@/lib/auth/owner';
import { sendEmail } from '@/lib/email';
import type { DailyMetrics } from './metrics';

export interface CEOAlert {
  alert_type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function totalMrr(metrics: DailyMetrics): number {
  return Object.values(metrics.revenueByPlan).reduce((sum, p) => sum + p.mrr, 0);
}

export function checkAlerts(
  current: DailyMetrics,
  previous: DailyMetrics,
): CEOAlert[] {
  const alerts: CEOAlert[] = [];

  const conversionDelta = deltaPct(
    current.upgradeConversionRate,
    previous.upgradeConversionRate,
  );
  if (conversionDelta < -20 && previous.upgradeConversionRate > 0) {
    alerts.push({
      alert_type: 'conversion_drop_wow',
      message: `Upgrade conversion dropped ${Math.abs(conversionDelta)}% week-over-week (${previous.upgradeConversionRate}% → ${current.upgradeConversionRate}%)`,
      severity: 'critical',
      metadata: { conversionDelta, current: current.upgradeConversionRate, previous: previous.upgradeConversionRate },
    });
  }

  const checkoutStarted = current.funnelStages.checkout_started ?? 0;
  const checkoutCompleted = current.funnelStages.checkout_completed ?? 0;
  const prevStarted = previous.funnelStages.checkout_started ?? 0;
  const prevCompleted = previous.funnelStages.checkout_completed ?? 0;
  const abandonmentRate =
    checkoutStarted > 0
      ? Math.round(((checkoutStarted - checkoutCompleted) / checkoutStarted) * 1000) / 10
      : 0;
  const prevAbandonment =
    prevStarted > 0
      ? Math.round(((prevStarted - prevCompleted) / prevStarted) * 1000) / 10
      : 0;

  if (checkoutStarted > prevStarted * 1.5 && abandonmentRate > prevAbandonment + 15) {
    alerts.push({
      alert_type: 'checkout_failure_spike',
      message: `Checkout started spiked with ${abandonmentRate}% abandonment (possible payment friction)`,
      severity: 'warning',
      metadata: { checkoutStarted, checkoutCompleted, abandonmentRate },
    });
  }

  const scanDelta = deltaPct(current.scanCompletionRate, previous.scanCompletionRate);
  if (scanDelta < -15 && previous.scanCompletionRate > 0) {
    alerts.push({
      alert_type: 'scan_completion_drop',
      message: `Scan completion dropped ${Math.abs(scanDelta)}% (${previous.scanCompletionRate}% → ${current.scanCompletionRate}%)`,
      severity: 'warning',
      metadata: { scanDelta },
    });
  }

  const leadDelta = deltaPct(current.enterpriseLeadCount, previous.enterpriseLeadCount);
  if (leadDelta >= 50 && current.enterpriseLeadCount >= 2) {
    alerts.push({
      alert_type: 'enterprise_lead_surge',
      message: `Enterprise leads up ${leadDelta}% week-over-week (${previous.enterpriseLeadCount} → ${current.enterpriseLeadCount})`,
      severity: 'info',
      metadata: { leadDelta },
    });
  }

  const currentMrr = totalMrr(current);
  const previousMrr = totalMrr(previous);
  const mrrDelta = deltaPct(currentMrr, previousMrr);
  if (mrrDelta < -10 && previousMrr > 0) {
    alerts.push({
      alert_type: 'revenue_drop_wow',
      message: `Estimated MRR dropped ${Math.abs(mrrDelta)}% week-over-week ($${previousMrr} → $${currentMrr})`,
      severity: 'critical',
      metadata: { mrrDelta, currentMrr, previousMrr },
    });
  }

  return alerts;
}

export async function persistAlerts(alerts: CEOAlert[]): Promise<void> {
  if (alerts.length === 0) return;
  const admin = createAdminClient();
  await admin.from('ceo_alerts').insert(
    alerts.map((a) => ({
      alert_type: a.alert_type,
      message: a.message,
      severity: a.severity,
      metadata: a.metadata ?? {},
    })),
  );
}

export async function getUnreadAlertCount(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from('ceo_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);
  return count ?? 0;
}

export async function getRecentAlerts(limit = 10) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('ceo_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Non-blocking owner email via Resend. */
export function notifyOwnerEmail(alert: CEOAlert): void {
  void (async () => {
    const severityLabel = alert.severity.toUpperCase();
    await sendEmail({
      to: OWNER_EMAIL,
      subject: `[CyberShield CEO] ${severityLabel}: ${alert.alert_type}`,
      html: `
        <h2>CEO Alert — ${severityLabel}</h2>
        <p><strong>${alert.message}</strong></p>
        <p style="color:#666;font-size:12px;">Advisory only — no automatic changes were made.</p>
      `,
    });
  })();
}

export async function processAndNotifyAlerts(
  current: DailyMetrics,
  previous: DailyMetrics,
): Promise<CEOAlert[]> {
  const alerts = checkAlerts(current, previous);
  await persistAlerts(alerts);
  for (const alert of alerts.filter((a) => a.severity === 'critical')) {
    notifyOwnerEmail(alert);
  }
  return alerts;
}
