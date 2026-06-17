/**
 * Manual apply of safe autopilot_config keys — logged to audit_logs.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { filterAllowedConfig } from './safety';
import { auditLog } from '@/lib/audit/log';

export const RECOMMENDATION_CONFIGS: Record<string, Record<string, unknown>> = {
  improve_onboarding: {
    cta_placement: 'top',
    show_partial_ai_earlier: true,
  },
};

export interface ApplyAutopilotConfigResult {
  ok: boolean;
  applied: Record<string, unknown>;
  changedKeys: string[];
  error?: string;
}

export async function applyAutopilotConfigByKey(
  recommendationKey: string,
  userId: string | null,
  source: 'manual_apply' | 'ceo_apply' = 'manual_apply',
  ip?: string | null,
  overrides?: Record<string, unknown>,
): Promise<ApplyAutopilotConfigResult> {
  const preset = RECOMMENDATION_CONFIGS[recommendationKey];
  if (!preset && !overrides) {
    return {
      ok: false,
      applied: {},
      changedKeys: [],
      error: `Unknown recommendation key: ${recommendationKey}`,
    };
  }

  const filtered = filterAllowedConfig({ ...preset, ...overrides });
  if (Object.keys(filtered).length === 0) {
    return {
      ok: false,
      applied: {},
      changedKeys: [],
      error: 'No safe config keys to apply',
    };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const changedKeys = Object.keys(filtered);

  for (const [key, value] of Object.entries(filtered)) {
    await admin.from('autopilot_config').upsert({
      key,
      value,
      updated_at: now,
    });
  }

  auditLog({
    userId,
    action: 'autopilot_config_update',
    metadata: {
      source,
      recommendation_key: recommendationKey,
      changed_keys: changedKeys,
      timestamp: now,
      config: filtered,
    },
    ip,
  });

  return { ok: true, applied: filtered, changedKeys };
}
