// Pure helpers shared by the browser bundle and the Vercel functions in /api.
// Nothing here may import firebase or touch the DOM.

export const SITE_URL = 'https://gigspace.co';
export const SITE_NAME = 'Gigspace';

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};
const US_STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([name, code]) => [code, name.replace(/\b\w/g, (c) => c.toUpperCase())]),
);

const COUNTRY_ALIASES: Record<string, string> = {
  us: 'United States', usa: 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States',
  'united states': 'United States', 'united states of america': 'United States',
  uk: 'United Kingdom', 'united kingdom': 'United Kingdom', 'great britain': 'United Kingdom', england: 'United Kingdom',
  uae: 'United Arab Emirates', 'united arab emirates': 'United Arab Emirates',
};
const COUNTRIES = new Set([
  'united states', 'united kingdom', 'united arab emirates', 'canada', 'australia', 'pakistan', 'india',
  'italy', 'spain', 'france', 'germany', 'japan', 'china', 'brazil', 'mexico', 'netherlands', 'belgium',
  'switzerland', 'austria', 'sweden', 'norway', 'denmark', 'finland', 'ireland', 'portugal', 'poland',
  'turkey', 'egypt', 'south africa', 'nigeria', 'kenya', 'saudi arabia', 'qatar', 'bangladesh',
  'sri lanka', 'nepal', 'indonesia', 'malaysia', 'singapore', 'philippines', 'thailand', 'vietnam',
  'south korea', 'new zealand', 'argentina', 'chile', 'colombia', 'peru', 'uzbekistan', 'greece',
  'russia', 'ukraine', 'israel', 'morocco', 'ghana',
]);

export interface ParsedLocation {
  city?: string;
  /** Region as written (state / province), e.g. "California", "Sindh". */
  region?: string;
  /** Two-letter code for US states, else undefined. */
  regionCode?: string;
  country?: string;
}

function normalizeCountry(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (COUNTRIES.has(key)) return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return null;
}

function usState(raw: string): { region: string; regionCode: string } | null {
  const key = raw.trim().toLowerCase();
  if (US_STATES[key]) return { region: raw.trim().replace(/\b\w/g, (c) => c.toUpperCase()), regionCode: US_STATES[key] };
  const code = raw.trim().toUpperCase();
  if (US_STATE_NAMES[code]) return { region: US_STATE_NAMES[code], regionCode: code };
  return null;
}

/**
 * Turns the free-text locations sellers pick ("Chicago, Illinois",
 * "Karachi, Sindh, Pakistan", "USA", "930 10th St, Irwin, PA 15642, USA") into
 * city / region / country. Anything unrecognised is kept rather than dropped.
 */
export function parseLocation(raw: string | null | undefined): ParsedLocation {
  if (!raw) return {};
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};

  const out: ParsedLocation = {};

  const last = parts[parts.length - 1];
  const country = normalizeCountry(last);
  if (country && parts.length > 1) { out.country = country; parts.pop(); }
  else if (country) return { country };

  // "PA 15642" style segments carry a zip — strip it before matching.
  const regionRaw = parts[parts.length - 1].replace(/\s+\d{4,}(-\d+)?$/, '');
  const state = usState(regionRaw);
  if (state) {
    out.region = state.region;
    out.regionCode = state.regionCode;
    out.country = out.country ?? 'United States';
    parts.pop();
  } else if (parts.length >= 2) {
    out.region = regionRaw;
    parts.pop();
  }

  // Skip street-address segments ("930 10th Street") when picking the city.
  const cityCandidates = parts.filter((p) => !/^\d/.test(p));
  const city = cityCandidates[cityCandidates.length - 1] ?? parts[parts.length - 1];
  // A lone segment that names a country is the country, not a city. But once a
  // region is known the segment is a real place name — the US has towns called
  // Italy, Lebanon, Peru and Mexico, and dropping them loses the city targeting
  // that local search depends on.
  const looksLikeCountryAlone = !out.region && !!normalizeCountry(city);
  if (city && !looksLikeCountryAlone) out.city = city;
  return out;
}

/** "Los Angeles, CA" / "Karachi, Sindh" / "Missouri" / "Pakistan" / "". */
export function formatArea(loc: ParsedLocation, opts: { longState?: boolean } = {}): string {
  // The two-letter code only reads naturally after a city ("Austin, TX");
  // a bare state stays spelled out ("Texas").
  const region = opts.longState || !loc.city ? loc.region : (loc.regionCode ?? loc.region);
  if (loc.city && region) return `${loc.city}, ${region}`;
  if (loc.city) return loc.city;
  if (region) return region;
  return loc.country ?? '';
}

export function slugify(input: string, maxLength = 60): string {
  const s = String(input ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength).replace(/-[^-]*$/, '').replace(/-+$/, '') || s.slice(0, maxLength);
}

/** "web_dev" → "Web Dev", used when a category key has no label in the DB. */
export function humanizeKey(key: string): string {
  return String(key ?? '').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function businessSlug(sellerName: string): string {
  return slugify(sellerName) || 'seller';
}

/** `lawn-mowing-miami-fl` — the service part of /posts/{business}/{slug}. */
export function serviceSlug(serviceLabel: string, loc: ParsedLocation): string {
  const area = formatArea(loc);
  return slugify([serviceLabel, area].filter(Boolean).join(' ')) || 'service';
}

/** Stable suffix for collisions, from the listing's own push id. */
export function shortId(id: string, length = 4): string {
  const clean = String(id).toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean.slice(-length) || clean;
}

/** Candidate slugs in the order they should be tried: base, then suffixed. */
export function slugCandidates(base: string, id: string): string[] {
  return [base, `${base}-${shortId(id, 4)}`, `${base}-${shortId(id, 8)}`, `${base}-${slugify(id)}`];
}

export const SEO_PATH_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/;
