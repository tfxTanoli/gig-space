// What a /search URL means, shared by the browser (BuyerSearch) and the server
// renderer (api/page.ts) so a link, a crawler and a visitor all get the same
// results for it (GIG-77). Nothing here may import firebase or touch the DOM.

import { locationMatchKey } from '../photon.js';
import { parseLocation, usStateName } from './slug.js';

/** Results per page, on the server and in the browser alike. */
export const ITEMS_PER_PAGE = 20;

/** The part of a search the URL carries: these make a page worth linking to. */
export interface SearchState {
  q: string;
  category: string;
  subcategory: string;
  location: string;
  /** 1-based. */
  page: number;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: ParamSource, key: string): string {
  if (params instanceof URLSearchParams) return (params.get(key) ?? '').trim();
  const v = params[key];
  return (Array.isArray(v) ? v[0] ?? '' : v ?? '').trim();
}

/** Title case for text typed all one case ("DALLAS", "dallas"); anything else as written ("McAllen"). */
const tidyCase = (s: string) =>
  s === s.toLowerCase() || s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()) : s;

/**
 * One spelling per place, so a results page has one URL: "Dallas, TX",
 * "dallas, texas" and "DALLAS, TEXAS" all become "Dallas, Texas" — the way
 * listings store their areas. Used for every search URL (canonicals, links,
 * the sitemap) and for the search itself, so it never changes the results.
 */
export function canonicalLocation(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const loc = parseLocation(cleaned);
  const region = loc.regionCode ? usStateName(loc.regionCode) : loc.region ? tidyCase(loc.region) : '';
  let city = loc.city ? tidyCase(loc.city) : '';
  // The picker's disambiguating "New York City, New York" is "New York, New York".
  if (/ city$/i.test(city) && region && city.slice(0, -5).toLowerCase() === region.toLowerCase()) city = city.slice(0, -5);
  if (city && region) return `${city}, ${region}`;
  if (city || region) return city || region || '';
  return loc.country ?? tidyCase(cleaned);
}

export function readSearchState(params: ParamSource): SearchState {
  const page = Number.parseInt(read(params, 'page'), 10);
  return {
    q: read(params, 'q').slice(0, 100),
    category: read(params, 'category'),
    subcategory: read(params, 'subcategory'),
    location: canonicalLocation(read(params, 'location').slice(0, 100)),
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/**
 * The query string for a search, in one fixed order with empty parts and
 * page 1 left out, so every way of reaching a page produces the same URL —
 * which is what makes it usable as a canonical.
 */
export function searchQueryString(s: Partial<SearchState>): string {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.category) p.set('category', s.category);
  if (s.category && s.subcategory) p.set('subcategory', s.subcategory);
  if (s.location) p.set('location', canonicalLocation(s.location));
  if (s.page && s.page > 1) p.set('page', String(s.page));
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

export const searchPath = (s: Partial<SearchState>) => `/search${searchQueryString(s)}`;

/** The fields of a listing the URL-level filters read. */
export interface SearchableListing {
  title?: string;
  sellerName?: string;
  category?: string;
  subcategory?: string;
  primaryLocation?: string;
  extraLocations?: string[];
}

/**
 * Whether a listing serves the named area. Extra locations are a paid add-on
 * and the card lists them, so a post is findable by any area it serves.
 * locationMatchKey folds the picker's disambiguating " City" suffix so "New
 * York City, New York" finds a post stored as "New York, New York".
 */
export function servesLocation(listing: SearchableListing, location: string): boolean {
  if (!location) return true;
  const areas = [
    ...(listing.primaryLocation ? [listing.primaryLocation] : []),
    ...(listing.extraLocations ?? []),
  ];
  if (areas.length === 0) return false;
  const a = locationMatchKey(location);
  return areas.some((loc) => {
    const b = locationMatchKey(loc);
    if (a.includes(b) || b.includes(a)) return true;
    const cityA = a.split(',')[0].trim();
    const cityB = b.split(',')[0].trim();
    return cityA.length > 0 && cityA === cityB;
  });
}

/** The filters a /search URL expresses: text, category, subcategory and area. */
export function matchesSearch(listing: SearchableListing, s: Pick<SearchState, 'q' | 'category' | 'subcategory' | 'location'>): boolean {
  const q = s.q.toLowerCase();
  const matchesText = !q ||
    Boolean(listing.title?.toLowerCase().includes(q)) ||
    Boolean(listing.sellerName?.toLowerCase().includes(q)) ||
    Boolean(listing.category?.toLowerCase().includes(q));
  return matchesText &&
    (!s.category || listing.category === s.category) &&
    (!s.subcategory || listing.subcategory === s.subcategory) &&
    servesLocation(listing, s.location);
}
