// XML sitemaps. /sitemap.xml is an index pointing at /sitemap-static.xml,
// /sitemap-categories.xml and /sitemap-listings-N.xml (5,000 listings per file,
// the safe side of the 50,000-URL spec limit). Only active listings that
// already have a permanent /posts/ address are included — drafts, paused,
// deleted and unclaimed-then-claimed originals never appear.
//
// GIG-77: lastmod is each listing's own updatedAt, read from the listings
// themselves, so an edit shows up here the next time the sitemap is built.
// Category, service and city results pages that have listings are listed too,
// dated by their most recently updated listing.
import { SITE_URL } from '../src/seo/slug.js';
import { searchPath, servesLocation } from '../src/seo/search.js';
import { fetchJson, loadServices, str, type ServiceRow } from './_lib/shell.js';

type Query = Record<string, string | string[] | undefined>;
interface Req { query: Query }
interface Res { statusCode: number; setHeader(name: string, value: string): void; end(body?: string): void }

const CHUNK = 5000;
const CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

const STATIC_PAGES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/search', changefreq: 'daily', priority: '0.9' },
  { path: '/for-sellers', changefreq: 'monthly', priority: '0.6' },
  { path: '/affiliate', changefreq: 'monthly', priority: '0.4' },
  { path: '/about', changefreq: 'monthly', priority: '0.4' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.2' },
];

interface ListingEntry { path: string; lastmod: string; image?: string }
interface Live {
  path: string;
  modified: number;
  image?: string;
  category: string;
  subcategory: string;
  areas: string[];
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const newestFirst = (a: { lastmod: string; path: string }, b: { lastmod: string; path: string }) =>
  (a.lastmod < b.lastmod ? 1 : a.lastmod > b.lastmod ? -1 : a.path.localeCompare(b.path));

let liveCache: { rows: Live[]; expires: number } | null = null;

/** The listings that belong in the sitemap, from the listings table itself. */
async function loadLive(): Promise<Live[]> {
  const now = Date.now();
  if (liveCache && liveCache.expires > now) return liveCache.rows;
  const services = await loadServices();
  let rows: Live[] = services
    .filter((s): s is ServiceRow & { seoPath: string } =>
      s.status === 'active' && typeof s.seoPath === 'string' && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(s.seoPath))
    .map((s) => {
      const images = Array.isArray(s.images) ? (s.images as unknown[]).filter((i): i is string => typeof i === 'string' && Boolean(i)) : [];
      const image = typeof s.ogImage === 'string' && s.ogImage ? s.ogImage : images[0];
      return {
        path: `/posts/${s.seoPath}`,
        modified: Number(s.updatedAt) || Number(s.createdAt) || now,
        ...(image ? { image } : {}),
        category: typeof s.category === 'string' ? s.category : '',
        subcategory: typeof s.subcategory === 'string' ? s.subcategory : '',
        areas: [s.primaryLocation, ...(Array.isArray(s.extraLocations) ? s.extraLocations : [])]
          .filter((a): a is string => typeof a === 'string' && Boolean(a.trim())),
      };
    });

  // The listings read failing outright must not empty the sitemap: fall back
  // to seoIndex (paths and the dates recorded when they were indexed).
  if (rows.length === 0 && services.length === 0) {
    const index = await fetchJson<Record<string, { p?: string; m?: number; i?: string }>>('seoIndex');
    rows = Object.values(index ?? {})
      .filter((r) => r && typeof r.p === 'string' && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(r.p))
      .map((r) => ({ path: `/posts/${r.p}`, modified: r.m ?? now, ...(r.i ? { image: r.i } : {}), category: '', subcategory: '', areas: [] }));
  }
  liveCache = { rows, expires: now + 10 * 60_000 };
  return rows;
}

function listingEntries(live: Live[]): ListingEntry[] {
  return live
    .map((l) => ({ path: l.path, lastmod: day(l.modified), ...(l.image ? { image: l.image } : {}) }))
    .sort(newestFirst);
}

/**
 * Every results page with something on it: each category and service, each
 * area a listing serves, and each category / service in each area. These are
 * the pages api/page.ts serves as indexable, with the same URL as their
 * canonical (searchPath).
 */
function categoryEntries(live: Live[]): ListingEntry[] {
  const pages = new Map<string, number>();
  const add = (path: string, modified: number) => pages.set(path, Math.max(pages.get(path) ?? 0, modified));
  const areas = new Set(live.flatMap((l) => l.areas));
  for (const l of live) {
    if (l.category) add(searchPath({ category: l.category }), l.modified);
    if (l.category && l.subcategory) add(searchPath({ category: l.category, subcategory: l.subcategory }), l.modified);
  }
  for (const area of areas) {
    // Same matching as the search page, so a listed URL never comes up empty.
    for (const l of live.filter((x) => servesLocation({ primaryLocation: x.areas[0], extraLocations: x.areas.slice(1) }, area))) {
      add(searchPath({ location: area }), l.modified);
      if (l.category) add(searchPath({ category: l.category, location: area }), l.modified);
      if (l.category && l.subcategory) add(searchPath({ category: l.category, subcategory: l.subcategory, location: area }), l.modified);
    }
  }
  return [...pages].map(([path, modified]) => ({ path, lastmod: day(modified) })).sort(newestFirst);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function urlset(items: string[], withImages = false): string {
  const ns = withImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${ns}>\n${items.join('\n')}\n</urlset>\n`;
}

function send(res: Res, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', status === 200 ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', CACHE);
  // Deliberately no X-Robots-Tag here. Marking the sitemap noindex looks tidy
  // — it keeps the XML itself out of results — but Google treats the header as
  // covering the sitemap as a document and then refuses to process it at all:
  // Search Console reports "Sitemap could not be read" with 0 pages discovered,
  // which is exactly what the first submission returned. Sitemap files do not
  // get indexed as results in practice, so there is nothing to suppress.
  res.end(body);
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const name = str(req.query.name);
  const today = day(Date.now());

  if (!name) {
    const live = await loadLive();
    const listings = listingEntries(live);
    const categories = categoryEntries(live);
    const chunks = Math.max(1, Math.ceil(listings.length / CHUNK));
    const maps = [
      { loc: `${SITE_URL}/sitemap-static.xml`, lastmod: today },
      ...(categories.length ? [{ loc: `${SITE_URL}/sitemap-categories.xml`, lastmod: categories[0].lastmod }] : []),
      ...Array.from({ length: chunks }, (_, i) => ({
        loc: `${SITE_URL}/sitemap-listings-${i + 1}.xml`,
        lastmod: listings[i * CHUNK]?.lastmod ?? today,
      })),
    ];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${maps
      .map((m) => `  <sitemap><loc>${esc(m.loc)}</loc><lastmod>${m.lastmod}</lastmod></sitemap>`)
      .join('\n')}\n</sitemapindex>\n`;
    send(res, 200, body);
    return;
  }

  if (name === 'static') {
    send(res, 200, urlset(STATIC_PAGES.map((p) =>
      `  <url><loc>${esc(SITE_URL + p.path)}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`)));
    return;
  }

  if (name === 'categories') {
    const pages = categoryEntries(await loadLive());
    send(res, 200, urlset(pages.map((p) =>
      `  <url><loc>${esc(SITE_URL + p.path)}</loc><lastmod>${p.lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`)));
    return;
  }

  const m = /^listings-(\d+)$/.exec(name);
  if (m) {
    const page = Number(m[1]);
    const listings = listingEntries(await loadLive());
    const slice = listings.slice((page - 1) * CHUNK, page * CHUNK);
    if (page < 1 || (slice.length === 0 && page !== 1)) { send(res, 404, 'Not found'); return; }
    // Declaring the primary image ties it to this listing for Google Images;
    // the client-rendered gallery alone does not do that reliably.
    send(res, 200, urlset(slice.map((l) =>
      `  <url><loc>${esc(SITE_URL + l.path)}</loc><lastmod>${l.lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>`
      + (l.image ? `<image:image><image:loc>${esc(l.image)}</image:loc></image:image>` : '')
      + `</url>`), true));
    return;
  }

  send(res, 404, 'Not found');
}
