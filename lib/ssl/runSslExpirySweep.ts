import { createAdminClient } from '@/lib/supabase/admin';
import { probeCertificate, hostnameFromUrl } from './probeCertificate';
import { persistSslCertificate } from './persistSslCertificate';
import { processSslExpiryAlerts } from './processSslExpiryAlerts';

export interface SslExpirySweepResult {
  examined: number;
  probed: number;
  persisted: number;
  alertsCreated: number;
  errors: number;
}

const BATCH_LIMIT = 100;

/** Daily sweep for active HTTPS websites — backup when scans miss a day. */
export async function runSslExpirySweep(): Promise<SslExpirySweepResult> {
  const supabase = createAdminClient();
  const result: SslExpirySweepResult = {
    examined: 0,
    probed: 0,
    persisted: 0,
    alertsCreated: 0,
    errors: 0,
  };

  const { data: websites, error } = await supabase
    .from('websites')
    .select('id, url, user_id, org_id')
    .eq('is_active', true)
    .ilike('url', 'https://%')
    .order('last_scanned_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT);

  if (error || !websites) {
    console.error('[ssl-sweep] fetch websites failed:', error);
    return result;
  }

  for (const website of websites) {
    result.examined++;
    const host = hostnameFromUrl(website.url);
    if (!host) continue;

    try {
      const certificate = await probeCertificate(host);
      if (!certificate) {
        result.errors++;
        continue;
      }

      result.probed++;
      const certId = await persistSslCertificate({
        websiteId: website.id,
        scanId: null,
        certificate,
      });
      if (certId) result.persisted++;

      const alertResult = await processSslExpiryAlerts({
        websiteId: website.id,
        websiteUrl: website.url,
        userId: website.user_id,
        orgId: website.org_id,
        scanId: null,
        certificate,
      });
      result.alertsCreated += alertResult.alertsCreated;
    } catch (err) {
      result.errors++;
      console.error('[ssl-sweep] website failed:', website.id, err);
    }
  }

  return result;
}
