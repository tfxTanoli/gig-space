// "More like this" on a listing page (GIG-77): crawlable links between
// listings, chosen identically by the server renderer and the browser so the
// first HTML and the live page show the same ones. Both choose from the same
// window: the newest RELATED_POOL listings by createdAt.

import { servesLocation } from './search.js';

export const RELATED_POOL = 100;
export const RELATED_MAX = 6;

export interface RelatableListing {
  id: string;
  status?: string;
  seoPath?: string;
  category?: string;
  subcategory?: string;
  primaryLocation?: string;
  extraLocations?: string[];
  createdAt?: number;
}

/**
 * Same service in the same city first, then the same service anywhere, then
 * the same category; newest first within each. Only live listings with a
 * permanent address qualify, so every link is a page that will be indexed.
 */
export function pickRelated<T extends RelatableListing>(listing: RelatableListing, pool: T[], max = RELATED_MAX): T[] {
  const city = listing.primaryLocation ?? '';
  const rank = (c: T): number => {
    const sameService = Boolean(listing.subcategory) && c.subcategory === listing.subcategory;
    const sameCategory = Boolean(listing.category) && c.category === listing.category;
    if (sameService && city && servesLocation(c, city)) return 0;
    if (sameService) return 1;
    if (sameCategory) return 2;
    return 3;
  };
  return pool
    .filter((c) => c.id !== listing.id && c.status === 'active' && Boolean(c.seoPath))
    .map((c) => ({ c, r: rank(c) }))
    .filter(({ r }) => r < 3)
    .sort((a, b) => a.r - b.r || (b.c.createdAt ?? 0) - (a.c.createdAt ?? 0) || a.c.id.localeCompare(b.c.id))
    .slice(0, max)
    .map(({ c }) => c);
}

/** "More Junk Removal near Dallas, TX" — the related section's heading on both sides. */
export function relatedHeading(ctx: { serviceLabel: string; area: string }): string {
  return `More ${ctx.serviceLabel}${ctx.area ? ` near ${ctx.area}` : ''}`;
}
