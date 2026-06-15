import { createAdminClient } from '@/lib/supabase/admin';
import { computeChurnRisk } from './churn';
import { emitEvent } from './eventBus';
import { scheduleRetentionEmails } from './retention';

const PAID_PLANS = ['pro', 'growth', 'agency'];

export interface ChurnScanResult {
  scanned: number;
  highRisk: number;
  updated: number;
}

export async function runChurnScanner(): Promise<ChurnScanResult> {
  const admin = createAdminClient();
  const now = new Date();

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, plan, last_active_at, churn_risk_score')
    .in('plan', PAID_PLANS)
    .eq('subscription_status', 'active');

  if (!profiles?.length) {
    return { scanned: 0, highRisk: 0, updated: 0 };
  }

  let highRisk = 0;
  let updated = 0;

  for (const profile of profiles) {
    const userId = profile.id;

    const { data: lastScan } = await admin
      .from('scans')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: scansLast30 } = await admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', new Date(now.getTime() - 30 * 86400000).toISOString());

    const lastActive = profile.last_active_at
      ? new Date(profile.last_active_at)
      : null;
    const lastScanDate = lastScan?.completed_at ? new Date(lastScan.completed_at) : null;

    const daysSinceLastLogin = lastActive
      ? Math.floor((now.getTime() - lastActive.getTime()) / 86400000)
      : 30;
    const daysSinceLastScan = lastScanDate
      ? Math.floor((now.getTime() - lastScanDate.getTime()) / 86400000)
      : 30;

    const score = computeChurnRisk({
      daysSinceLastScan,
      daysSinceLastLogin,
      scansLast30Days: scansLast30 ?? 0,
      plan: profile.plan ?? 'pro',
    });

    if (score !== profile.churn_risk_score) {
      await admin
        .from('profiles')
        .update({ churn_risk_score: score })
        .eq('id', userId);
      updated++;
    }

    if (score > 70) {
      highRisk++;
      await emitEvent(
        'churn_risk_detected',
        { churnRiskScore: score, plan: profile.plan },
        userId,
        null,
        'brain',
      );
    }

    if (score > 60) {
      void scheduleRetentionEmails(userId, score).catch((err) =>
        console.error('[churnScanner] retention schedule failed:', err),
      );
    }
  }

  return { scanned: profiles.length, highRisk, updated };
}
