// Thin client for Photon (https://photon.komoot.io) — a free, no-key,
// CORS-enabled geocoder built on OpenStreetMap data. Used to power the
// city / state / country autocomplete in the location selector.

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api';

/** Subset of the GeoJSON feature properties Photon returns. */
interface PhotonProperties {
  name?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
}

export interface LocationResult {
  /** Display + filter label, e.g. "New York, New York" or "Lyon, Auvergne-Rhône-Alpes, France". */
  label: string;
}

/**
 * Builds a clean display label from a Photon feature.
 * US results omit "United States of America" and the ZIP code, per design.
 */
export function formatLocation(props: PhotonProperties): string {
  const isUS = props.countrycode === 'US';
  const parts: string[] = [];
  const push = (v?: string) => {
    if (v && !parts.includes(v)) parts.push(v);
  };

  // Primary place name (may itself be a city, state, or country).
  push(props.name);
  // Fill in the locality if the name wasn't already the city.
  push(props.city);
  push(props.state);
  if (!isUS) push(props.country);

  return parts.join(', ');
}

/**
 * Searches Photon for the given query and returns up to ~6 deduped results.
 * Returns an empty array on any network/parse error so callers can stay quiet.
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<LocationResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const res = await fetch(
      `${PHOTON_ENDPOINT}?q=${encodeURIComponent(q)}&limit=8`,
      { signal },
    );
    if (!res.ok) return [];

    const data = await res.json();
    const features: { properties: PhotonProperties }[] = data?.features ?? [];

    const seen = new Set<string>();
    const results: LocationResult[] = [];
    for (const feature of features) {
      const label = formatLocation(feature.properties ?? {});
      if (label && !seen.has(label)) {
        seen.add(label);
        results.push({ label });
      }
      if (results.length >= 6) break;
    }
    return results;
  } catch {
    // Aborted requests and network failures: surface no suggestions.
    return [];
  }
}
