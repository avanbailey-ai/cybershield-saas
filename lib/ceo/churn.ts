/**
 * CEO retention monitoring — read-only churn risk counts.
 * Reuses brain churn model; does NOT trigger retention emails.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { computeChurnRisk } from '@/lib/brain/churn';

export { computeChurnRisk };

export const CHURN_RISK_THRESHOLD = 60;

export interface ChurnRiskSummary {
  usersAtRisk: number;
  highRisk: number;
  averageScore: number;
}

export async function getChurnRiskSummary(): Promise<ChurnRiskSummary> {
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from('profiles')
    .select('churn_risk_score')
    .neq('plan', 'owner');

  const rows = profiles ?? [];
  const scores = rows.map((p) => p.churn_risk_score ?? 0);
  const usersAtRisk = scores.filter((s) => s >= CHURN_RISK_THRESHOLD).length;
  const highRisk = scores.filter((s) => s > 70).length;
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

  return { usersAtRisk, highRisk, averageScore };
}
