/**
 * Churn risk model — 0-100 score from behavioral signals.
 * Higher = more likely to churn.
 */

export interface ChurnSignals {
  daysSinceLastScan: number;
  daysSinceLastLogin: number;
  scansLast30Days: number;
  plan: string;
}

export function computeChurnRisk(signals: ChurnSignals): number {
  let score = 0;

  score += Math.min(40, signals.daysSinceLastScan * 2);
  score += Math.min(30, signals.daysSinceLastLogin * 1.5);

  if (signals.scansLast30Days === 0) {
    score += 20;
  } else if (signals.scansLast30Days <= 2) {
    score += 10;
  } else {
    score -= Math.min(25, signals.scansLast30Days * 3);
  }

  if (signals.plan === 'free') score += 15;
  else if (signals.plan === 'pro') score += 8;
  else if (signals.plan === 'growth') score += 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}
