/** Org posture bands derived from rolling risk score (0–100). */

export type PostureState = 'CRITICAL' | 'DEGRADED' | 'STABLE' | 'HEALTHY';

export const POSTURE_BANDS: Array<{ state: PostureState; min: number; max: number }> = [
  { state: 'CRITICAL', min: 0, max: 40 },
  { state: 'DEGRADED', min: 41, max: 65 },
  { state: 'STABLE', min: 66, max: 85 },
  { state: 'HEALTHY', min: 86, max: 100 },
];

export function scoreToPostureState(score: number | null | undefined): PostureState | null {
  if (score === null || score === undefined) return null;
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  if (clamped <= 40) return 'CRITICAL';
  if (clamped <= 65) return 'DEGRADED';
  if (clamped <= 85) return 'STABLE';
  return 'HEALTHY';
}

export const POSTURE_DISPLAY: Record<
  PostureState,
  { label: string; badgeClass: string; textClass: string }
> = {
  CRITICAL: {
    label: 'Critical',
    badgeClass: 'border-red-500/40 bg-red-500/10',
    textClass: 'text-red-400',
  },
  DEGRADED: {
    label: 'Degraded',
    badgeClass: 'border-orange-500/40 bg-orange-500/10',
    textClass: 'text-orange-400',
  },
  STABLE: {
    label: 'Stable',
    badgeClass: 'border-yellow-500/40 bg-yellow-500/10',
    textClass: 'text-yellow-400',
  },
  HEALTHY: {
    label: 'Healthy',
    badgeClass: 'border-green-500/40 bg-green-500/10',
    textClass: 'text-green-400',
  },
};
