import type { SupabaseClient } from '@supabase/supabase-js';

export type DiscoveryScope = 'local' | 'regional' | 'statewide' | 'nationwide' | 'custom';

export interface DiscoveryProviderToggles {
  openstreetmap: boolean;
  nominatim_search: boolean;
  directory_seed: boolean;
  google_places: boolean;
}

export interface DiscoverySettings {
  location: string;
  industry: string;
  /** @deprecated use discoveryScope */
  radiusMeters: number;
  discoveryScope: DiscoveryScope;
  customRadiusMeters: number;
  maxProspectsPerRun: number;
  maxAutoScansPerRun: number;
  providers: DiscoveryProviderToggles;
  seedDirectoryUrl: string | null;
}

export const SCOPE_RADIUS_METERS: Record<Exclude<DiscoveryScope, 'custom'>, number> = {
  local: 5_000,
  regional: 25_000,
  statewide: 200_000,
  nationwide: 500_000,
};

export function radiusForScope(settings: DiscoverySettings): number {
  if (settings.discoveryScope === 'custom') {
    return Math.min(Math.max(settings.customRadiusMeters || 15_000, 1_000), 500_000);
  }
  return SCOPE_RADIUS_METERS[settings.discoveryScope];
}

export const DISCOVERY_SCOPE_OPTIONS: { id: DiscoveryScope; label: string; hint: string }[] = [
  { id: 'local', label: 'Local', hint: '~5 km' },
  { id: 'regional', label: 'Regional', hint: '~25 km' },
  { id: 'statewide', label: 'Statewide', hint: '~200 km' },
  { id: 'nationwide', label: 'Nationwide', hint: 'Broad US search' },
  { id: 'custom', label: 'Custom', hint: 'Set radius manually' },
];

export const DEFAULT_DISCOVERY_SETTINGS: DiscoverySettings = {
  location: 'Medford, OR',
  industry: 'healthcare',
  radiusMeters: 15_000,
  discoveryScope: 'regional',
  customRadiusMeters: 15_000,
  maxProspectsPerRun: 25,
  maxAutoScansPerRun: 10,
  providers: {
    openstreetmap: true,
    nominatim_search: true,
    directory_seed: true,
    google_places: false,
  },
  seedDirectoryUrl: null,
};

export async function getDiscoverySettings(
  admin: SupabaseClient,
): Promise<DiscoverySettings> {
  const { data } = await admin
    .from('owner_founder_settings')
    .select('value')
    .eq('key', 'discovery')
    .maybeSingle();

  if (!data?.value || typeof data.value !== 'object') {
    return { ...DEFAULT_DISCOVERY_SETTINGS };
  }

  const raw = data.value as Partial<DiscoverySettings>;
  const merged = {
    ...DEFAULT_DISCOVERY_SETTINGS,
    ...raw,
    providers: {
      ...DEFAULT_DISCOVERY_SETTINGS.providers,
      ...(raw.providers ?? {}),
    },
  };
  merged.radiusMeters = radiusForScope(merged);
  return merged;
}
