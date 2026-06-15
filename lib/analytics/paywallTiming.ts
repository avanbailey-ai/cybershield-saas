import type { IntentTier } from './uiAdaptation';

export interface PaywallTimingConfig {
  delayMs: number;
  requireExplicitClick: boolean;
}

export function getPaywallDelay(
  intentScore: number,
  experimentDelayMs?: number,
  autopilotDelayMs?: number,
): PaywallTimingConfig {
  if (experimentDelayMs !== undefined) {
    return {
      delayMs: experimentDelayMs,
      requireExplicitClick: false,
    };
  }

  if (autopilotDelayMs !== undefined) {
    return {
      delayMs: autopilotDelayMs,
      requireExplicitClick: intentScore < 40,
    };
  }

  if (intentScore >= 70) {
    return { delayMs: 0, requireExplicitClick: false };
  }
  if (intentScore >= 40) {
    return { delayMs: 2000, requireExplicitClick: false };
  }
  return { delayMs: 5000, requireExplicitClick: true };
}

export function getIntentTierFromScore(score: number): IntentTier {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
