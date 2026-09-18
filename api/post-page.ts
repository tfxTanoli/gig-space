// Server-rendered <head> for public listing pages.
//
// vercel.json rewrites /posts/{business}/{slug} (and the legacy
// /service-detail?id=) here. The function resolves the listing, builds the
// title / description / canonical / Open Graph / JSON-LD block, and injects it
// into the built SPA shell (index.html) so crawlers and link previews see real
// metadata without a client render. The React app then boots as usual.
import { buildHeadHtml, buildJsonLd, buildSeoContext, ratingSummary, type CategoryLabels, type SeoListing } from '../src/seo/meta.js';
import { SITE_NAME, SITE_URL } from '../src/seo/slug.js';

type Query = Record<string, string | string[] | undefined>;
interface Req { headers: Record<string, string | string[] | undefined>; query: Query; url?: string }
interface Res {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
  redirect(status: number, url: string): void;
}

const DB_URL = (process.env.VITE_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '');
const SEGMENT_RE = /^[a-z0-9-]+$/;
const ID_RE = /^[A-Za-z0-9_-]+$/;
const PAGE_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
const REDIRECT_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
// A miss is usually temporary — a listing published seconds ago, or one whose
// address is still being assigned. Caching it as long as a real page would
// keep serving "not found" long after the listing goes live.
const MISS_CACHE = 'public, max-age=0, s-maxage=30';

type LabelMap = { categories: Record<string, { label?: string }>; subcategories: Record<string, Record<string, { label?: string }>> };
let labelsCache: { value: LabelMap; expires: number } | null = null;
let shellCache: { origin: string; html: string; expires: number } | null = null;

async function fetchJson<T>(path: string): Promise<T | null> {
  if (!DB_URL) return null;
  try {
    const r = await fetch(`${DB_URL}/${path}.json`, { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function loadLabels(): Promise<CategoryLabels> {
  const now = Date.now();
  if (!labelsCache || labelsCache.expires < now) {
    const [categories, subcategories] = await Promise.all([
      fetchJson<LabelMap['categories']>('categories'),
      fetchJson<LabelMap['subcategories']>('subcategories'),
    ]);
    labelsCache = { value: { categories: categories ?? {}, subcategories: subcategories ?? {} }, expires: now + 5 * 60_000 };
  }
  const { categories, subcategories } = labelsCache.value;
  return {
    category: (key) => categories[key]?.label ?? key,
    subcategory: (cat, key) => subcategories[cat]?.[key]?.label ?? key,
  };
}

function requestOrigin(req: Req): string {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim();
  return host ? `https://${host}` : SITE_URL;
}

// The built index.html carries the hashed asset URLs for this deployment, so
// read it from the deployment itself rather than guessing at build output.
async function loadShell(origin: string): Promise<string | null> {
  const now = Date.now();
  if (shellCache && shellCache.origin === origin && shellCache.expires > now) return shellCache.html;
  try {
    const r = await fetch(`${origin}/index.html`, { headers: { accept: 'text/html' } });
    if (!r.ok) throw new Error(`shell ${r.status}`);
    const html = await r.text();
    if (!html.includes('</head>')) throw new Error('shell missing </head>');
    shellCache = { origin, html, expires: now + 60_000 };
    return html;
  } catch {
    return shellCache?.origin === origin ? shellCache.html : null;
  }
}

function injectHead(shell: string, head: string): string {
  // The shell carries site-wide defaults (description, canonical, OG, Twitter)
  // for every other page. A listing supplies its own, so drop the defaults
  // rather than emit both — two og:title tags is worse than none.
  return shell
    .replace(/<!--seo-defaults-->[\s\S]*?<!--\/seo-defaults-->\s*/i, '')
    .replace(/<title>[^<]*<\/title>\s*/i, '')
    .replace('</head>', `    ${head}\n  </head>`);
}

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function sendHtml(res: Res, status: number, html: string, cache: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(html);
}

function redirect(res: Res, location: string): void {
  res.setHeader('Cache-Control', REDIRECT_CACHE);
  res.redirect(301, location);
}

/** Fallback shell for missing / unpublished listings: never indexed. */
function notFoundHead(reason: string): string {
  return [
    `<title>${reason} | ${SITE_NAME}</title>`,
    `<meta name="robots" content="noindex,follow">`,
  ].join('\n    ');
}

type ServiceRecord = SeoListing & { status?: string; seoRedirectTo?: string };

export default async function handler(req: Req, res: Res): Promise<void> {
  const origin = requestOrigin(req);
  const shell = await loadShell(origin);
  if (!shell) {
    res.statusCode = 503;
    res.setHeader('Retry-After', '10');
    res.end('Temporarily unavailable');
    return;
  }

  const business = str(req.query.business);
  const slug = str(req.query.slug);
  const legacyId = str(req.query.id);

  // Anything under /posts/ that isn't exactly two segments — a trailing slash,
  // a bare business, extra depth — is not a page. Answer 404 rather than let the
  // SPA catch-all return 200 for an unbounded URL space.
  if (str(req.query.notfound)) {
    sendHtml(res, 404, injectHead(shell, notFoundHead('Post not found')), MISS_CACHE);
    return;
  }

  let serviceId: string | null = null;
  let legacy = false;
  if (business && slug) {
    if (!SEGMENT_RE.test(business) || !SEGMENT_RE.test(slug)) {
      sendHtml(res, 404, injectHead(shell, notFoundHead('Post not found')), MISS_CACHE);
      return;
    }
    const mapped = await fetchJson<string>(`seoPaths/${business}/${slug}`);
    serviceId = typeof mapped === 'string' ? mapped : null;
  } else if (legacyId) {
    legacy = true;
    serviceId = ID_RE.test(legacyId) ? legacyId : null;
  }

  if (!serviceId) {
    sendHtml(res, 404, injectHead(shell, notFoundHead('Post not found')), MISS_CACHE);
    return;
  }

  const service = await fetchJson<ServiceRecord>(`services/${serviceId}`);
  if (!service || service.status === 'deleted') {
    sendHtml(res, 404, injectHead(shell, notFoundHead('Post not found')), MISS_CACHE);
    return;
  }
  service.id = serviceId;

  // Old address, or a path that no longer matches the listing's permanent one.
  const canonicalPath = service.seoPath ? `/posts/${service.seoPath}` : null;
  if (canonicalPath && (legacy || `${business}/${slug}` !== service.seoPath)) {
    redirect(res, canonicalPath);
    return;
  }

  if (service.status !== 'active') {
    // A generated listing that its owner claimed lives on as the seller's own
    // post — send the old URL there so its links and rankings carry over.
    if (service.seoRedirectTo && ID_RE.test(service.seoRedirectTo)) {
      const target = await fetchJson<ServiceRecord>(`services/${service.seoRedirectTo}`);
      if (target?.status === 'active' && target.seoPath) {
        redirect(res, `/posts/${target.seoPath}`);
        return;
      }
    }
    sendHtml(res, 200, injectHead(shell, notFoundHead('Listing unavailable')), MISS_CACHE);
    return;
  }

  const labels = await loadLabels();
  const reviews = service.isGenerated || service.placeId
    ? null
    : await fetchJson<Record<string, { rating?: number }>>(`serviceReviews/${serviceId}`);
  const rating = ratingSummary(
    service,
    reviews ? Object.values(reviews).map((r) => ({ rating: Number(r?.rating) || 0 })) : undefined,
  );

  const ctx = buildSeoContext(service, labels);
  // Without a permanent address the only URL we could offer is the legacy
  // /service-detail?id= query form. That is not a canonical we want indexed, so
  // the page is served noindex until the address is assigned.
  const head = [
    buildHeadHtml(ctx, buildJsonLd(service, ctx, rating), { index: Boolean(service.seoPath) }),
    `<script>window.__SEO_ROUTE__=${JSON.stringify({ path: service.seoPath ?? null, serviceId }).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');

  sendHtml(res, 200, injectHead(shell, head), PAGE_CACHE);
}
