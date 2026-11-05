/* ─── Which Google results to offer, and which are the same business ─────────────
 * The listings generator asks Google Places for "<keyword> in <city>". Google
 * treats the city as a hint to rank by, not a filter, so a search for Miami
 * Beach also returns businesses in Miami: close, but a different city, and the
 * same business is often found from both searches. Google also lists some
 * businesses twice under different place ids, so de-duplicating on the id alone
 * leaves both. Left alone, an admin can generate two posts for one business.
 *
 * Everything here is pure (no network, no database) so it can be tested
 * exhaustively; listings.controller.ts supplies the data.
 */

export interface AddressPart {
  longText?: string;
  shortText?: string;
  types?: string[];
}

// Abbreviations that differ between how a person types a city and how Google
// spells it ("St. Petersburg" / "Saint Petersburg").
const WORDS: Record<string, string> = { st: 'saint', ft: 'fort', mt: 'mount' };

/** Lower-case, accent-free, punctuation-free, abbreviations spelled out. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '') // Wong's and Wongs are one name
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => WORDS[w] ?? w)
    .join(' ');
}

// ─── The searched city ─────────────────────────────────────────────────────────

export interface SearchedCity {
  /** The city names the admin could mean: "South Beach, Miami Beach, Florida" is either. */
  names: string[];
  /** State or country words from the label; empty when only a city was typed. */
  regions: string[];
  /** The whole input, normalised, for text typed without commas ("Miami Beach FL"). */
  whole: string;
}

// A ZIP code typed after the city ("Miami Beach, FL 33139") is not part of its name.
const ZIP = /\b\d{5}(?:-\d{4})?\b/g;

/**
 * Reads the label the city picker produces ("Miami Beach, Florida", "Paris,
 * Île-de-France, France") or whatever the admin typed ("Miami Beach", "Miami
 * Beach, FL", "Miami Beach FL 33139").
 */
export function parseSearchedCity(input: string): SearchedCity {
  const cleaned = input.replace(ZIP, ' ');
  const parts = cleaned.split(',').map((p) => normalizeName(p)).filter(Boolean);
  if (parts.length === 0) return { names: [], regions: [], whole: '' };
  return {
    names: parts.slice(0, Math.max(1, parts.length - 1)),
    regions: parts.slice(1),
    whole: normalizeName(cleaned),
  };
}

// What Google calls a place's city varies. These are the address parts that name
// one: the locality, a sublocality such as a borough, a UK postal town, or a town
// in states that divide counties that way.
const CITY_TYPES = ['locality', 'sublocality_level_1', 'sublocality', 'postal_town', 'administrative_area_level_3'];

// New York City is five boroughs. Google gives Manhattan the city "New York", but
// Brooklyn, Queens, the Bronx and Staten Island only their borough name, with no
// city at all (checked against live Places results). Without this, a search for
// "New York, New York" would lose most of the city.
const NYC_BOROUGHS = new Set(['manhattan', 'brooklyn', 'queens', 'bronx', 'the bronx', 'staten island']);
const NYC_NAMES = ['new york', 'new york city', 'nyc'];

/** Another way to write a country that Google spells differently ("USA" for "United States"). */
const COUNTRY_ALIASES: Record<string, string[]> = { us: ['usa', 'united states of america'], gb: ['uk', 'great britain'] };

const namesOf = (parts: AddressPart[], ...types: string[]): string[] =>
  parts
    .filter((c) => c.types?.some((t) => types.includes(t)))
    .flatMap((c) => [c.longText, c.shortText])
    .filter((s): s is string => !!s)
    .map(normalizeName);

/**
 * Whether a place's own address is in the searched city.
 *
 * Counts a place as in the city when ANY of its city-level address names matches,
 * so a search for a borough or for the city around it finds the same address. A
 * place whose address names no city at all can't be judged, so it is kept rather
 * than hidden.
 */
export function placeInCity(components: AddressPart[] | undefined, searched: SearchedCity): boolean {
  if (searched.names.length === 0) return true;
  const parts = components ?? [];

  let cityNames = namesOf(parts, ...CITY_TYPES);
  if (cityNames.length === 0) return true;

  const stateNames = namesOf(parts, 'administrative_area_level_1');
  const countryRaw = namesOf(parts, 'country');
  const countryNames = [...countryRaw, ...countryRaw.flatMap((c) => COUNTRY_ALIASES[c] ?? [])];
  const regionNames = [...stateNames, ...countryNames];

  // Boroughs are also "New York" (see NYC_BOROUGHS), but only in New York state:
  // there is a Brooklyn in Ohio. Google writes "The Bronx"; people type "Bronx".
  if (stateNames.some((s) => s === 'new york' || s === 'ny') && cityNames.some((n) => n === 'new york' || NYC_BOROUGHS.has(n))) {
    cityNames = [...cityNames, ...NYC_NAMES];
    if (cityNames.includes('the bronx')) cityNames.push('bronx');
    if (cityNames.includes('bronx')) cityNames.push('the bronx');
  }

  // Text typed without commas ("Miami Beach FL", "Miami Beach Florida USA") is
  // read against this place's own city, state and country, so no list of states
  // is needed and nothing else can match it.
  const spelled = new Set<string>();
  for (const c of cityNames) {
    spelled.add(c);
    for (const k of countryNames) spelled.add(`${c} ${k}`);
    for (const s of stateNames) {
      spelled.add(`${c} ${s}`);
      for (const k of countryNames) spelled.add(`${c} ${s} ${k}`);
    }
  }
  if (searched.whole && spelled.has(searched.whole)) return true;

  // "New York City, New York" (the picker's old spelling) is the locality "New
  // York": fold a trailing "city" only when what is left is the state's own name.
  const variants = new Set(searched.names);
  for (const n of searched.names) {
    if (n.endsWith(' city') && searched.regions.includes(n.slice(0, -5))) variants.add(n.slice(0, -5));
  }

  const cityMatches = cityNames.some((n) => variants.has(n));
  const regionMatches =
    searched.regions.length === 0 || regionNames.length === 0 || regionNames.some((r) => searched.regions.includes(r));
  return cityMatches && regionMatches;
}

// ─── The same business, listed twice ───────────────────────────────────────────

/** A website without the parts that vary between links to the same page. */
export function normalizeWebsite(url: string): string {
  if (!url.trim()) return '';
  let u: URL;
  try {
    u = new URL(url.includes('://') ? url : `https://${url}`);
  } catch {
    return url.trim().toLowerCase();
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const path = u.pathname.toLowerCase().replace(/\/index\.(html?|php)$/, '').replace(/\/+$/, '');
  return host + path;
}

/**
 * Identifies a business by its website and name together. Branches of a chain
 * share a site but not a page (foreverlawn.com/southbeach), and an agency can
 * share one site between brands, so neither alone is enough; one business
 * listed twice by Google has both the same.
 */
export function businessKey(name: string, website: string): string | null {
  const site = normalizeWebsite(website);
  const n = normalizeName(name);
  return site && n ? `${site}|${n}` : null;
}

/**
 * Keeps one entry per business, preferring the one with more reviews (usually
 * the established profile), and otherwise the first Google ranked. Order is kept.
 */
export function dedupeBusinesses<T extends { name: string; website: string; reviewCount: number }>(
  list: T[],
): { kept: T[]; removed: number } {
  const best = new Map<string, T>();
  for (const b of list) {
    const key = businessKey(b.name, b.website);
    if (!key) continue;
    const current = best.get(key);
    if (!current || b.reviewCount > current.reviewCount) best.set(key, b);
  }
  const kept = list.filter((b) => {
    const key = businessKey(b.name, b.website);
    return key === null || best.get(key) === b;
  });
  return { kept, removed: list.length - kept.length };
}

// ─── Businesses that already have a post ───────────────────────────────────────

export interface ExistingPost {
  placeId?: unknown;
  website?: unknown;
  sellerName?: unknown;
  status?: unknown;
}

export interface ExistingRef {
  id: string;
  status: string;
}

export interface ExistingIndex {
  byPlace: Map<string, ExistingRef>;
  byKey: Map<string, ExistingRef>;
}

/**
 * Indexes every post that stands for a business, by Google place id and by
 * website+name. A deleted-and-archived post (kept only for its orders) doesn't
 * count: it is gone, and the business may be generated again.
 */
export function indexExisting(posts: Record<string, ExistingPost | null> | null | undefined): ExistingIndex {
  const index: ExistingIndex = { byPlace: new Map(), byKey: new Map() };
  for (const [id, p] of Object.entries(posts ?? {})) {
    if (!p || typeof p !== 'object' || p.status === 'deleted') continue;
    const ref: ExistingRef = { id, status: typeof p.status === 'string' ? p.status : '' };
    if (typeof p.placeId === 'string' && p.placeId) index.byPlace.set(p.placeId, ref);
    const key = businessKey(typeof p.sellerName === 'string' ? p.sellerName : '', typeof p.website === 'string' ? p.website : '');
    if (key) index.byKey.set(key, ref);
  }
  return index;
}

/** The post already standing for this business, if any. */
export function findExisting(
  index: ExistingIndex | null,
  b: { placeId?: string; name?: string; website?: string },
): ExistingRef | null {
  if (!index) return null;
  if (b.placeId && index.byPlace.has(b.placeId)) return index.byPlace.get(b.placeId) ?? null;
  const key = businessKey(b.name ?? '', b.website ?? '');
  return key ? index.byKey.get(key) ?? null : null;
}

export interface Skipped {
  name: string;
  reason: string;
}

/**
 * Splits a selection into the businesses that can be generated and those that
 * can't: already have a post, or repeat another business in the same selection.
 */
export function splitGeneratable<T extends { placeId?: string; name?: string; website?: string }>(
  selection: T[],
  index: ExistingIndex | null,
): { fresh: T[]; skipped: Skipped[] } {
  const fresh: T[] = [];
  const skipped: Skipped[] = [];
  const places = new Set<string>();
  const keys = new Set<string>();
  for (const b of selection) {
    const name = b.name ?? 'Unnamed business';
    const key = businessKey(b.name ?? '', b.website ?? '');
    if (findExisting(index, b)) { skipped.push({ name, reason: 'it already has a post' }); continue; }
    if ((b.placeId && places.has(b.placeId)) || (key && keys.has(key))) {
      skipped.push({ name, reason: 'it is selected twice' });
      continue;
    }
    if (b.placeId) places.add(b.placeId);
    if (key) keys.add(key);
    fresh.push(b);
  }
  return { fresh, skipped };
}
