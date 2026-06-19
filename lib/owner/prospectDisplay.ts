import {
  computeOpportunityScore,
  computePlanFit,
  conversionLikelihoodFromScore,
} from './salesIntelligence';
import { isOutreachReadyContact } from './prospectQualityBrain';
import { AGENCY_PLAN_PRICE } from './agency/agencyScore';
import type { OwnerProspect } from './types';
import type { ContactSignals } from './contactDiscovery';

function signalsFromProspect(p: OwnerProspect): ContactSignals {
  return {
    contact_page_found: p.contact_page_found ?? false,
    contact_email_found: p.contact_email_found ?? false,
    contact_phone_found: p.contact_phone_found ?? false,
    contact_linkedin_found: p.contact_linkedin_found ?? false,
    contact_email: p.contact_email ?? null,
    contact_phone: p.contact_phone ?? null,
    contact_linkedin: p.contact_linkedin ?? null,
    contact_confidence: (p.contact_confidence as ContactSignals['contact_confidence']) ?? 'no_contact',
  };
}

/** Resolve opportunity score and plan fit at read time when DB fields are missing. */
export function resolveProspectScores(p: OwnerProspect): OwnerProspect {
  const signals = signalsFromProspect(p);
  const scanCompleted = p.scan_status === 'completed';
  const issueCount = Array.isArray(p.scan_findings?.issues) ? p.scan_findings!.issues!.length : 0;

  const scanIssues = Array.isArray(p.scan_findings?.issues)
    ? (p.scan_findings!.issues as string[])
    : undefined;

  const scoreInput = {
    website: p.website,
    industry: p.industry,
    businessName: p.business_name,
    scanScore: p.scan_score,
    scanRiskLevel: p.scan_risk_level,
    leadScore: p.lead_score,
    scanCompleted,
    httpValid: p.http_valid,
    dnsValid: p.dns_valid,
    signals,
    issueCount,
    scanIssues,
  };

  const computedScore =
    p.opportunity_score != null && p.opportunity_score > 0
      ? p.opportunity_score
      : computeOpportunityScore(scoreInput);

  const kind = p.prospect_kind === 'agency' ? 'agency' : 'smb';

  let computedPlanFit: number | null;
  if (kind === 'agency') {
    computedPlanFit = AGENCY_PLAN_PRICE;
  } else {
    const stored = p.estimated_plan_fit;
    const useStored = stored != null && stored > 0 && stored !== AGENCY_PLAN_PRICE;
    computedPlanFit = useStored ? stored : computePlanFit(scoreInput, computedScore, 'smb');
  }

  const conversion =
    p.conversion_likelihood != null && p.conversion_likelihood > 0
      ? p.conversion_likelihood
      : conversionLikelihoodFromScore(computedScore);

  return {
    ...p,
    opportunity_score: computedScore,
    estimated_plan_fit: computedPlanFit,
    conversion_likelihood: conversion,
  };
}

export function resolveProspectList(prospects: OwnerProspect[]): OwnerProspect[] {
  return prospects.map(resolveProspectScores);
}

export function hasOutreachContact(p: OwnerProspect): boolean {
  if (!p.contact_email?.trim()) return false;
  return isOutreachReadyContact(p.contact_confidence as never);
}

export function effectiveOutreachEmail(
  prospect: OwnerProspect,
  draftEmail?: string | null,
): string | null {
  return prospect.contact_email?.trim() || draftEmail?.trim() || null;
}

export function isTrulyOutreachReady(p: OwnerProspect): boolean {
  const state = p.pipeline_state ?? 'new_discovery';
  const label = p.quality_label;
  const qualityOk = label === 'HOT' || label === 'WARM' || !label;
  return (
    state === 'outreach_ready' &&
    hasOutreachContact(p) &&
    qualityOk &&
    p.scan_status === 'completed'
  );
}

/** Founder OS prospect segmentation: SMB pipeline vs Agency pipeline. */
export type ProspectKindView = 'smb' | 'agency' | 'all';

export function isAgencyKind(p: OwnerProspect): boolean {
  return p.prospect_kind === 'agency';
}

export function prospectMatchesKind(p: OwnerProspect, view: ProspectKindView): boolean {
  if (view === 'all') return true;
  return view === 'agency' ? isAgencyKind(p) : !isAgencyKind(p);
}

export function filterProspectsByKind(
  prospects: OwnerProspect[],
  view: ProspectKindView,
): OwnerProspect[] {
  return prospects.filter((p) => prospectMatchesKind(p, view));
}

export function countAgencyProspects(prospects: OwnerProspect[]): number {
  return prospects.filter(isAgencyKind).length;
}
