import { createAdminClient } from '@/lib/supabase/admin';
import { recordAlertEvent } from '@/lib/alerts/alertEvents';
import {
  domainChangedAlertMessage,
  domainChangedAlertTitle,
} from './domainStatus';
import { dnsRecordsEqual, formatDnsSummary } from './probeDns';
import type { StoredDomainSnapshot } from './persistDomainSnapshot';
import type { DomainSnapshotInfo } from './types';

export interface ProcessDomainChangeAlertsResult {
  alertsCreated: number;
  typesFired: string[];
}

export async function processDomainChangeAlerts(params: {
  websiteId: string;
  userId: string;
  orgId: string | null;
  scanId: string | null;
  previous: StoredDomainSnapshot | null;
  current: DomainSnapshotInfo;
}): Promise<ProcessDomainChangeAlertsResult> {
  const result: ProcessDomainChangeAlertsResult = { alertsCreated: 0, typesFired: [] };
  const { websiteId, userId, orgId, scanId, previous, current } = params;

  if (!previous) return result;

  const supabase = createAdminClient();
  const domain = current.domain;

  const prevRegistrar = previous.registrar?.trim() ?? '';
  const currRegistrar = current.registrar?.trim() ?? '';
  if (prevRegistrar && currRegistrar && prevRegistrar !== currRegistrar) {
    const title = domainChangedAlertTitle(domain, 'registrar');
    const message = domainChangedAlertMessage(
      domain,
      'registrar',
      prevRegistrar,
      currRegistrar,
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
        severity: 'high',
        type: 'domain_changed',
        is_read: false,
      })
      .select('id')
      .single();

    if (!alertErr) {
      await recordAlertEvent({
        userId,
        orgId,
        websiteId,
        scanId,
        alertId: alertRow?.id ?? null,
        eventType: 'domain_changed',
        severity: 'high',
        findingTitle: title,
        message,
        isNew: true,
        isWorsened: true,
      });
      result.alertsCreated++;
      result.typesFired.push('domain_changed');
    }
  }

  const prevDns = previous.dns_records ?? { a: [], aaaa: [], cname: [] };
  if (!dnsRecordsEqual(prevDns, current.dnsRecords)) {
    const title = domainChangedAlertTitle(domain, 'dns');
    const message = domainChangedAlertMessage(
      domain,
      'dns',
      formatDnsSummary(prevDns),
      formatDnsSummary(current.dnsRecords),
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
        severity: 'medium',
        type: 'dns_changed',
        is_read: false,
      })
      .select('id')
      .single();

    if (!alertErr) {
      await recordAlertEvent({
        userId,
        orgId,
        websiteId,
        scanId,
        alertId: alertRow?.id ?? null,
        eventType: 'dns_changed',
        severity: 'medium',
        findingTitle: title,
        message,
        isNew: true,
      });
      result.alertsCreated++;
      result.typesFired.push('dns_changed');
    }
  }

  return result;
}
