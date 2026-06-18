const NOMINATIM_UA =
  'CyberShieldCloud/1.0 contact: support@cybershieldcloud.com';

export interface GeoPoint {
  lat: number;
  lon: number;
  displayName: string;
}

/** Geocode a city/region string via public Nominatim (OSM). */
export async function geocodeLocation(location: string): Promise<GeoPoint | null> {
  const q = location.trim();
  if (!q) return null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' },
  });

  if (!res.ok) return null;

  const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const hit = rows[0];
  if (!hit) return null;

  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    displayName: hit.display_name,
  };
}
