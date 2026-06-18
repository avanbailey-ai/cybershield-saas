import type { SupabaseClient } from '@supabase/supabase-js';

export interface DiscoveryProviderToggles {
  openstreetmap: boolean;
  nominatim_search: boolean;
  directory_seed: boolean;
  google_places: boolean;
}

export interface DiscoverySettings {
  location: string;
  industry: string;
  radiusMeters: number;
  maxProspectsPerRun: number;
  maxAutoScansPerRun: number;
  providers: DiscoveryProviderToggles;
  seedDirectoryUrl: string | null;
}

export const DEFAULT_DISCOVERY_SETTINGS: DiscoverySettings = {
  location: 'Medford, OR',
  industry: 'healthcare',
  radiusMeters: 15_000,
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
  return {
    ...DEFAULT_DISCOVERY_SETTINGS,
    ...raw,
    providers: {
      ...DEFAULT_DISCOVERY_SETTINGS.providers,
      ...(raw.providers ?? {}),
    },
  };
}
