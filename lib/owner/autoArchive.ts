import type { SupabaseClient } from '@supabase/supabase-js';

export interface AutoArchiveSettings {
  prospectInactiveDays: number;
  campaignCompletedDays: number;
  alertResolvedDays: number;
  scanActivityDays: number;
}

export const DEFAULT_AUTO_ARCHIVE: AutoArchiveSettings = {
  prospectInactiveDays: 90,
  campaignCompletedDays: 30,
  alertResolvedDays: 30,
  scanActivityDays: 60,
};

export async function getAutoArchiveSettings(
  admin: SupabaseClient,
): Promise<AutoArchiveSettings> {
  const { data } = await admin
    .from('owner_founder_settings')
    .select('value')
    .eq('key', 'auto_archive')
    .maybeSingle();

  if (!data?.value) return DEFAULT_AUTO_ARCHIVE;
  return { ...DEFAULT_AUTO_ARCHIVE, ...(data.value as AutoArchiveSettings) };
}

export async function runAutoArchive(admin: SupabaseClient): Promise<{
  prospects: number;
  campaigns: number;
  alerts: number;
}> {
  const settings = await getAutoArchiveSettings(admin);
  const now = Date.now();
  let prospects = 0;
  let campaigns = 0;
  let alerts = 0;

  const prospectCutoff = new Date(
    now - settings.prospectInactiveDays * 86400000,
  ).toISOString();
  const campaignCutoff = new Date(
    now - settings.campaignCompletedDays * 86400000,
  ).toISOString();
  const alertCutoff = new Date(
    now - settings.alertResolvedDays * 86400000,
  ).toISOString();

  const { data: staleProspects } = await admin
    .from('owner_prospects')
    .select('id')
    .is('deleted_at', null)
    .is('archived_at', null)
    .neq('pipeline_state', 'archived')
    .lt('updated_at', prospectCutoff)
    .in('pipeline_state', ['new', 'new_discovery', 'scanned']);

  for (const row of staleProspects ?? []) {
    await admin
      .from('owner_prospects')
      .update({ pipeline_state: 'archived', archived_at: new Date().toISOString() })
      .eq('id', row.id);
    prospects++;
  }

  const { data: staleCampaigns } = await admin
    .from('owner_campaigns')
    .select('id')
    .is('deleted_at', null)
    .is('archived_at', null)
    .eq('status', 'completed')
    .lt('updated_at', campaignCutoff);

  for (const row of staleCampaigns ?? []) {
    await admin
      .from('owner_campaigns')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', row.id);
    campaigns++;
  }

  const { data: staleAlerts } = await admin
    .from('ceo_alerts')
    .select('id')
    .is('deleted_at', null)
    .is('archived_at', null)
    .eq('read', true)
    .lt('created_at', alertCutoff);

  for (const row of staleAlerts ?? []) {
    await admin
      .from('ceo_alerts')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', row.id);
    alerts++;
  }

  return { prospects, campaigns, alerts };
}
