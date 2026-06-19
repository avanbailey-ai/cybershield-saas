import type { AgencyType } from '../agency/agencyTypes';
import type { DiscoveryScope } from './settings';
import type { ProviderDiagnostic } from './provider';
import type { DiscoveryBreakdownResult } from './types';
import { localZeroRawSuggestion, isNationwideAgencyScope } from './agencyQueries';

export interface DiscoveryRunDiagnostics {
  runType: 'smb' | 'agency';
  agencyType?: AgencyType;
  location: string;
  normalizedLocation: string | null;
  searchScope: DiscoveryScope | string;
  locationExpansion: string | null;
  metrosSearched: string[];
  queriesByMetro: Record<string, string[]>;
  providerName: string;
  providers: ProviderDiagnostic[];
  queriesAttempted: string[];
  rawResponseCount: number;
  rawCandidatesBeforeFilters: number;
  duplicatesSkipped: number;
  rejectedLowFit: number;
  missingContact: number;
  qualified: number;
  outreachReady: number;
  inserted: number;
  rejectionReasonCounts: Record<string, number>;
  contactConfidenceCounts: Record<string, number>;
  durationMs: number;
  envMissing: string[];
  zeroRawReason: string | null;
  nextRecommendedAction: string | null;
}

function providerWasCalled(d: ProviderDiagnostic): boolean {
  return d.providerCalled === true || d.status === 'succeeded' || d.status === 'failed';
}

function summarizeZeroRaw(input: {
  providers: ProviderDiagnostic[];
  queriesAttempted: string[];
  rawResponseCount: number;
  envMissing: string[];
  runType: 'smb' | 'agency';
  searchScope: DiscoveryScope | string;
  location: string;
}): { reason: string; action: string } {
  const { providers, queriesAttempted, rawResponseCount, envMissing, runType, searchScope, location } =
    input;

  if (envMissing.length > 0) {
    return {
      reason: `Missing configuration: ${envMissing.join(', ')}.`,
      action: 'Check discovery provider/API configuration in Settings.',
    };
  }

  const enabled = providers.filter((p) => p.providerEnabled !== false);
  const called = enabled.filter(providerWasCalled);
  if (enabled.length === 0) {
    return {
      reason: 'No discovery provider was enabled for this run.',
      action: 'Enable Nominatim search or OpenStreetMap in discovery settings.',
    };
  }
  if (called.length === 0) {
    return {
      reason: 'No provider was called. Discovery sources may be disabled.',
      action: 'Enable at least one provider (OpenStreetMap or Nominatim) and retry.',
    };
  }

  const failed = called.filter((p) => p.status === 'failed');
  if (failed.length === called.length) {
    const err = failed[0]?.failureReason ?? failed[0]?.providerError ?? 'Unknown provider error';
    const rateLimited = /timeout|429|rate|abort/i.test(err);
    return {
      reason: rateLimited
        ? `Provider rate-limited or timed out: ${err}`
        : `All providers failed: ${err}`,
      action: rateLimited
        ? 'Wait and retry with a smaller scope (Local/Regional) or fewer metros.'
        : 'Check provider status in advanced diagnostics and retry.',
    };
  }

  if (rawResponseCount === 0) {
    const sampleQuery = queriesAttempted[0] ?? '(none)';
    const localAction =
      runType === 'agency' &&
      (searchScope === 'local' || searchScope === 'regional' || searchScope === 'statewide')
        ? localZeroRawSuggestion(location)
        : runType === 'agency' && isNationwideAgencyScope(searchScope as DiscoveryScope)
          ? 'Nationwide run returned no provider hits — check diagnostics for rate limits or try again later.'
          : 'No local raw candidates returned. Try Regional or Nationwide.';

    return {
      reason: `Providers returned 0 search hits for queries such as: "${sampleQuery}".`,
      action: localAction,
    };
  }

  return {
    reason: `Providers returned ${rawResponseCount} hits but none had a public website in map data.`,
    action:
      runType === 'agency'
        ? localZeroRawSuggestion(location)
        : 'Map data lacks website tags — try a wider region or import URLs manually.',
  };
}

export function buildDiscoveryRunDiagnostics(input: {
  runType: 'smb' | 'agency';
  agencyType?: AgencyType;
  location: string;
  normalizedLocation?: string | null;
  searchScope: DiscoveryScope | string;
  locationExpansion?: string | null;
  metrosSearched?: string[];
  queriesByMetro?: Record<string, string[]>;
  providers: ProviderDiagnostic[];
  queriesAttempted: string[];
  rawResponseCount: number;
  rawCandidatesBeforeFilters: number;
  breakdown: DiscoveryBreakdownResult;
  durationMs: number;
  envMissing?: string[];
  rejectionReasonCounts?: Record<string, number>;
  contactConfidenceCounts?: Record<string, number>;
}): DiscoveryRunDiagnostics {
  const envMissing = input.envMissing ?? [];
  const zeroRaw = input.rawCandidatesBeforeFilters === 0;

  let zeroRawReason: string | null = null;
  let nextRecommendedAction: string | null = null;
  if (zeroRaw) {
    const summary = summarizeZeroRaw({
      providers: input.providers,
      queriesAttempted: input.queriesAttempted,
      rawResponseCount: input.rawResponseCount,
      envMissing,
      runType: input.runType,
      searchScope: input.searchScope,
      location: input.location,
    });
    zeroRawReason = summary.reason;
    nextRecommendedAction = summary.action;
  }

  const primaryProvider =
    input.providers.find((p) => providerWasCalled(p) && p.found > 0)?.provider ??
    input.providers.find((p) => providerWasCalled(p))?.provider ??
    input.providers[0]?.provider ??
    'none';

  return {
    runType: input.runType,
    agencyType: input.agencyType,
    location: input.location,
    normalizedLocation: input.normalizedLocation ?? null,
    searchScope: input.searchScope,
    locationExpansion: input.locationExpansion ?? null,
    metrosSearched: input.metrosSearched ?? [],
    queriesByMetro: input.queriesByMetro ?? {},
    providerName: primaryProvider,
    providers: input.providers,
    queriesAttempted: input.queriesAttempted,
    rawResponseCount: input.rawResponseCount,
    rawCandidatesBeforeFilters: input.rawCandidatesBeforeFilters,
    duplicatesSkipped: input.breakdown.duplicatesSkipped,
    rejectedLowFit: input.breakdown.rejectedLowFit,
    missingContact: input.breakdown.missingContact,
    qualified: input.breakdown.qualified,
    outreachReady: input.breakdown.outreachReady,
    inserted: input.breakdown.inserted,
    rejectionReasonCounts: input.rejectionReasonCounts ?? {},
    contactConfidenceCounts: input.contactConfidenceCounts ?? {},
    durationMs: input.durationMs,
    envMissing,
    zeroRawReason,
    nextRecommendedAction,
  };
}

export function formatZeroRawMessage(diag: DiscoveryRunDiagnostics): string {
  return [
    'Discovery finished, but no raw candidates were returned.',
    diag.zeroRawReason ?? 'Unknown upstream failure.',
    diag.nextRecommendedAction ? `Suggested: ${diag.nextRecommendedAction}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
