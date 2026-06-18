import type { SupabaseClient } from '@supabase/supabase-js';
import { getResendFromAddress } from '@/lib/email';

export interface OutreachExecutionSettings {
  enable_outreach_sending: boolean;
  daily_outreach_limit: number;
  follow_up_schedule: number[];
  sender_email: string;
  require_approval: boolean;
}

export const DEFAULT_OUTREACH_SETTINGS: OutreachExecutionSettings = {
  enable_outreach_sending: true,
  daily_outreach_limit: 10,
  follow_up_schedule: [3, 7, 14],
  sender_email: getResendFromAddress(),
  require_approval: true,
};

export async function getOutreachSettings(
  admin: SupabaseClient,
): Promise<OutreachExecutionSettings> {
  const { data } = await admin
    .from('owner_founder_settings')
    .select('value')
    .eq('key', 'outreach_execution')
    .maybeSingle();

  if (!data?.value) return DEFAULT_OUTREACH_SETTINGS;
  return { ...DEFAULT_OUTREACH_SETTINGS, ...(data.value as OutreachExecutionSettings) };
}

export async function saveOutreachSettings(
  admin: SupabaseClient,
  partial: Partial<OutreachExecutionSettings>,
): Promise<OutreachExecutionSettings> {
  const current = await getOutreachSettings(admin);
  const settings = { ...current, ...partial };
  await admin.from('owner_founder_settings').upsert({
    key: 'outreach_execution',
    value: settings,
    updated_at: new Date().toISOString(),
  });
  return settings;
}
