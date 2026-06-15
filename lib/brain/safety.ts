/**
 * Brain optimizer safety whitelist — ONLY these keys may be modified by the brain.
 * NEVER: Stripe prices, auth/roles, schema, paywall removal, paid feature exposure.
 */

export const ALLOWED_CONFIG_KEYS = [
  'headline_variant',
  'cta_text_variant',
  'cta_placement',
  'highlighted_plan',
  'paywall_delay_ms',
  'pricing_layout_order',
  'trust_signals_visible',
  'urgency_level',
  'show_partial_ai_earlier',
  'autopilot_last_run',
  'autopilot_recommendations',
  'brain_last_optimization',
] as const;

export type BrainConfigKey = (typeof ALLOWED_CONFIG_KEYS)[number];

export function isAllowedConfigKey(key: string): key is BrainConfigKey {
  return (ALLOWED_CONFIG_KEYS as readonly string[]).includes(key);
}

export function filterAllowedConfig(
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (isAllowedConfigKey(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}
