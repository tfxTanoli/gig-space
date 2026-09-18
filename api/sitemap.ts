// XML sitemaps. /sitemap.xml is an index pointing at /sitemap-static.xml and
// /sitemap-listings-N.xml (5,000 listings per file, the safe side of the
// 50,000-URL spec limit). Only active listings that already have a permanent
// /posts/ address are included — drafts, paused, deleted and unclaimed-then-
// claimed originals never appear.
import { SITE_URL } from '../src/seo/slug.js';

type Query = Record<string, string | string[] | undefined>;
interface Req { query: Query }
interface Res { statusCode: number; setHeader(name: string, value: string): void; end(body?: string): void }

const DB_URL = (process.env.VITE_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '');
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

interface ListingEntry { path: string; lastmod: string }
let listingsCache: { entries: ListingEntry[]; expires: number } | null = null;

/** One compact record per publicly listed service: path and last-modified. */
type IndexRow = { p?: string; m?: number };

// Reads `seoIndex`, not `services`. The full service table carries descriptions,
// image arrays and scraped review metadata — roughly 2 KB per listing — and the
// sitemap needs two fields. src/seo/ensureSeoPath.ts maintains this node, and
// Admin → Listings → "Generate SEO URLs" rebuilds it from scratch if it drifts.
async function loadListings(): Promise<ListingEntry[]> {
  const now = Date.now();
  if (listingsCache && listingsCache.expires > now) return listingsCache.entries;
  let entries: ListingEntry[] = [];
  if (DB_URL) {
    try {
      const r = await fetch(`${DB_URL}/seoIndex.json`, { headers: { accept: 'application/json' } });
      const data = r.ok ? ((await r.json()) as Record<string, IndexRow> | null) : null;
      entries = Object.values(data ?? {})
        .filter((s): s is Required<Pick<IndexRow, 'p'>> & IndexRow =>
          !!s && typeof s.p === 'string' && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(s.p))
        .map((s) => ({
          path: `/posts/${s.p}`,
          lastmod: new Date(s.m ?? now).toISOString().slice(0, 10),
        }))
        .sort((a, b) => (a.lastmod < b.lastmod ? 1 : a.lastmod > b.lastmod ? -1 : a.path.localeCompare(b.path)));
    } catch {
      entries = listingsCache?.entries ?? [];
    }
  }
  listingsCache = { entries, expires: now + 10 * 60_000 };
  return entries;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function urlset(items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</urlset>\n`;
}

function send(res: Res, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', status === 200 ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', CACHE);
  res.setHeader('X-Robots-Tag', 'noindex');
  res.end(body);
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const name = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  const today = new Date().toISOString().slice(0, 10);

  if (!name) {
    const listings = await loadListings();
    const chunks = Math.max(1, Math.ceil(listings.length / CHUNK));
    const maps = [
      { loc: `${SITE_URL}/sitemap-static.xml`, lastmod: today },
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

  const m = /^listings-(\d+)$/.exec(name);
  if (m) {
    const page = Number(m[1]);
    const listings = await loadListings();
    const slice = listings.slice((page - 1) * CHUNK, page * CHUNK);
    if (page < 1 || (slice.length === 0 && page !== 1)) { send(res, 404, 'Not found'); return; }
    send(res, 200, urlset(slice.map((l) =>
      `  <url><loc>${esc(SITE_URL + l.path)}</loc><lastmod>${l.lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`)));
    return;
  }

  send(res, 404, 'Not found');
}
