import { createAdminClient } from '@/lib/supabase/admin';
import { monitorDomainForWebsite } from './handleDomainAfterScan';

export interface DomainMonitorSweepResult {
  examined: number;
  probed: number;
  persisted: number;
  expiryAlertsCreated: number;
  changeAlertsCreated: number;
  errors: number;
}

const BATCH_LIMIT = 100;

/** Weekly sweep for active websites — backup when scans miss domain checks. */
export async function runDomainMonitorSweep(): Promise<DomainMonitorSweepResult> {
  const supabase = createAdminClient();
  const result: DomainMonitorSweepResult = {
    examined: 0,
    probed: 0,
    persisted: 0,
    expiryAlertsCreated: 0,
    changeAlertsCreated: 0,
    errors: 0,
  };

  const { data: websites, error } = await supabase
    .from('websites')
    .select('id, url, user_id, org_id')
    .eq('is_active', true)
    .order('last_scanned_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  if (error || !websites) {
    console.error('[domain-sweep] fetch websites failed:', error);
    return result;
  }

  for (const website of websites) {
    result.examined++;
    try {
      const monitorResult = await monitorDomainForWebsite({
        websiteId: website.id,
        websiteUrl: website.url,
        userId: website.user_id,
        orgId: website.org_id,
        scanId: null,
      });

      if (monitorResult.probed) result.probed++;
      if (monitorResult.persisted) result.persisted++;
      result.expiryAlertsCreated += monitorResult.expiryAlertsCreated;
      result.changeAlertsCreated += monitorResult.changeAlertsCreated;
    } catch (err) {
      result.errors++;
      console.error('[domain-sweep] website failed:', website.id, err);
    }
  }

  return result;
}
