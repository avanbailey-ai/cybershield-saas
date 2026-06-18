import { createAdminClient } from '@/lib/supabase/admin';
import { recordAlertEvent } from '@/lib/alerts/alertEvents';
import {
  crossedDomainExpiryThresholds,
  domainExpiryAlertMessage,
  domainExpiryAlertTitle,
  severityForDomainExpiryThreshold,
} from './domainStatus';
import type { DomainSnapshotInfo } from './types';

export interface ProcessDomainExpiryAlertsResult {
  alertsCreated: number;
  thresholdsFired: number[];
}

export async function processDomainExpiryAlerts(params: {
  websiteId: string;
  userId: string;
  orgId: string | null;
  scanId: string | null;
  snapshot: DomainSnapshotInfo;
}): Promise<ProcessDomainExpiryAlertsResult> {
  const result: ProcessDomainExpiryAlertsResult = { alertsCreated: 0, thresholdsFired: [] };

  const { expiresAt, daysUntilExpiry } = params.snapshot;
  if (expiresAt == null || daysUntilExpiry == null) {
    return result;
  }

  const supabase = createAdminClient();
  const { websiteId, userId, orgId, scanId, snapshot } = params;
  const { domain, registrar } = snapshot;
  const thresholds = crossedDomainExpiryThresholds(daysUntilExpiry);

  for (const thresholdDays of thresholds) {
    const { data: existing } = await supabase
      .from('domain_expiry_alerts')
      .select('id')
      .eq('website_id', websiteId)
      .eq('threshold_days', thresholdDays)
      .eq('domain_expires_at', expiresAt)
      .maybeSingle();

    if (existing?.id) continue;

    const severity = severityForDomainExpiryThreshold(thresholdDays);
    const title = domainExpiryAlertTitle(domain, thresholdDays);
    const message = domainExpiryAlertMessage(domain, thresholdDays, expiresAt, registrar);

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
        type: 'domain_expiry',
        is_read: false,
      })
      .select('id')
      .single();

    if (alertErr) {
      console.error('[domain] expiry alert insert failed:', alertErr.message);
      continue;
    }

    await recordAlertEvent({
      userId,
      orgId,
      websiteId,
      scanId,
      alertId: alertRow?.id ?? null,
      eventType: 'domain_expiry',
      severity,
      findingTitle: title,
      message,
      isNew: true,
      isWorsened: thresholdDays <= 14,
    });

    await supabase.from('domain_expiry_alerts').insert({
      website_id: websiteId,
      threshold_days: thresholdDays,
      domain_expires_at: expiresAt,
    });

    result.alertsCreated++;
    result.thresholdsFired.push(thresholdDays);
  }

  return result;
}
