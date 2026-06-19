import { discoverContactSignals, type ContactSignals } from './contactDiscovery';
import {
  buildQualificationReasons,
  buildSelectionReason,
  computeOpportunityScore,
  computePlanFit,
  conversionLikelihoodFromScore,
  type OpportunityScoreInput,
} from './salesIntelligence';
import type { LeadScore } from './types';
import {
  assessProspectQuality,
  qualityFieldsFromAssessment,
  type ContactConfidence,
  type QualityLabel,
  type QualityStage,
  type RejectionReason,
} from './prospectQualityBrain';
import type { ProspectPipelineState } from './discovery/types';

export interface ProspectEnrichmentInput {
  business_name: string;
  website: string;
  industry: string | null;
  scan_score?: number | null;
  scan_risk_level?: string | null;
  lead_score?: LeadScore | null;
  scan_status?: string;
  dns_valid?: boolean | null;
  http_valid?: boolean | null;
  scan_findings?: { issues?: string[] } | null;
  contact_signals?: ContactSignals;
  skipContactFetch?: boolean;
  prospect_kind?: 'smb' | 'agency';
  agency_score?: number | null;
  agency_label?: string | null;
  agency_discovery_mode?: boolean;
}

export interface ProspectEnrichmentResult {
  opportunity_score: number;
  estimated_plan_fit: number | null;
  contact_page_found: boolean;
  contact_email_found: boolean;
  contact_phone_found: boolean;
  contact_linkedin_found: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  contact_linkedin: string | null;
  contact_confidence: ContactConfidence;
  qualification_reasons: string[];
  selection_reason: string;
  conversion_likelihood: number;
  opportunity_priority: number;
  pipeline_state: ProspectPipelineState;
  quality_label: QualityLabel;
  quality_stage: QualityStage;
  rejection_reason: RejectionReason;
  buying_trigger: string | null;
  why_now: string | null;
}

export async function enrichProspect(
  input: ProspectEnrichmentInput,
): Promise<ProspectEnrichmentResult> {
  const signals =
    input.contact_signals ??
    (input.skipContactFetch ? emptySignals() : await discoverContactSignals(input.website));

  const scanCompleted = input.scan_status === 'completed';
  const issueCount = input.scan_findings?.issues?.length ?? 0;

  const scoreInput: OpportunityScoreInput = {
    industry: input.industry,
    businessName: input.business_name,
    scanScore: input.scan_score ?? null,
    scanRiskLevel: input.scan_risk_level ?? null,
    leadScore: input.lead_score ?? null,
    scanCompleted,
    httpValid: input.http_valid,
    dnsValid: input.dns_valid,
    signals,
    issueCount,
    scanIssues: input.scan_findings?.issues,
  };

  const opportunity_score = computeOpportunityScore(scoreInput);
  const withScore = { ...scoreInput, opportunityScore: opportunity_score };
  const prospectKind = input.prospect_kind ?? 'smb';
  const estimated_plan_fit = computePlanFit(scoreInput, opportunity_score, prospectKind);
  const qualification_reasons = buildQualificationReasons(withScore);
  const selection_reason = buildSelectionReason(withScore);
  const conversion_likelihood = conversionLikelihoodFromScore(opportunity_score);

  const assessment = assessProspectQuality({
    businessName: input.business_name,
    website: input.website,
    industry: input.industry,
    prospectKind,
    scanStatus: input.scan_status ?? 'pending',
    scanCompleted: scanCompleted,
    leadScore: input.lead_score ?? null,
    opportunityScore: opportunity_score,
    agencyScore: input.agency_score ?? null,
    agencyLabel: input.agency_label ?? null,
    signals,
    httpValid: input.http_valid,
    dnsValid: input.dns_valid,
    scanIssues: input.scan_findings?.issues,
    scanRiskLevel: input.scan_risk_level ?? null,
    planFit: estimated_plan_fit,
    agencyDiscoveryMode: input.agency_discovery_mode,
  });
  const qualityFields = qualityFieldsFromAssessment(assessment);

  return {
    opportunity_score,
    estimated_plan_fit,
    contact_page_found: signals.contact_page_found,
    contact_email_found: signals.contact_email_found,
    contact_phone_found: signals.contact_phone_found,
    contact_linkedin_found: signals.contact_linkedin_found,
    contact_email: signals.contact_email,
    contact_phone: signals.contact_phone,
    contact_linkedin: signals.contact_linkedin,
    contact_confidence: signals.contact_confidence,
    qualification_reasons,
    selection_reason,
    conversion_likelihood,
    opportunity_priority: opportunity_score,
    pipeline_state: assessment.pipelineState,
    quality_label: qualityFields.quality_label,
    quality_stage: qualityFields.quality_stage,
    rejection_reason: qualityFields.rejection_reason,
    buying_trigger: qualityFields.buying_trigger,
    why_now: qualityFields.why_now,
  };
}

function emptySignals(): ContactSignals {
  return {
    contact_page_found: false,
    contact_email_found: false,
    contact_phone_found: false,
    contact_linkedin_found: false,
    contact_email: null,
    contact_phone: null,
    contact_linkedin: null,
    contact_confidence: 'no_contact',
  };
}
