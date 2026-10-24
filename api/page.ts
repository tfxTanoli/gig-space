// Server-rendered public pages other than listings (GIG-77): /, /search (and
// every category / city / page variant of it), /for-sellers, /about,
// /affiliate, /terms and /privacy.
//
// vercel.json rewrites each of those paths here with ?ssr_route=. The response
// is the built app shell with the page's own <head> (unique title, 140–160
// character description, self-referencing canonical, matching Open Graph) and
// its content already in the HTML. The React app then boots and takes over.
// Any failure falls back to the plain shell, so the site never breaks over SEO.
import { searchMeta, searchHeading, buildPageHeadHtml, STATIC_PAGES, type StaticPath } from '../src/seo/pages.js';
import { matchesSearch, readSearchState } from '../src/seo/search.js';
import { renderAbout, renderAffiliate, renderHome, renderLegal, renderSearch, renderSellers, type CardListing } from '../src/seo/render.js';
import { AFFILIATE, SELLERS, cmsFaqList } from '../src/content/marketing.js';
import {
  PAGE_CACHE, fetchJson, injectBody, injectHead, loadLabels, loadServices, loadShell, requestOrigin, sendHtml, str,
  type Req, type Res,
} from './_lib/shell.js';

const ROUTES: Record<string, StaticPath | '/search'> = {
  home: '/',
  search: '/search',
  'for-sellers': '/for-sellers',
  about: '/about',
  affiliate: '/affiliate',
  terms: '/terms',
  privacy: '/privacy',
};

async function legal(key: 'terms' | 'privacy'): Promise<{ html: string; updatedAt: number | null }> {
  const [html, ts] = await Promise.all([
    fetchJson<string>(`cms/${key}`),
    fetchJson<number>(`cms/${key}UpdatedAt`),
  ]);
  return { html: typeof html === 'string' ? html : '', updatedAt: typeof ts === 'number' && ts > 0 ? ts : null };
}

async function render(route: StaticPath | '/search', req: Req): Promise<{ head: string; body: string }> {
  if (route === '/search') {
    const state = readSearchState(req.query);
    const [labels, services] = await Promise.all([loadLabels(), loadServices()]);
    const results = services.filter((s) => s.status === 'active' && matchesSearch(s as CardListing, state)) as CardListing[];
    const meta = searchMeta(state, labels, results.length);
    return {
      head: buildPageHeadHtml(meta),
      body: renderSearch({
        state,
        heading: searchHeading(state, labels),
        results,
        categories: labels.categories,
        categoryLabel: labels.category,
        subcategoryLabel: labels.subcategory,
      }),
    };
  }

  const head = buildPageHeadHtml(STATIC_PAGES[route]);
  switch (route) {
    case '/for-sellers':
      return { head, body: renderSellers(cmsFaqList(await fetchJson('cms/faqs')) ?? SELLERS.defaultFaqs) };
    case '/affiliate':
      return { head, body: renderAffiliate(cmsFaqList(await fetchJson('cms/affiliateFaqs')) ?? AFFILIATE.defaultFaqs) };
    case '/about':
      return { head, body: renderAbout() };
    case '/terms': {
      const t = await legal('terms');
      return { head, body: renderLegal('Terms & Conditions', t.html, t.updatedAt) };
    }
    case '/privacy': {
      const p = await legal('privacy');
      return { head, body: renderLegal('Privacy Policy', p.html, p.updatedAt) };
    }
    default:
      return { head, body: renderHome() };
  }
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const origin = requestOrigin(req);
  const shell = await loadShell(origin);
  if (!shell) {
    res.statusCode = 503;
    res.setHeader('Retry-After', '10');
    res.end('Temporarily unavailable');
    return;
  }

  const route = ROUTES[str(req.query.ssr_route)] ?? '/';
  try {
    const { head, body } = await render(route, req);
    sendHtml(res, 200, injectBody(injectHead(shell, head), body), PAGE_CACHE);
  } catch (err) {
    console.error(`[page] render failed for ${route}:`, err instanceof Error ? err.message : err);
    // The plain shell still boots the full app; just don't cache it for long.
    sendHtml(res, 200, shell, 'public, max-age=0, s-maxage=30');
  }
}
