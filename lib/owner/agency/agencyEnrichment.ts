/**
 * Classifies an already-discovered prospect as an agency by fetching its public
 * site, detecting agency signals, computing the agency-specific opportunity
 * score, and writing the agency columns (prospect_kind='agency', agency_type,
 * agency_opportunity_score, agency_label, detected_services, …).
 *
 * SMB scoring/pipeline fields are left untouched — agencies still flow through
 * the normal pipeline states so the existing approval/send system applies.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAgencySignals } from './agencyDetect';
import { scoreAgency, decideProspectKind } from './agencyScore';
import type { AgencyType } from './agencyTypes';
import { assessProspectQuality, qualityFieldsFromAssessment } from '../prospectQualityBrain';
import { enrichProspect } from '../prospectEnrichment';

export interface AgencyClassifyResult {
  ok: boolean;
  isAgency: boolean;
  score?: number;
  label?: string;
  agencyType?: AgencyType;
}

export async function classifyAgencyProspect(
  admin: SupabaseClient,
  prospectId: string,
  preferredType?: AgencyType | null,
  opts?: { agencyDiscoveryMode?: boolean },
): Promise<AgencyClassifyResult> {
  const { data: prospect } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', prospectId)
    .maybeSingle();

  if (!prospect) return { ok: false, isAgency: false };

  const { signals, agencyType } = await fetchAgencySignals(prospect.website as string);
  const resolvedType: AgencyType =
    agencyType !== 'unknown'
      ? agencyType
      : preferredType && preferredType !== 'unknown'
        ? preferredType
        : 'unknown';

  const result = scoreAgency({
    businessName: prospect.business_name as string,
    industry: prospect.industry as string | null,
    website: prospect.website as string,
    signals,
    agencyType: resolvedType,
    hasContactEmail: Boolean((prospect.contact_email as string | null)?.trim()),
    httpValid: prospect.http_valid as boolean | null,
    dnsValid: prospect.dns_valid as boolean | null,
  });

  const kind = decideProspectKind({ ...result, signals });
  const isAgency = kind === 'agency';
  const storedAgencyType: AgencyType = isAgency ? resolvedType : 'unknown';

  const enrichment = await enrichProspect({
    business_name: prospect.business_name as string,
    website: prospect.website as string,
    industry: prospect.industry as string | null,
    scan_status: (prospect.scan_status as string) ?? 'pending',
    scan_score: prospect.scan_score as number | null,
    scan_risk_level: prospect.scan_risk_level as string | null,
    lead_score: prospect.lead_score as never,
    dns_valid: prospect.dns_valid as boolean | null,
    http_valid: prospect.http_valid as boolean | null,
    scan_findings: prospect.scan_findings as { issues?: string[] } | null,
    skipContactFetch: true,
    prospect_kind: kind,
    agency_score: result.score,
    agency_label: result.label,
    agency_discovery_mode: opts?.agencyDiscoveryMode,
  });

  const assessment = assessProspectQuality({
    businessName: prospect.business_name as string,
    website: prospect.website as string,
    industry: prospect.industry as string | null,
    prospectKind: kind,
    scanStatus: (prospect.scan_status as string) ?? 'pending',
    scanCompleted: prospect.scan_status === 'completed',
    leadScore: prospect.lead_score as never,
    opportunityScore: enrichment.opportunity_score,
    agencyScore: result.score,
    agencyLabel: result.label,
    signals: {
      contact_page_found: prospect.contact_page_found ?? false,
      contact_email_found: prospect.contact_email_found ?? false,
      contact_phone_found: prospect.contact_phone_found ?? false,
      contact_linkedin_found: prospect.contact_linkedin_found ?? false,
      contact_email: prospect.contact_email as string | null,
      contact_phone: prospect.contact_phone as string | null,
      contact_linkedin: prospect.contact_linkedin as string | null,
      contact_confidence: enrichment.contact_confidence,
    },
    httpValid: prospect.http_valid as boolean | null,
    dnsValid: prospect.dns_valid as boolean | null,
    scanIssues: (prospect.scan_findings as { issues?: string[] } | null)?.issues,
    planFit: isAgency ? result.estimatedMrr : enrichment.estimated_plan_fit,
    agencyDiscoveryMode: opts?.agencyDiscoveryMode,
    rejectionReason:
      !isAgency && opts?.agencyDiscoveryMode ? 'not_agency_fit' : enrichment.rejection_reason,
  });

  const qualityFields = qualityFieldsFromAssessment(assessment);
  let pipelineState = enrichment.pipeline_state;
  if (!isAgency && opts?.agencyDiscoveryMode) {
    pipelineState = 'bad_fit';
    qualityFields.quality_label = 'REJECTED';
    qualityFields.rejection_reason = 'not_agency_fit';
  }

  const { error } = await admin
    .from('owner_prospects')
    .update({
      prospect_kind: kind,
      agency_type: storedAgencyType,
      agency_opportunity_score: result.score,
      agency_label: result.label,
      detected_services: result.detectedServices,
      estimated_site_count: result.estimatedSiteCount,
      manages_client_sites: result.managesClientSites,
      agency_why_selected: result.whySelected,
      estimated_plan_fit: isAgency ? result.estimatedMrr : enrichment.estimated_plan_fit,
      estimated_mrr: isAgency ? result.estimatedMrr : enrichment.estimated_plan_fit,
      estimated_arr: isAgency ? result.estimatedArr : enrichment.estimated_plan_fit ? enrichment.estimated_plan_fit * 12 : null,
      pipeline_state: pipelineState,
      ...qualityFields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId);

  if (error) return { ok: false, isAgency };

  return {
    ok: true,
    isAgency,
    score: result.score,
    label: result.label,
    agencyType: resolvedType,
  };
}
