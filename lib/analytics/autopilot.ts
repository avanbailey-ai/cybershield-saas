/**
 * Autopilot analysis engine — logic-first, no external AI APIs.
 *
 * SAFETY CONSTRAINTS (never violate):
 * - NEVER change Stripe prices
 * - NEVER remove paywalls
 * - NEVER expose paid features for free
 * - NEVER modify auth/roles
 * - Only UI/UX config keys in autopilot_config (highlighted_plan, cta_placement,
 *   headline_variant, paywall_delay_ms)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { AutopilotRecommendation, AutopilotSettings } from './autopilotConfig';
import { parseAutopilotConfig, SAFE_CONFIG_KEYS } from './autopilotConfig';

export interface FunnelStep {
  name: string;
  count: number;
  rate_from_previous: number | null;
  dropoff_pct: number | null;
}

export interface AutopilotReport {
  period_days: number;
  funnel: FunnelStep[];
  weakest_step: string | null;
  recommendations: AutopilotRecommendation[];
  applied_config: Partial<AutopilotSettings>;
  analyzed_at: string;
}

const FUNNEL_STEPS = [
  'scan_started',
  'scan_completed',
  'paywall_viewed',
  'upgrade_clicked',
  'checkout_started',
  'checkout_completed',
] as const;

export async function runAutopilotAnalysis(): Promise<AutopilotReport> {
  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: events } = await admin
    .from('analytics_events')
    .select('event_type, session_id')
    .gte('created_at', since.toISOString());

  const sessionSets = new Map<string, Set<string>>();
  for (const row of events ?? []) {
    const sid = row.session_id ?? 'unknown';
    if (!sessionSets.has(sid)) sessionSets.set(sid, new Set());
    sessionSets.get(sid)!.add(row.event_type);
  }

  const counts: Record<string, number> = {};
  for (const step of FUNNEL_STEPS) {
    counts[step] = 0;
  }
  for (const types of sessionSets.values()) {
    for (const step of FUNNEL_STEPS) {
      if (types.has(step)) counts[step]++;
    }
  }

  const funnel: FunnelStep[] = FUNNEL_STEPS.map((name, i) => {
    const count = counts[name];
    const prevCount = i > 0 ? counts[FUNNEL_STEPS[i - 1]] : null;
    const rate =
      prevCount && prevCount > 0 ? Math.round((count / prevCount) * 1000) / 10 : null;
    const dropoff =
      prevCount && prevCount > 0
        ? Math.round(((prevCount - count) / prevCount) * 1000) / 10
        : null;
    return { name, count, rate_from_previous: rate, dropoff_pct: dropoff };
  });

  let weakest: FunnelStep | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const step = funnel[i];
    if (step.dropoff_pct === null) continue;
    if (!weakest || (step.dropoff_pct ?? 0) > (weakest.dropoff_pct ?? 0)) {
      weakest = step;
    }
  }

  const recommendations = buildRecommendations(weakest, funnel);
  const appliedConfig = deriveConfigUpdates(recommendations);

  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(appliedConfig)) {
    if (!SAFE_CONFIG_KEYS.includes(key as (typeof SAFE_CONFIG_KEYS)[number])) continue;
    await admin.from('autopilot_config').upsert({
      key,
      value,
      updated_at: now,
    });
  }

  await admin.from('autopilot_config').upsert({
    key: 'autopilot_last_run',
    value: now,
    updated_at: now,
  });
  await admin.from('autopilot_config').upsert({
    key: 'autopilot_recommendations',
    value: recommendations,
    updated_at: now,
  });

  const { data: configRows } = await admin.from('autopilot_config').select('key, value');
  const settings = parseAutopilotConfig(configRows ?? []);

  return {
    period_days: 7,
    funnel,
    weakest_step: weakest?.name ?? null,
    recommendations,
    applied_config: {
      highlighted_plan: settings.highlighted_plan,
      cta_placement: settings.cta_placement,
      headline_variant: settings.headline_variant,
      paywall_delay_ms: settings.paywall_delay_ms,
    },
    analyzed_at: now,
  };
}

function buildRecommendations(
  weakest: FunnelStep | null,
  funnel: FunnelStep[],
): AutopilotRecommendation[] {
  const recs: AutopilotRecommendation[] = [];
  if (!weakest) return recs;

  switch (weakest.name) {
    case 'scan_completed':
      recs.push({
        step: 'scan_completed',
        dropoff_pct: weakest.dropoff_pct ?? 0,
        action: 'Reduce scan friction — emphasize free instant results on landing hero',
      });
      break;
    case 'paywall_viewed':
      recs.push({
        step: 'paywall_viewed',
        dropoff_pct: weakest.dropoff_pct ?? 0,
        action: 'Increase paywall delay for low-intent users',
        config_key: 'paywall_delay_ms',
        suggested_value: 3000,
      });
      break;
    case 'upgrade_clicked':
      recs.push({
        step: 'upgrade_clicked',
        dropoff_pct: weakest.dropoff_pct ?? 0,
        action: 'Highlight Growth plan and add urgency messaging',
        config_key: 'highlighted_plan',
        suggested_value: 'growth',
      });
      break;
    case 'checkout_started':
      recs.push({
        step: 'checkout_started',
        dropoff_pct: weakest.dropoff_pct ?? 0,
        action: 'Move primary CTA to top of paywall modal',
        config_key: 'cta_placement',
        suggested_value: 'top',
      });
      break;
    case 'checkout_completed':
      recs.push({
        step: 'checkout_completed',
        dropoff_pct: weakest.dropoff_pct ?? 0,
        action: 'Checkout abandonment — review recovery email timing (no Stripe changes)',
      });
      break;
    default:
      recs.push({
        step: weakest.name,
        dropoff_pct: weakest.dropoff_pct ?? 0,
        action: `Optimize ${weakest.name} step in conversion funnel`,
      });
  }

  const paywallStep = funnel.find((s) => s.name === 'paywall_viewed');
  if (paywallStep && (paywallStep.dropoff_pct ?? 0) > 50) {
    recs.push({
      step: 'paywall_viewed',
      dropoff_pct: paywallStep.dropoff_pct ?? 0,
      action: 'Test softer headline variant for low-intent traffic',
      config_key: 'headline_variant',
      suggested_value: 'educational',
    });
  }

  return recs;
}

function deriveConfigUpdates(
  recommendations: AutopilotRecommendation[],
): Partial<AutopilotSettings> {
  const updates: Partial<AutopilotSettings> = {};
  for (const rec of recommendations) {
    if (!rec.config_key || rec.suggested_value === undefined) continue;
    (updates as Record<string, unknown>)[rec.config_key] = rec.suggested_value;
  }
  return updates;
}

export async function getFunnelMetrics(days = 7): Promise<FunnelStep[]> {
  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: events } = await admin
    .from('analytics_events')
    .select('event_type, session_id')
    .gte('created_at', since.toISOString());

  const sessionSets = new Map<string, Set<string>>();
  for (const row of events ?? []) {
    const sid = row.session_id ?? 'unknown';
    if (!sessionSets.has(sid)) sessionSets.set(sid, new Set());
    sessionSets.get(sid)!.add(row.event_type);
  }

  const counts: Record<string, number> = {};
  for (const step of FUNNEL_STEPS) counts[step] = 0;
  for (const types of sessionSets.values()) {
    for (const step of FUNNEL_STEPS) {
      if (types.has(step)) counts[step]++;
    }
  }

  return FUNNEL_STEPS.map((name, i) => {
    const count = counts[name];
    const prevCount = i > 0 ? counts[FUNNEL_STEPS[i - 1]] : null;
    return {
      name,
      count,
      rate_from_previous:
        prevCount && prevCount > 0 ? Math.round((count / prevCount) * 1000) / 10 : null,
      dropoff_pct:
        prevCount && prevCount > 0
          ? Math.round(((prevCount - count) / prevCount) * 1000) / 10
          : null,
    };
  });
}
