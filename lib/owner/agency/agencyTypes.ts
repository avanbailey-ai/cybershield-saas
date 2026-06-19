/**
 * Agency Prospect System — shared types (Founder OS, owner-only).
 *
 * These describe agencies / MSPs / dev shops that manage client websites, kept
 * deliberately separate from the SMB prospect model so the default SMB pipeline
 * is never affected.
 */

export type AgencyType =
  | 'web_design'
  | 'marketing'
  | 'seo'
  | 'wordpress'
  | 'shopify'
  | 'ecommerce'
  | 'branding'
  | 'creative_studio'
  | 'msp'
  | 'dev_shop'
  | 'unknown';

export type AgencyLabel = 'AGENCY HOT' | 'AGENCY WARM' | 'AGENCY LOW' | 'NOT AGENCY FIT';

/** Public, non-fabricated signals detected from an agency's own website. */
export interface AgencySignals {
  /** Platforms/services mentioned (wordpress, shopify, seo, hosting, care_plan, …) */
  detectedServices: string[];
  /** Evidence the business builds/manages sites for clients (portfolio, "our clients", care plans) */
  managesClientSites: boolean | null;
  hasPortfolio: boolean;
  hasTestimonials: boolean;
  hasServicePackages: boolean;
  mentionsMaintenanceOrCarePlans: boolean;
  mentionsHosting: boolean;
  servesLocalBusinesses: boolean;
  publicContactEmail: boolean;
  freelancerOnly: boolean;
  /** Best-effort count of client sites referenced (e.g. portfolio items). null when unknown. */
  estimatedSiteCount: number | null;
  /** Security/staleness signals on the agency's OWN site (used as a soft positive). */
  ownSiteSecuritySignals: boolean;
}

export interface AgencyClassification {
  isAgency: boolean;
  agencyType: AgencyType;
  signals: AgencySignals;
  score: number;
  label: AgencyLabel;
  whySelected: string;
  estimatedSiteCount: number | null;
  managesClientSites: boolean | null;
  detectedServices: string[];
}

export const AGENCY_TYPE_OPTIONS: { id: AgencyType; label: string }[] = [
  { id: 'web_design', label: 'Web Design' },
  { id: 'wordpress', label: 'WordPress' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'ecommerce', label: 'Ecommerce' },
  { id: 'seo', label: 'SEO' },
  { id: 'marketing', label: 'Digital Marketing' },
  { id: 'branding', label: 'Branding' },
  { id: 'creative_studio', label: 'Creative Studio' },
  { id: 'msp', label: 'MSP (web services)' },
  { id: 'dev_shop', label: 'Dev Shop' },
  { id: 'unknown', label: 'Any / Unknown' },
];

export function agencyTypeLabel(type: string | null | undefined): string {
  const found = AGENCY_TYPE_OPTIONS.find((t) => t.id === type);
  return found ? found.label : 'Agency';
}
