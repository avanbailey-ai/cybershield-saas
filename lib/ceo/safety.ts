/**
 * CEO safety layer — ADVISORY ONLY with explicit manual apply.
 *
 * CONSTRAINTS (never violate):
 * - NEVER change Stripe prices, products, or subscriptions
 * - NEVER modify auth, roles, or user permissions
 * - NEVER alter database schema
 * - NEVER auto-execute recommendations — admin must click "Apply suggestion"
 * - ONLY whitelisted autopilot_config UI keys may be updated on apply
 *
 * Integrates with Final Boss brain: CEO recommends, brain-safe keys are applied.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { ALLOWED_CONFIG_KEYS, filterAllowedConfig } from '@/lib/brain/safety';
import { auditLog } from '@/lib/audit/log';
import type { Recommendation } from './recommendations';

export { ALLOWED_CONFIG_KEYS, filterAllowedConfig };

export async function storeRecommendations(recommendations: Recommendation[]): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from('autopilot_config').upsert({
    key: 'ceo_recommendations',
    value: recommendations,
    updated_at: now,
  });
}

export async function getStoredRecommendations(): Promise<Recommendation[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('autopilot_config')
    .select('value')
    .eq('key', 'ceo_recommendations')
    .maybeSingle();

  return (data?.value as Recommendation[]) ?? [];
}

export interface ApplyResult {
  ok: boolean;
  applied: Record<string, unknown>;
  error?: string;
}

/**
 * Apply a single CEO recommendation — ONLY when admin explicitly requests it.
 * Updates autopilot_config whitelisted keys and logs to audit_logs.
 */
export async function applyRecommendation(
  recId: string,
  userId: string,
  ip?: string | null,
): Promise<ApplyResult> {
  const recommendations = await getStoredRecommendations();
  const recommendation = recommendations.find((r) => r.id === recId);

  if (!recommendation) {
    return { ok: false, applied: {}, error: 'Recommendation not found' };
  }

  const filtered = filterAllowedConfig(recommendation.configPreview);
  if (Object.keys(filtered).length === 0) {
    return {
      ok: false,
      applied: {},
      error: 'No safe config keys in this recommendation (manual action required)',
    };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(filtered)) {
    await admin.from('autopilot_config').upsert({
      key,
      value,
      updated_at: now,
    });
  }

  auditLog({
    userId,
    action: 'ceo_recommendation_applied',
    metadata: {
      recommendationId: recId,
      action: recommendation.action,
      title: recommendation.title,
      appliedKeys: Object.keys(filtered),
      configPreview: filtered,
    },
    ip,
  });

  const remaining = recommendations.filter((r) => r.id !== recId);
  await storeRecommendations(remaining);

  return { ok: true, applied: filtered };
}
