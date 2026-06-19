export type ProspectPipelineState =
  | 'new'
  | 'new_discovery'
  | 'scanned'
  | 'qualified'
  | 'outreach_ready'
  | 'needs_contact'
  | 'no_contact_found'
  | 'needs_review'
  | 'bad_fit'
  | 'follow_up_scheduled'
  | 'follow_up_due'
  | 'contacted'
  | 'interested'
  | 'customer'
  | 'archived'
  | 'ignore_forever';

export type DiscoverySource =
  | 'openstreetmap'
  | 'nominatim_search'
  | 'directory_seed'
  | 'google_places'
  | 'platform_website'
  | 'manual'
  | 'csv'
  | 'url_batch';

export interface RawDiscoveredBusiness {
  business_name: string;
  website: string;
  industry: string;
  city: string | null;
  state: string | null;
  country: string | null;
  discovery_source: DiscoverySource;
  discovery_source_url: string | null;
  confidence?: number;
}

export interface ValidatedProspect extends RawDiscoveredBusiness {
  dns_valid: boolean;
  http_valid: boolean;
}

import type { ProviderDiagnostic } from './provider';

export interface DiscoveryBreakdownResult {
  rawResults: number;
  duplicatesSkipped: number;
  rejectedLowFit: number;
  missingContact: number;
  qualified: number;
  outreachReady: number;
  needsReview: number;
  inserted: number;
  rejectedInserted: number;
}

import type { DiscoveryRunDiagnostics } from './diagnostics';

export interface DiscoveryRunResult {
  discovered: number;
  inserted: number;
  scanned: number;
  skipped: number;
  validated: number;
  qualified: number;
  outreachReady: number;
  estimatedOpportunityMrr: number;
  errors: string[];
  providerDiagnostics: import('./provider').ProviderDiagnostic[];
  breakdown: DiscoveryBreakdownResult;
  summaryMessage?: string;
  runDiagnostics?: DiscoveryRunDiagnostics;
  runId?: string;
}
