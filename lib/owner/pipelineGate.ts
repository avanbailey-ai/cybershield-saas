/**
 * Whole-pipeline buyer-fit gate — single canonical resolver for queue placement,
 * contact readiness, outreach eligibility, and recommended actions across Founder OS.
 */

import type { OwnerProspect } from './types';
import {
  evaluateBuyerFit,
  contactQueueStatus,
  isEmailSendEligible,
  isFormQueueEligible,
  allowedActionsForIcp,
  computeIcpQueueSnapshot,
  type BuyerFitEvaluation,
  type ContactQueueStatus,
  type RevenueQueue,
  type GatedQualityLabel,
} from './icpGate';
import { resolveProspectScores } from './prospectDisplay';
import { recommendedOutreachAction } from './prospectVerdict';
import { activeProspects } from './prospectFilters';

export type PrimaryQueue = RevenueQueue;

export const QUEUE_LABELS: Record<PrimaryQueue, string> = {
  send_queue: 'Send Queue',
  form_queue: 'Contact Form Actions',
  needs_contact: 'Needs Contact',
  manual_review: 'Manual Review',
  rejected_not_icp: 'Rejected / Not ICP',
  not_urgent: 'Not Urgent',
};

export interface PipelineVerdict {
  fit: BuyerFitEvaluation;
  queue: PrimaryQueue;
  queueLabel: string;
  contactReadiness: ContactQueueStatus;
  sendQueueEligible: boolean;
  formQueueEligible: boolean;
  emailDraftAllowed: boolean;
  displayQualityLabel: GatedQualityLabel;
  displayPlanFit: number | null;
  blockReason: string | null;
  recommendedAction: { label: string; action: string };
}

const DRAFT_BLOCK_PREFIX = 'Draft blocked — buyer-fit/contact rules failed';

export function resolvePipelineVerdict(raw: OwnerProspect): PipelineVerdict {
  const p = resolveProspectScores(raw);
  const fit = evaluateBuyerFit(p);
  return {
    fit,
    queue: fit.revenueQueue,
    queueLabel: QUEUE_LABELS[fit.revenueQueue],
    contactReadiness: fit.contactStatus,
    sendQueueEligible: fit.sendQueueEligible,
    formQueueEligible: fit.formQueueEligible,
    emailDraftAllowed: fit.emailDraftAllowed,
    displayQualityLabel: fit.qualityLabel,
    displayPlanFit: fit.planFit,
    blockReason: fit.blockReason,
    recommendedAction: recommendedOutreachAction(p),
  };
}

export function resolveQueuePlacement(p: OwnerProspect): PrimaryQueue {
  return evaluateBuyerFit(resolveProspectScores(p)).revenueQueue;
}

export function resolveContactReadiness(p: OwnerProspect): ContactQueueStatus {
  return contactQueueStatus(resolveProspectScores(p));
}

export function resolveOutreachEligibility(p: OwnerProspect): {
  sendQueue: boolean;
  emailDraft: boolean;
  formQueue: boolean;
} {
  const resolved = resolveProspectScores(p);
  return {
    sendQueue: isEmailSendEligible(resolved),
    emailDraft: evaluateBuyerFit(resolved).emailDraftAllowed,
    formQueue: isFormQueueEligible(resolved),
  };
}

export function resolveRecommendedAction(p: OwnerProspect): { label: string; action: string } {
  return recommendedOutreachAction(resolveProspectScores(p));
}

export function classifyProspectsByQueue(prospects: OwnerProspect[]): Record<PrimaryQueue, OwnerProspect[]> {
  const buckets: Record<PrimaryQueue, OwnerProspect[]> = {
    send_queue: [],
    form_queue: [],
    needs_contact: [],
    manual_review: [],
    rejected_not_icp: [],
    not_urgent: [],
  };

  for (const raw of activeProspects(prospects)) {
    const queue = resolveQueuePlacement(raw);
    buckets[queue].push(resolveProspectScores(raw));
  }

  return buckets;
}

export function filterProspectsForQueue(prospects: OwnerProspect[], queue: PrimaryQueue): OwnerProspect[] {
  return classifyProspectsByQueue(prospects)[queue];
}

export function isDraftBlocked(
  prospect: OwnerProspect,
  draft?: { send_error?: string | null },
): boolean {
  if (draft?.send_error?.startsWith(DRAFT_BLOCK_PREFIX)) return true;
  return !isEmailSendEligible(resolveProspectScores(prospect));
}

export function draftBlockReason(
  prospect: OwnerProspect,
  draft?: { send_error?: string | null },
): string | null {
  if (draft?.send_error?.startsWith(DRAFT_BLOCK_PREFIX)) return draft.send_error;
  const fit = evaluateBuyerFit(resolveProspectScores(prospect));
  if (!fit.sendQueueEligible) {
    return fit.blockReason
      ? `${DRAFT_BLOCK_PREFIX}: ${fit.blockReason}`
      : `${DRAFT_BLOCK_PREFIX}: Buyer-fit/contact rules failed`;
  }
  return null;
}

export { computeIcpQueueSnapshot, allowedActionsForIcp, evaluateBuyerFit };
