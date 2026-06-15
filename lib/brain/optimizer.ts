/**
 * Safe brain optimizer — applies ONLY whitelisted autopilot_config keys.
 *
 * NEVER rules (Phase 10):
 * - NEVER change Stripe prices or products
 * - NEVER remove paywalls or expose paid features for free
 * - NEVER modify auth, roles, or RLS policies
 * - NEVER alter database schema
 * - NEVER touch billing webhooks or subscription logic
 * - ONLY UI/UX config keys from ALLOWED_CONFIG_KEYS in safety.ts
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { parseAutopilotConfig } from '@/lib/analytics/autopilotConfig';
import { filterAllowedConfig } from './safety';
import { generateBusinessInsights, getLatestInsights, type BusinessInsights } from './insights';
import { deriveConfigFromInsights } from './conversionRules';
import { emitEvent } from './eventBus';

export async function runOptimizer(
  regenerateInsights = true,
): Promise<{ applied: string[]; insights: BusinessInsights }> {
  const insights = regenerateInsights
    ? await generateBusinessInsights(30)
    : (await getLatestInsights()) ?? (await generateBusinessInsights(30));

  const configUpdates = filterAllowedConfig(
    deriveConfigFromInsights(insights) as Record<string, unknown>,
  );

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const applied: string[] = [];

  for (const [key, value] of Object.entries(configUpdates)) {
    await admin.from('autopilot_config').upsert({
      key,
      value,
      updated_at: now,
    });
    applied.push(key);
  }

  await admin.from('autopilot_config').upsert({
    key: 'brain_last_optimization',
    value: now,
    updated_at: now,
  });
  applied.push('brain_last_optimization');

  await emitEvent(
    'brain_optimization_applied',
    { applied, weakestStage: insights.weakestFunnelStage },
    null,
    null,
    'brain',
  );

  return { applied, insights };
}

export async function getBrainConfig(): Promise<Record<string, unknown>> {
  const admin = createAdminClient();
  const { data } = await admin.from('autopilot_config').select('key, value');
  const settings = parseAutopilotConfig(data ?? []);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));

  return {
    highlighted_plan: settings.highlighted_plan,
    cta_placement: settings.cta_placement,
    headline_variant: settings.headline_variant,
    paywall_delay_ms: settings.paywall_delay_ms,
    cta_text_variant: map.get('cta_text_variant') ?? 'Protect your site',
    pricing_layout_order: map.get('pricing_layout_order') ?? ['pro', 'growth', 'agency'],
    trust_signals_visible: map.get('trust_signals_visible') ?? true,
    urgency_level: map.get('urgency_level') ?? 'medium',
    show_partial_ai_earlier: map.get('show_partial_ai_earlier') ?? false,
  };
}
