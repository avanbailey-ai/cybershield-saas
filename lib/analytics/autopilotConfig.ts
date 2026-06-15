export type AutopilotConfigKey =
  | 'highlighted_plan'
  | 'cta_placement'
  | 'headline_variant'
  | 'paywall_delay_ms'
  | 'autopilot_last_run'
  | 'autopilot_recommendations';

export interface AutopilotSettings {
  highlighted_plan: 'growth' | 'pro' | 'agency';
  cta_placement: 'top' | 'bottom' | 'both';
  headline_variant: string;
  paywall_delay_ms: number;
  autopilot_last_run: string | null;
  autopilot_recommendations: AutopilotRecommendation[];
}

export interface AutopilotRecommendation {
  step: string;
  dropoff_pct: number;
  action: string;
  config_key?: AutopilotConfigKey;
  suggested_value?: unknown;
}

const DEFAULTS: AutopilotSettings = {
  highlighted_plan: 'growth',
  cta_placement: 'both',
  headline_variant: 'default',
  paywall_delay_ms: 2000,
  autopilot_last_run: null,
  autopilot_recommendations: [],
};

export function parseAutopilotConfig(
  rows: { key: string; value: unknown }[],
): AutopilotSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    highlighted_plan: (map.get('highlighted_plan') as AutopilotSettings['highlighted_plan']) ?? DEFAULTS.highlighted_plan,
    cta_placement: (map.get('cta_placement') as AutopilotSettings['cta_placement']) ?? DEFAULTS.cta_placement,
    headline_variant: String(map.get('headline_variant') ?? DEFAULTS.headline_variant),
    paywall_delay_ms: Number(map.get('paywall_delay_ms') ?? DEFAULTS.paywall_delay_ms),
    autopilot_last_run: map.get('autopilot_last_run') as string | null,
    autopilot_recommendations:
      (map.get('autopilot_recommendations') as AutopilotRecommendation[]) ?? [],
  };
}

export const SAFE_CONFIG_KEYS: AutopilotConfigKey[] = [
  'highlighted_plan',
  'cta_placement',
  'headline_variant',
  'paywall_delay_ms',
  'autopilot_last_run',
  'autopilot_recommendations',
];

/** Brain-safe keys are enforced in lib/brain/safety.ts — re-export for compat. */
export { ALLOWED_CONFIG_KEYS as BRAIN_CONFIG_KEYS } from '@/lib/brain/safety';
