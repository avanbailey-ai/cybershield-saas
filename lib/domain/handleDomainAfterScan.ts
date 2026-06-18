import { probeDomainForUrl } from './probeDomain';
import {
  fetchPreviousDomainSnapshot,
  persistDomainSnapshot,
} from './persistDomainSnapshot';
import { processDomainChangeAlerts } from './processDomainChangeAlerts';
import { processDomainExpiryAlerts } from './processDomainExpiryAlerts';

export interface DomainMonitorResult {
  probed: boolean;
  persisted: boolean;
  expiryAlertsCreated: number;
  changeAlertsCreated: number;
}

export async function monitorDomainForWebsite(params: {
  websiteId: string;
  websiteUrl: string;
  userId: string;
  orgId: string | null;
  scanId: string | null;
}): Promise<DomainMonitorResult> {
  const result: DomainMonitorResult = {
    probed: false,
    persisted: false,
    expiryAlertsCreated: 0,
    changeAlertsCreated: 0,
  };

  const snapshot = await probeDomainForUrl(params.websiteUrl);
  if (!snapshot) return result;

  result.probed = true;
  const previous = await fetchPreviousDomainSnapshot(params.websiteId);

  const snapshotId = await persistDomainSnapshot({
    websiteId: params.websiteId,
    scanId: params.scanId,
    snapshot,
  });
  if (snapshotId) result.persisted = true;

  const expiryResult = await processDomainExpiryAlerts({
    websiteId: params.websiteId,
    userId: params.userId,
    orgId: params.orgId,
    scanId: params.scanId,
    snapshot,
  });
  result.expiryAlertsCreated = expiryResult.alertsCreated;

  const changeResult = await processDomainChangeAlerts({
    websiteId: params.websiteId,
    userId: params.userId,
    orgId: params.orgId,
    scanId: params.scanId,
    previous,
    current: snapshot,
  });
  result.changeAlertsCreated = changeResult.alertsCreated;

  return result;
}
