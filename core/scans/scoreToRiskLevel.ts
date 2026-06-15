import type { RiskLevel } from './types';

/**
 * Pure: map security score 0-100 to risk level.
 */
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}
