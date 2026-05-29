// Thin client for Photon (https://photon.komoot.io) — a free, no-key,
// CORS-enabled geocoder built on OpenStreetMap data.

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api';

interface PhotonProperties {
  name?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  osm_key?: string;
  osm_value?: string;
}

export interface LocationResult {
  label: string;
  lat?: number;
  lng?: number;
  locationType?: 'precise' | 'broad';
  isCountry?: boolean;
}

// Only OSM place/boundary features — excludes amenities, buildings, airports, etc.
const PLACE_VALUES = new Set([
  'city', 'town', 'village', 'hamlet', 'suburb', 'borough', 'quarter',
  'neighbourhood', 'district', 'municipality', 'county', 'state', 'region',
  'country', 'island', 'locality', 'administrative',
]);

// Broad administrative areas where a radius filter makes no sense.
const BROAD_VALUES = new Set(['county', 'state', 'region', 'country', 'island', 'administrative']);

// Lower = higher priority in autocomplete results.
const PLACE_PRIORITY: Record<string, number> = {
  city: 0, town: 1, village: 2, suburb: 3, borough: 4, quarter: 5,
  neighbourhood: 6, hamlet: 7, municipality: 8, district: 9,
  county: 10, administrative: 11, state: 12, region: 13, country: 14,
  island: 15, locality: 16,
};

function formatLocation(props: PhotonProperties): string {
  const isUS = props.countrycode === 'US';
  const parts: string[] = [];

  // When a city-type feature shares its name with its parent state (e.g. "New York" city inside
  // "New York" state), append " City" so it's distinguishable from the state result.
  let displayName = props.name ?? '';
  if (props.osm_value === 'city' && displayName && props.state && displayName === props.state) {
    displayName = displayName + ' City';
  }

  const push = (v?: string) => {
    if (v && !parts.includes(v)) parts.push(v);
  };
  push(displayName);
  push(props.city);
  push(props.state);
  if (!isUS) push(props.country);
  return parts.join(', ');
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<LocationResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const res = await fetch(
      `${PHOTON_ENDPOINT}?q=${encodeURIComponent(q)}&limit=20`,
      { signal },
    );
    if (!res.ok) return [];

    const data = await res.json();
    const features: {
      properties: PhotonProperties;
      geometry?: { coordinates?: [number, number] };
    }[] = data?.features ?? [];

    const seen = new Set<string>();
    const candidates: Array<{ label: string; lat: number; lng: number; priority: number; locationType: 'precise' | 'broad'; isCountry: boolean }> = [];

    for (const feature of features) {
      const props = feature.properties ?? {};
      const osmKey = props.osm_key ?? '';
      const osmValue = props.osm_value ?? '';

      // Skip non-place features (buildings, amenities, airports, universities, etc.)
      if (osmKey !== 'place' && osmKey !== 'boundary') continue;
      if (!PLACE_VALUES.has(osmValue)) continue;

      const label = formatLocation(props);
      if (!label || seen.has(label)) continue;
      seen.add(label);

      const [lng = 0, lat = 0] = feature.geometry?.coordinates ?? [];
      const locationType: 'precise' | 'broad' = BROAD_VALUES.has(osmValue) ? 'broad' : 'precise';
      const isCountry = osmValue === 'country';
      // Boost features whose name exactly matches the query (e.g. "France" when typing "france")
      // so countries/states surface above unrelated places that start with the same letters.
      const isExactMatch = (props.name ?? '').toLowerCase() === q.toLowerCase();
      const priority = isExactMatch ? -1 : (PLACE_PRIORITY[osmValue] ?? 20);
      candidates.push({ label, lat, lng, priority, locationType, isCountry });
    }

    // Cities and towns rise to the top; states and countries fall lower.
    candidates.sort((a, b) => a.priority - b.priority);

    return candidates.slice(0, 8).map(({ label, lat, lng, locationType, isCountry }) => ({ label, lat, lng, locationType, isCountry }));
  } catch {
    return [];
  }
}

// Module-level geocode cache shared across all calls.
export const geocodeCache = new Map<string, { lat: number; lng: number; locationType: 'precise' | 'broad' } | null>();

export async function geocodeLocation(
  location: string,
): Promise<{ lat: number; lng: number; locationType: 'precise' | 'broad' } | null> {
  if (geocodeCache.has(location)) return geocodeCache.get(location)!;

  try {
    const res = await fetch(
      `${PHOTON_ENDPOINT}?q=${encodeURIComponent(location)}&limit=1`,
    );
    if (!res.ok) { geocodeCache.set(location, null); return null; }

    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature?.geometry?.coordinates) { geocodeCache.set(location, null); return null; }

    const [lng, lat] = feature.geometry.coordinates;
    const osmValue = feature.properties?.osm_value ?? '';
    const locationType: 'precise' | 'broad' = BROAD_VALUES.has(osmValue) ? 'broad' : 'precise';
    const result = { lat, lng, locationType };
    geocodeCache.set(location, result);
    return result;
  } catch {
    geocodeCache.set(location, null);
    return null;
  }
}

export function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
