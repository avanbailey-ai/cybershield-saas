import type { SupabaseClient } from '@supabase/supabase-js';
import { getAutoArchiveSettings } from './autoArchive';

export interface StaleDataHygieneResult {
  collapsedDiscoveryRuns: number;
  expiredDrafts: number;
  removedInboxDismissals: number;
  archivedNoContact: number;
}

const DRAFT_EXPIRY_DAYS = 14;
const NO_CONTACT_ARCHIVE_DAYS = 30;
const DISCOVERY_RUN_KEEP = 5;

export async function runStaleDataHygiene(
  admin: SupabaseClient,
): Promise<StaleDataHygieneResult> {
  const result: StaleDataHygieneResult = {
    collapsedDiscoveryRuns: 0,
    expiredDrafts: 0,
    removedInboxDismissals: 0,
    archivedNoContact: 0,
  };

  const { data: runs } = await admin
    .from('owner_discovery_runs')
    .select('id')
    .order('created_at', { ascending: false });

  const runIds = (runs ?? []).map((r) => r.id as string);
  if (runIds.length > DISCOVERY_RUN_KEEP) {
    const staleIds = runIds.slice(DISCOVERY_RUN_KEEP);
    await admin.from('owner_discovery_runs').delete().in('id', staleIds);
    result.collapsedDiscoveryRuns = staleIds.length;
  }

  const draftCutoff = new Date(Date.now() - DRAFT_EXPIRY_DAYS * 86400000).toISOString();
  const { data: staleDrafts } = await admin
    .from('owner_outreach_drafts')
    .select('id')
    .eq('status', 'draft')
    .is('deleted_at', null)
    .lt('created_at', draftCutoff);

  for (const d of staleDrafts ?? []) {
    await admin
      .from('owner_outreach_drafts')
      .update({
        status: 'draft',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', d.id);
    result.expiredDrafts++;
  }

  const dismissCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: oldDismissals } = await admin
    .from('owner_inbox_dismissals')
    .select('id')
    .lt('dismissed_at', dismissCutoff);

  if (oldDismissals?.length) {
    await admin
      .from('owner_inbox_dismissals')
      .delete()
      .in(
        'id',
        oldDismissals.map((d) => d.id),
      );
    result.removedInboxDismissals = oldDismissals.length;
  }

  const settings = await getAutoArchiveSettings(admin);
  const noContactCutoff = new Date(
    Date.now() - Math.min(settings.prospectInactiveDays, NO_CONTACT_ARCHIVE_DAYS) * 86400000,
  ).toISOString();

  const { data: staleNoContact } = await admin
    .from('owner_prospects')
    .select('id')
    .is('deleted_at', null)
    .is('archived_at', null)
    .in('pipeline_state', ['no_contact_found', 'bad_fit'])
    .lt('updated_at', noContactCutoff);

  for (const p of staleNoContact ?? []) {
    await admin
      .from('owner_prospects')
      .update({
        pipeline_state: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.id);
    result.archivedNoContact++;
  }

  return result;
}
