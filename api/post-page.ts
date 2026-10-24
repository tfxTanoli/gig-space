// Server-rendered public listing pages.
//
// vercel.json rewrites /posts/{business}/{slug} (and the legacy
// /service-detail?id=) here. The function resolves the listing, builds the
// title / description / canonical / Open Graph / JSON-LD block, and injects it
// into the built SPA shell so crawlers and link previews see real metadata
// without a client render. Since GIG-77 the listing's content is in the HTML
// too — breadcrumbs, heading, business, service area, price, photos with alt
// text, the full description and related listings — so search engines index
// the page without running JavaScript. The React app then boots and takes over.
import { buildHeadHtml, buildJsonLd, buildSeoContext, ratingSummary, resolveCategoryLabel, type SeoListing } from '../src/seo/meta.js';
import { SITE_NAME } from '../src/seo/slug.js';
import { pickRelated, RELATED_POOL } from '../src/seo/related.js';
import { renderListing, type CardListing } from '../src/seo/render.js';
import {
  MISS_CACHE, PAGE_CACHE, fetchJson, injectBody, injectHead, loadLabels, loadServices, loadShell, requestOrigin, sendHtml, str,
  type Req, type Res,
} from './_lib/shell.js';

const SEGMENT_RE = /^[a-z0-9-]+$/;
const ID_RE = /^[A-Za-z0-9_-]+$/;
const REDIRECT_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

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

  const [labels, reviews, services] = await Promise.all([
    loadLabels(),
    service.isGenerated || service.placeId
      ? Promise.resolve(null)
      : fetchJson<Record<string, { rating?: number }>>(`serviceReviews/${serviceId}`),
    loadServices(),
  ]);
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

  // The app picks related listings from the same window (src/seo/related.ts).
  const related = pickRelated(service, services.slice(0, RELATED_POOL) as CardListing[]);
  const body = renderListing({
    listing: service,
    ctx,
    categoryLabel: resolveCategoryLabel(service, labels),
    subcategoryLabel: service.subcategory ? labels.subcategory(service.category ?? '', service.subcategory) : null,
    related,
  });

  sendHtml(res, 200, injectBody(injectHead(shell, head), body), PAGE_CACHE);
}
