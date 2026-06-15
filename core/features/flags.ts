export const FEATURES = {
  referrals: false,
  enterprise: false,
  aiInsights: false,
  queueWorker: true,
  emailAlerts: true,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}
