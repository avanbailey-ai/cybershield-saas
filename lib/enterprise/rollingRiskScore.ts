/** Rolling org risk score from last N completed scans — scans table SSOT. */

export const ROLLING_SCAN_WINDOW = 20;

export type CompletedScanScoreRow = {
  id: string;
  website_id: string;
  security_score: number | null;
  completed_at: string | null;
};

/** Recency weight: most recent = 1.0, oldest in window = 0.5 (linear decay). */
export function recencyWeight(index: number, count: number): number {
  if (count <= 1) return 1;
  return 1 - (index / (count - 1)) * 0.5;
}

/** Weighted average of security scores, rounded 0–100. Null when no scored scans. */
export function computeRollingRiskScore(
  scans: CompletedScanScoreRow[],
  windowSize = ROLLING_SCAN_WINDOW,
): number | null {
  const scored = scans
    .filter((s) => s.security_score !== null && s.completed_at)
    .sort(
      (a, b) =>
        new Date(b.completed_at as string).getTime() -
        new Date(a.completed_at as string).getTime(),
    )
    .slice(0, windowSize);

  if (scored.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < scored.length; i++) {
    const weight = recencyWeight(i, scored.length);
    weightedSum += (scored[i].security_score as number) * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;

  return Math.round(Math.min(100, Math.max(0, weightedSum / weightTotal)));
}
