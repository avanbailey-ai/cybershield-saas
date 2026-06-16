import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { updateOrgIntelligence } from './updateOrgIntelligence';

export type BackfillOrgIntelligenceResult = {
  orgIds: string[];
  processed: number;
  errors: Array<{ orgId: string; message: string }>;
};

/** One-time repair: persist rolling risk, posture, anomalies, narratives for all orgs with scans. */
export async function backfillOrgIntelligenceForAllOrgs(): Promise<BackfillOrgIntelligenceResult> {
  const admin = createAdminClient();

  const { data: orgRows, error } = await admin
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const orgIds = (orgRows ?? []).map((row) => row.id as string);
  const errors: BackfillOrgIntelligenceResult['errors'] = [];
  let processed = 0;

  for (const orgId of orgIds) {
    const { count } = await admin
      .from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'completed');

    if (!count) continue;

    try {
      await updateOrgIntelligence(orgId);
      processed++;
    } catch (err) {
      errors.push({
        orgId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { orgIds, processed, errors };
}
