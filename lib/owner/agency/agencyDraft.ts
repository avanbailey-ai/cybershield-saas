/**
 * Bridges an owner_prospects row to the agency outreach generator. Used by
 * draft creation, bulk generation, and regeneration so agency prospects get the
 * agency generator while SMB prospects keep the SMB generator untouched.
 */

import { generateAgencyOutreach } from './agencyOutreach';
import type { AgencyType } from './agencyTypes';

/** The outreach_type stored for agency drafts (kept out of the SMB TEMPLATES map). */
export const AGENCY_OUTREACH_TYPE = 'agency_email';

export function isAgencyProspect(prospect: Record<string, unknown> | null | undefined): boolean {
  return (prospect?.prospect_kind as string) === 'agency';
}

export function buildAgencyDraftContent(
  prospect: Record<string, unknown>,
  signupUrl?: string | null,
): string {
  const services = prospect.detected_services;
  return generateAgencyOutreach({
    agencyName: (prospect.business_name as string) ?? 'your agency',
    website: (prospect.website as string) ?? '',
    contactName: null,
    agencyType: (prospect.agency_type as AgencyType) ?? null,
    detectedServices: Array.isArray(services) ? (services as string[]) : [],
    estimatedSiteCount: (prospect.estimated_site_count as number | null) ?? null,
    managesClientSites: (prospect.manages_client_sites as boolean | null) ?? null,
    city: (prospect.city as string | null) ?? null,
    signupUrl: signupUrl ?? null,
  });
}
