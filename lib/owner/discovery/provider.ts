import type { RawDiscoveredBusiness } from './types';

export interface DiscoveryParams {
  location: string;
  industry: string;
  radiusMeters: number;
  maxResults: number;
  seedDirectoryUrl?: string | null;
}

export interface ProviderDiagnostic {
  provider: string;
  status: 'succeeded' | 'failed' | 'skipped';
  found: number;
  statusCode?: number;
  responseSnippet?: string;
  queryHash?: string;
  failureReason?: string;
}

export interface ProviderResult {
  results: RawDiscoveredBusiness[];
  diagnostic: ProviderDiagnostic;
}

export interface DiscoveryProvider {
  name: string;
  enabled: boolean;
  discover(params: DiscoveryParams): Promise<ProviderResult>;
}

export function failedDiagnostic(
  provider: string,
  reason: string,
  extra?: Partial<ProviderDiagnostic>,
): ProviderResult {
  return {
    results: [],
    diagnostic: {
      provider,
      status: 'failed',
      found: 0,
      failureReason: reason,
      ...extra,
    },
  };
}

export function succeededDiagnostic(
  provider: string,
  results: RawDiscoveredBusiness[],
  extra?: Partial<ProviderDiagnostic>,
): ProviderResult {
  return {
    results,
    diagnostic: {
      provider,
      status: 'succeeded',
      found: results.length,
      ...extra,
    },
  };
}

export function skippedDiagnostic(provider: string, reason: string): ProviderResult {
  return {
    results: [],
    diagnostic: {
      provider,
      status: 'skipped',
      found: 0,
      failureReason: reason,
    },
  };
}
