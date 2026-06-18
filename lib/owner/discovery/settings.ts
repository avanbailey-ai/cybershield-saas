import type { SupabaseClient } from '@supabase/supabase-js';

export type DiscoveryScope = 'local' | 'regional' | 'statewide' | 'nationwide' | 'custom';

const METERS_PER_MILE = 1609.344;

export interface DiscoveryProviderToggles {
  openstreetmap: boolean;
  nominatim_search: boolean;
  directory_seed: boolean;
  google_places: boolean;
}

export interface DiscoverySettings {
  location: string;
  industry: string;
  /** Internal — derived from scope */
  radiusMeters: number;
  discoveryScope: DiscoveryScope;
  /** User-facing custom radius in miles (only when scope is custom) */
  customRadiusMiles: number;
  maxProspectsPerRun: number;
  maxAutoScansPerRun: number;
  providers: DiscoveryProviderToggles;
  seedDirectoryUrl: string | null;
}

/** Preset search areas in miles → meters for geospatial providers */
export const SCOPE_RADIUS_MILES: Record<Exclude<DiscoveryScope, 'custom'>, number> = {
  local: 25,
  regional: 100,
  statewide: 250,
  nationwide: 500,
};

export function milesToMeters(miles: number): number {
  return Math.round(miles * METERS_PER_MILE);
}

export function radiusForScope(settings: DiscoverySettings): number {
  if (settings.discoveryScope === 'custom') {
    const miles = Math.min(Math.max(settings.customRadiusMiles || 25, 1), 500);
    return milesToMeters(miles);
  }
  return milesToMeters(SCOPE_RADIUS_MILES[settings.discoveryScope]);
}

export const DISCOVERY_SCOPE_OPTIONS: { id: DiscoveryScope; label: string; hint: string }[] = [
  { id: 'local', label: 'Local', hint: '25 miles' },
  { id: 'regional', label: 'Regional', hint: '100 miles' },
  { id: 'statewide', label: 'Statewide', hint: 'State-wide search' },
  { id: 'nationwide', label: 'Nationwide', hint: 'Broad US search' },
  { id: 'custom', label: 'Custom', hint: 'Advanced area' },
];

export const DEFAULT_DISCOVERY_SETTINGS: DiscoverySettings = {
  location: 'Medford, OR',
  industry: 'healthcare',
  radiusMeters: milesToMeters(100),
  discoveryScope: 'regional',
  customRadiusMiles: 25,
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

  const raw = data.value as Partial<DiscoverySettings> & { customRadiusMeters?: number };
  const merged: DiscoverySettings = {
    ...DEFAULT_DISCOVERY_SETTINGS,
    ...raw,
    providers: {
      ...DEFAULT_DISCOVERY_SETTINGS.providers,
      ...(raw.providers ?? {}),
    },
    customRadiusMiles:
      raw.customRadiusMiles ??
      (raw.customRadiusMeters
        ? Math.round(raw.customRadiusMeters / METERS_PER_MILE)
        : DEFAULT_DISCOVERY_SETTINGS.customRadiusMiles),
  };
  merged.radiusMeters = radiusForScope(merged);
  return merged;
}
