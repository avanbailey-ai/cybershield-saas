export type ProspectPipelineState =
  | 'new'
  | 'new_discovery'
  | 'scanned'
  | 'qualified'
  | 'outreach_ready'
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
  providerDiagnostics: ProviderDiagnostic[];
}
