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

// Common English country names as returned by Photon/OSM. Used to detect whether a
// previously-saved primary-location label is a country, so the Remote toggle can be
// re-enabled when editing posts saved before we persisted that flag explicitly.
const COUNTRY_NAMES = new Set<string>([
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'antigua and barbuda',
  'argentina', 'armenia', 'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain',
  'bangladesh', 'barbados', 'belarus', 'belgium', 'belize', 'benin', 'bhutan', 'bolivia',
  'bosnia and herzegovina', 'botswana', 'brazil', 'brunei', 'bulgaria', 'burkina faso',
  'burundi', 'cambodia', 'cameroon', 'canada', 'cape verde', 'central african republic',
  'chad', 'chile', 'china', 'colombia', 'comoros', 'congo', 'costa rica', 'croatia',
  'cuba', 'cyprus', 'czechia', 'czech republic', 'denmark', 'djibouti', 'dominica',
  'dominican republic', 'east timor', 'ecuador', 'egypt', 'el salvador',
  'equatorial guinea', 'eritrea', 'estonia', 'eswatini', 'ethiopia', 'fiji', 'finland',
  'france', 'gabon', 'gambia', 'georgia', 'germany', 'ghana', 'greece', 'grenada',
  'guatemala', 'guinea', 'guinea-bissau', 'guyana', 'haiti', 'honduras', 'hungary',
  'iceland', 'india', 'indonesia', 'iran', 'iraq', 'ireland', 'israel', 'italy',
  'ivory coast', "côte d'ivoire", 'jamaica', 'japan', 'jordan', 'kazakhstan', 'kenya',
  'kiribati', 'kosovo', 'kuwait', 'kyrgyzstan', 'laos', 'latvia', 'lebanon', 'lesotho',
  'liberia', 'libya', 'liechtenstein', 'lithuania', 'luxembourg', 'madagascar', 'malawi',
  'malaysia', 'maldives', 'mali', 'malta', 'marshall islands', 'mauritania', 'mauritius',
  'mexico', 'micronesia', 'moldova', 'monaco', 'mongolia', 'montenegro', 'morocco',
  'mozambique', 'myanmar', 'namibia', 'nauru', 'nepal', 'netherlands', 'new zealand',
  'nicaragua', 'niger', 'nigeria', 'north korea', 'north macedonia', 'norway', 'oman',
  'pakistan', 'palau', 'palestine', 'panama', 'papua new guinea', 'paraguay', 'peru',
  'philippines', 'poland', 'portugal', 'qatar', 'romania', 'russia', 'rwanda',
  'saint kitts and nevis', 'saint lucia', 'saint vincent and the grenadines', 'samoa',
  'san marino', 'sao tome and principe', 'saudi arabia', 'senegal', 'serbia',
  'seychelles', 'sierra leone', 'singapore', 'slovakia', 'slovenia', 'solomon islands',
  'somalia', 'south africa', 'south korea', 'south sudan', 'spain', 'sri lanka', 'sudan',
  'suriname', 'sweden', 'switzerland', 'syria', 'taiwan', 'tajikistan', 'tanzania',
  'thailand', 'togo', 'tonga', 'trinidad and tobago', 'tunisia', 'turkey', 'türkiye',
  'turkmenistan', 'tuvalu', 'uganda', 'ukraine', 'united arab emirates',
  'united kingdom', 'united states', 'uruguay', 'uzbekistan', 'vanuatu',
  'vatican city', 'venezuela', 'vietnam', 'yemen', 'zambia', 'zimbabwe',
]);

// True when the given location label is a recognised country name (case-insensitive).
export function isCountryName(label: string): boolean {
  return COUNTRY_NAMES.has(label.trim().toLowerCase());
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
