import type { OwnerProspect } from './types';
import {
  contactPathForProspect,
  isWeakScanScore,
  revenueStatusForProspect,
} from './revenueEngine';

export interface CustomerAcquisitionSnapshot {
  draftsReady: number;
  weakWithEmail: number;
  weakWithContactForm: number;
  needsContactEnrichment: number;
  needsRescan: number;
  agenciesWithEvidence: number;
  weakWebsitesTotal: number;
  contactPathsTotal: number;
  summaryLine: string;
  nextRecommendedAction: string;
}

export function computeCustomerAcquisitionSnapshot(
  prospects: OwnerProspect[],
  pendingApprovals = 0,
): CustomerAcquisitionSnapshot {
  let weakWithEmail = 0;
  let weakWithContactForm = 0;
  let needsContactEnrichment = 0;
  let needsRescan = 0;
  let agenciesWithEvidence = 0;
  let weakWebsitesTotal = 0;

  for (const p of prospects) {
    if (p.pipeline_state === 'archived' || p.pipeline_state === 'ignore_forever') continue;

    const weak =
      isWeakScanScore(p.scan_score, p.scan_risk_level) ||
      revenueStatusForProspect(p) === 'needs_contact';
    if (weak && p.scan_status === 'completed') weakWebsitesTotal++;

    const path = contactPathForProspect(p);
    if (weak && (path === 'contact_form_ready' || path === 'contact_page_ready')) weakWithContactForm++;
    else if (weak && path !== 'no_contact_found' && path !== 'phone_only') weakWithEmail++;

    if (
      p.pipeline_state === 'needs_contact' ||
      p.pipeline_state === 'no_contact_found' ||
      (weak && path === 'no_contact_found' && p.scan_status === 'completed')
    ) {
      needsContactEnrichment++;
    }

    if (p.scan_status === 'pending' || p.scan_status === 'failed') needsRescan++;

    if (
      p.prospect_kind === 'agency' &&
      p.manages_client_sites === true &&
      (p.agency_label === 'AGENCY HOT' || p.agency_label === 'AGENCY WARM' || p.agency_label === 'AGENCY LOW')
    ) {
      agenciesWithEvidence++;
    }
  }

  const contactPathsTotal = weakWithEmail + weakWithContactForm;
  const summaryLine = `Today: ${weakWebsitesTotal} weak websites · ${contactPathsTotal} contact paths · ${pendingApprovals} drafts ready · ${needsContactEnrichment} need contact enrichment`;

  let nextRecommendedAction = 'Find customers — scan websites for weak security scores';
  if (pendingApprovals > 0) nextRecommendedAction = 'Review drafts ready for approval';
  else if (weakWithContactForm > 0)
    nextRecommendedAction = 'Open contact forms for weak-score sites';
  else if (needsContactEnrichment > 0)
    nextRecommendedAction = 'Enrich contacts on weak-score prospects';
  else if (needsRescan > 0) nextRecommendedAction = 'Rescan pending prospects';

  return {
    draftsReady: pendingApprovals,
    weakWithEmail,
    weakWithContactForm,
    needsContactEnrichment,
    needsRescan,
    agenciesWithEvidence,
    weakWebsitesTotal,
    contactPathsTotal,
    summaryLine,
    nextRecommendedAction,
  };
}
