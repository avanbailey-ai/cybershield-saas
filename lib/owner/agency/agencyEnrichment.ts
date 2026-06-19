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
): Promise<AgencyClassifyResult> {
  const { data: prospect } = await admin
    .from('owner_prospects')
    .select('*')
    .eq('id', prospectId)
    .maybeSingle();

  if (!prospect) return { ok: false, isAgency: false };

  const { signals, agencyType } = await fetchAgencySignals(prospect.website as string);
  const resolvedType: AgencyType =
    preferredType && preferredType !== 'unknown'
      ? preferredType
      : agencyType;

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

  // Only place a prospect in the agency segment when it meets a real agency
  // threshold (see decideProspectKind). NOT-AGENCY-FIT / weak rows stay 'smb'.
  // We still persist the agency scoring details either way so the analysis isn't
  // lost — the agency views/filters key off prospect_kind, not these columns.
  const kind = decideProspectKind(result);
  const isAgency = kind === 'agency';

  const { error } = await admin
    .from('owner_prospects')
    .update({
      prospect_kind: kind,
      agency_type: resolvedType,
      agency_opportunity_score: result.score,
      agency_label: result.label,
      detected_services: result.detectedServices,
      estimated_site_count: result.estimatedSiteCount,
      manages_client_sites: result.managesClientSites,
      agency_why_selected: result.whySelected,
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
