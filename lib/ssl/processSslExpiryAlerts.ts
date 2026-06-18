import { createAdminClient } from '@/lib/supabase/admin';
import { recordAlertEvent } from '@/lib/alerts/alertEvents';
import { hostnameFromUrl } from './probeCertificate';
import {
  crossedExpiryThresholds,
  expiryAlertMessage,
  expiryAlertTitle,
  severityForExpiryThreshold,
} from './sslStatus';
import type { SslCertificateInfo } from './types';

export interface ProcessSslExpiryAlertsResult {
  alertsCreated: number;
  thresholdsFired: number[];
}

export async function processSslExpiryAlerts(params: {
  websiteId: string;
  websiteUrl: string;
  userId: string;
  orgId: string | null;
  scanId: string | null;
  certificate: SslCertificateInfo;
}): Promise<ProcessSslExpiryAlertsResult> {
  const supabase = createAdminClient();
  const { websiteId, websiteUrl, userId, orgId, scanId, certificate } = params;
  const hostname = hostnameFromUrl(websiteUrl) ?? websiteUrl;
  const thresholds = crossedExpiryThresholds(certificate.daysUntilExpiry);

  let alertsCreated = 0;
  const thresholdsFired: number[] = [];

  for (const thresholdDays of thresholds) {
    const { data: existing } = await supabase
      .from('ssl_expiry_alerts')
      .select('id')
      .eq('website_id', websiteId)
      .eq('threshold_days', thresholdDays)
      .eq('cert_expires_at', certificate.expiresAt)
      .maybeSingle();

    if (existing?.id) continue;

    const severity = severityForExpiryThreshold(thresholdDays);
    const title = expiryAlertTitle(hostname, thresholdDays);
    const message = expiryAlertMessage(
      hostname,
      thresholdDays,
      certificate.expiresAt,
      certificate.issuer,
    );

    const { data: alertRow, error: alertErr } = await supabase
      .from('alerts')
      .insert({
        user_id: userId,
        website_id: websiteId,
        scan_id: scanId,
        org_id: orgId,
        title,
        message,
        severity,
        type: 'ssl_expiry',
        is_read: false,
      })
      .select('id')
      .single();

    if (alertErr) {
      console.error('[ssl] alert insert failed:', alertErr.message);
      continue;
    }

    await recordAlertEvent({
      userId,
      orgId,
      websiteId,
      scanId,
      alertId: alertRow?.id ?? null,
      eventType: 'ssl_expiry',
      severity,
      findingTitle: title,
      message,
      isNew: true,
      isWorsened: thresholdDays <= 7,
    });

    await supabase.from('ssl_expiry_alerts').insert({
      website_id: websiteId,
      threshold_days: thresholdDays,
      cert_expires_at: certificate.expiresAt,
    });

    alertsCreated++;
    thresholdsFired.push(thresholdDays);
  }

  return { alertsCreated, thresholdsFired };
}
