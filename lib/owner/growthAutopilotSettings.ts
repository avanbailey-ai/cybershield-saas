import type { SupabaseClient } from '@supabase/supabase-js';

/** Safe growth autopilot modes — Mode 3 (limited) never enabled by default. */
export type GrowthAutopilotMode = 'manual' | 'assisted' | 'limited' | 'paused';

export interface GrowthAutopilotSettings {
  mode: GrowthAutopilotMode;
  /** Nightly cron prepares work (discover/scan/draft) — always true by default. */
  prepare_only: boolean;
  discovery_enabled: boolean;
  scanning_enabled: boolean;
  contact_finding_enabled: boolean;
  draft_generation_enabled: boolean;
  follow_ups_enabled: boolean;
  /** Limited mode only — never auto-enabled. */
  limited_autopilot_sending: boolean;
  /** Warmup week 1–3 caps enforced by deliverability guard unless overridden. */
  warmup_week: 1 | 2 | 3;
  global_discovery_enabled: boolean;
}

export const DEFAULT_GROWTH_AUTOPILOT_SETTINGS: GrowthAutopilotSettings = {
  mode: 'manual',
  prepare_only: true,
  discovery_enabled: true,
  scanning_enabled: true,
  contact_finding_enabled: true,
  draft_generation_enabled: true,
  follow_ups_enabled: true,
  limited_autopilot_sending: false,
  warmup_week: 1,
  global_discovery_enabled: false,
};

export const AUTOPILOT_MODE_LABELS: Record<GrowthAutopilotMode, string> = {
  manual: 'Manual — you approve every send',
  assisted: 'Assisted — system recommends, you bulk-approve',
  limited: 'Limited autopilot — low-risk sends only (requires healthy deliverability)',
  paused: 'Paused — no sending; discovery/scan may continue',
};

export async function getGrowthAutopilotSettings(
  admin: SupabaseClient,
): Promise<GrowthAutopilotSettings> {
  const { data } = await admin
    .from('owner_founder_settings')
    .select('value')
    .eq('key', 'growth_autopilot')
    .maybeSingle();

  if (!data?.value) return DEFAULT_GROWTH_AUTOPILOT_SETTINGS;
  const merged = { ...DEFAULT_GROWTH_AUTOPILOT_SETTINGS, ...(data.value as GrowthAutopilotSettings) };
  // Safety: never persist limited sending without explicit opt-in each load
  if (merged.mode !== 'limited') {
    merged.limited_autopilot_sending = false;
  }
  return merged;
}

export async function saveGrowthAutopilotSettings(
  admin: SupabaseClient,
  partial: Partial<GrowthAutopilotSettings>,
): Promise<GrowthAutopilotSettings> {
  const current = await getGrowthAutopilotSettings(admin);
  const settings: GrowthAutopilotSettings = { ...current, ...partial };
  if (settings.mode !== 'limited') {
    settings.limited_autopilot_sending = false;
  }
  if (settings.mode === 'paused') {
    settings.limited_autopilot_sending = false;
  }
  await admin.from('owner_founder_settings').upsert({
    key: 'growth_autopilot',
    value: settings,
    updated_at: new Date().toISOString(),
  });
  return settings;
}
