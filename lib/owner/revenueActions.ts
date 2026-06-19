import type { OwnerProspect } from './types';
import { computeIcpQueueSnapshot } from './icpGate';

export interface CustomerAcquisitionSnapshot {
  draftsReady: number;
  sendQueue: number;
  formQueue: number;
  needsContactEnrichment: number;
  manualReview: number;
  rejectedNotIcp: number;
  needsRescan: number;
  agenciesWithEvidence: number;
  weakWebsitesTotal: number;
  privateBusinessWithContact: number;
  summaryLine: string;
  nextRecommendedAction: string;
}

export function computeCustomerAcquisitionSnapshot(
  prospects: OwnerProspect[],
  pendingApprovals = 0,
): CustomerAcquisitionSnapshot {
  const icp = computeIcpQueueSnapshot(prospects);
  let needsRescan = 0;
  let agenciesWithEvidence = 0;
  let weakWebsitesTotal = 0;

  for (const p of prospects) {
    if (p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever') continue;
    if (p.scan_status === 'pending' || p.scan_status === 'failed') needsRescan++;
    if (
      p.prospect_kind === 'agency' &&
      p.manages_client_sites === true &&
      (p.agency_label === 'AGENCY HOT' || p.agency_label === 'AGENCY WARM' || p.agency_label === 'AGENCY LOW')
    ) {
      agenciesWithEvidence++;
    }
    if (p.scan_status === 'completed' && (p.scan_score ?? 100) <= 70) weakWebsitesTotal++;
  }

  let nextRecommendedAction = 'Find customers — scan private business websites';
  if (pendingApprovals > 0) nextRecommendedAction = 'Review send queue drafts';
  else if (icp.sendQueue > 0) nextRecommendedAction = 'Review email-ready send queue';
  else if (icp.formQueue > 0) nextRecommendedAction = 'Open contact forms for form-queue leads';
  else if (icp.needsContact > 0) nextRecommendedAction = 'Enrich contacts on buyer-fit prospects';
  else if (icp.manualReview > 0) nextRecommendedAction = 'Review manual-review leads first';
  else if (needsRescan > 0) nextRecommendedAction = 'Rescan pending prospects';

  return {
    draftsReady: pendingApprovals,
    sendQueue: icp.sendQueue,
    formQueue: icp.formQueue,
    needsContactEnrichment: icp.needsContact,
    manualReview: icp.manualReview,
    rejectedNotIcp: icp.rejectedNotIcp,
    needsRescan,
    agenciesWithEvidence,
    weakWebsitesTotal,
    privateBusinessWithContact: icp.privateBusinessWithContact,
    summaryLine: icp.summaryLine,
    nextRecommendedAction,
  };
}
