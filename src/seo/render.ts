// Server-rendered content for the public pages (GIG-77). The Vercel functions
// put this in the first HTML response so search engines (and anyone before
// the JavaScript runs) get the page's real content: headings, text, photos
// with alt text, breadcrumbs and plain <a href> links to every listing,
// category and results page. Everyone gets the same HTML; once the app has
// loaded, src/ssrHandoff.ts swaps it for the live page showing the same thing.
//
// The markup mirrors the React pages' layout and classes so the swap is
// barely visible. Text comes from the same sources the pages use
// (src/content/marketing.ts, the CMS, the listing records), never a copy.
// Nothing here may import firebase or touch the DOM.

import { SITE_NAME } from './slug.js';
import { listingPath, type SeoContext, type SeoListing } from './meta.js';
import { ITEMS_PER_PAGE, searchPath, type SearchState } from './search.js';
import { relatedHeading } from './related.js';
import { formatAmount } from '../utils/currency.js';
import {
  ABOUT, AFFILIATE, COPYRIGHT, FAQ_HEADING, FOOTER_LINKS, HOME, MISSION,
  POPULAR_CATEGORIES, POPULAR_CATEGORIES_HEADING, SELLERS, type Faq, type Feature, type Step,
} from '../content/marketing.js';
import { LOGO_GRADIENT, LOGO_MARK_PATH, LOGO_VIEWBOX, LOGO_WORD_PATH } from '../content/logo.js';

/* ─── Escaping ─────────────────────────────────────────────────────────────── */

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RICH_TAGS = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span'];
const RICH_TAG_SET = new Set(RICH_TAGS);
const BARE_TAG = new RegExp(`<(?!/?(?:${RICH_TAGS.join('|')})>)`, 'g');

/**
 * The server-side twin of src/utils/sanitize.ts: keeps the same small set of
 * formatting tags, attributes stripped, and drops everything else to its text.
 * Seller descriptions are untrusted, so the output is built to contain nothing
 * but those bare tags, balanced, plus escaped text — any other "<" is escaped.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  const open: string[] = [];
  let out = String(html ?? '')
    .replace(/<(script|style|iframe|object|embed|template|noscript|textarea|title)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g, (m, rawTag: string) => {
      const tag = rawTag.toLowerCase();
      if (!RICH_TAG_SET.has(tag)) return '';
      if (tag === 'br') return '<br>';
      if (!m.startsWith('</')) { open.push(tag); return `<${tag}>`; }
      // A close with no matching open would close the page's own markup.
      const at = open.lastIndexOf(tag);
      if (at === -1) return '';
      const closing = open.splice(at).reverse();
      return closing.map((t) => `</${t}>`).join('');
    })
    .replace(BARE_TAG, '&lt;')
    .replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
  out += open.reverse().map((t) => `</${t}>`).join('');
  return out;
}

/* ─── Shared chrome ────────────────────────────────────────────────────────── */

const logo = (href = '/') => `<a href="${href}" class="inline-flex items-center" aria-label="${SITE_NAME} home">`
  + `<svg class="text-white h-6 shrink-0" viewBox="${LOGO_VIEWBOX}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
  + `<path d="${LOGO_MARK_PATH}" fill="url(#gs_ssr)"/><path d="${LOGO_WORD_PATH}" fill="currentColor"/>`
  + `<defs><linearGradient id="gs_ssr" x1="${LOGO_GRADIENT.x1}" y1="${LOGO_GRADIENT.y1}" x2="${LOGO_GRADIENT.x2}" y2="${LOGO_GRADIENT.y2}" gradientUnits="userSpaceOnUse">`
  + LOGO_GRADIENT.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('')
  + `</linearGradient></defs></svg></a>`;

interface NavLink { href: string; label: string }

function header(links: NavLink[], opts: { logoHref?: string; bordered?: boolean } = {}): string {
  return `<header class="safe-header w-full px-4 md:px-6 lg:px-12 flex justify-between items-center${opts.bordered ? ' border-b border-slate-800' : ''}">`
    + logo(opts.logoHref)
    + `<nav class="flex items-center gap-4 md:gap-6 text-sm font-medium">`
    + links.map((l, i) => i === links.length - 1
      ? `<a href="${esc(l.href)}" class="text-slate-300 hover:text-white px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors whitespace-nowrap">${esc(l.label)}</a>`
      : `<a href="${esc(l.href)}" class="hidden sm:inline text-slate-300 hover:text-white transition-colors whitespace-nowrap">${esc(l.label)}</a>`).join('')
    + `</nav></header>`;
}

const BUYER_NAV: NavLink[] = [
  { href: '/for-sellers', label: 'For Sellers' },
  { href: '/affiliate', label: 'Become an Affiliate' },
  { href: '/signin?next=/buyer-dashboard', label: 'Log in' },
  { href: '/signup', label: 'Sign up' },
];

/** The pages' footer exactly — nothing here that the live page doesn't show. */
function footer(): string {
  return `<footer class="border-t border-slate-800 mt-12 py-12 px-6 lg:px-12 text-center text-sm text-slate-500">`
    + `<div class="flex flex-wrap justify-center gap-6 md:gap-8 mb-8">`
    + FOOTER_LINKS.map((l) => `<a href="${esc(l.to)}" class="hover:text-slate-300 transition-colors">${esc(l.label)}</a>`).join('')
    + `</div><p>${esc(COPYRIGHT)}</p></footer>`;
}

const page = (body: string) => `<div class="min-h-screen bg-background text-white font-sans flex flex-col">${body}</div>`;

const featureList = (items: Feature[]) =>
  `<div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">`
  + items.map((f) => `<p class="text-slate-300 text-base leading-relaxed"><span class="font-bold text-white mr-1">${esc(f.title)}</span>${esc(f.description)}</p>`).join('')
  + `</div>`;

const sectionHead = (eyebrow: string, heading: string, intro: string) =>
  `<div class="mb-16 max-w-2xl">`
  + (eyebrow ? `<span class="text-primary text-sm font-semibold tracking-wide block mb-3">${esc(eyebrow)}</span>` : '')
  + `<h2 class="text-3xl md:text-4xl font-bold gradient-heading mb-6">${esc(heading)}</h2>`
  + `<p class="text-slate-400 text-lg leading-relaxed">${esc(intro)}</p></div>`;

const steps = (items: Step[], href: string) =>
  `<div class="grid grid-cols-1 md:grid-cols-3 gap-10">`
  + items.map((s) => `<div class="flex flex-col items-start"><h3 class="text-white font-bold mb-3 text-lg">${esc(s.title)}</h3>`
    + `<p class="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">${esc(s.description)}</p>`
    + `<a href="${esc(href)}" class="text-primary text-sm font-semibold hover:text-blue-400 transition-colors">${esc(s.link)} →</a></div>`).join('')
  + `</div>`;

const faqs = (items: Faq[]) =>
  `<section class="px-6 lg:px-12 py-24 max-w-4xl mx-auto w-full"><h2 class="text-2xl font-bold gradient-heading mb-10">${esc(FAQ_HEADING)}</h2>`
  + items.map((f) => `<div class="border-b border-slate-800/80 py-6"><h3 class="font-medium text-white mb-2">${esc(f.question)}</h3>`
    + `<p class="text-slate-400 text-sm leading-relaxed">${esc(f.answer)}</p></div>`).join('')
  + `</section>`;

const mission = () =>
  `<section class="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full"><div class="grid grid-cols-1 lg:grid-cols-2 gap-16"><div>`
  + `<h2 class="text-3xl font-bold gradient-heading mb-6">${esc(MISSION.heading)}</h2>`
  + `<div class="space-y-6 text-slate-400 leading-relaxed text-[15px]">${MISSION.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>`
  + `<div class="flex flex-col justify-start space-y-10 lg:pl-32 lg:pt-[60px]">`
  + MISSION.stats.map((s) => `<div><div class="text-4xl md:text-5xl font-bold text-white mb-2">${esc(s.value)}</div><div class="text-slate-500 text-sm">${esc(s.label)}</div></div>`).join('')
  + `</div></div></section>`;

const cta = (lines: string[], href: string, label: string, text = '') =>
  `<section class="py-24 px-6 text-center"><h2 class="text-3xl md:text-4xl font-bold gradient-heading mb-6 leading-tight">${lines.map(esc).join('<br>')}</h2>`
  + (text ? `<p class="text-slate-400 text-lg mb-10 max-w-xl mx-auto">${esc(text)}</p>` : '')
  + `<a href="${esc(href)}" class="inline-flex items-center px-5 py-2 text-sm bg-white text-background font-semibold rounded-full hover:bg-slate-200 transition-colors">${esc(label)} →</a></section>`;

const hero = (badge: string, h1: string[], intro: string[], button?: NavLink) =>
  `<section class="flex flex-col items-center justify-center pt-12 md:pt-24 pb-16 md:pb-20 px-4 text-center">`
  + (badge ? `<div class="inline-flex items-center border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-6 md:mb-8">${esc(badge)}</div>` : '')
  + `<h1 class="text-[2.75rem] leading-[1.08] md:text-5xl md:leading-tight lg:text-6xl font-bold gradient-heading tracking-tight mb-4 md:mb-6 max-w-4xl">${h1.map(esc).join(' ')}</h1>`
  + `<p class="text-slate-300 text-base md:text-lg max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed">${intro.map(esc).join(' ')}</p>`
  + (button ? `<a href="${esc(button.href)}" class="inline-flex items-center bg-white hover:bg-slate-200 text-background font-semibold py-2 px-5 text-sm rounded-full transition-colors">${esc(button.label)} →</a>` : '')
  + `</section>`;

const categoryLinks = () =>
  `<section class="px-4 md:px-6 lg:px-12 py-10 md:py-16"><h2 class="text-base md:text-lg font-semibold text-slate-300 mb-6 md:mb-10 max-w-7xl mx-auto">${esc(POPULAR_CATEGORIES_HEADING)}</h2>`
  + `<ul class="flex flex-wrap gap-x-8 gap-y-4 max-w-7xl mx-auto">`
  + POPULAR_CATEGORIES.map((c) => `<li><a href="${esc(searchPath({ category: c }))}" class="text-sm font-medium text-slate-300 hover:text-white transition-colors">${esc(c)}</a></li>`).join('')
  + `</ul></section>`;

/* ─── Marketing pages ──────────────────────────────────────────────────────── */

export function renderHome(): string {
  return page(
    header(BUYER_NAV)
    + `<main>`
    + `<section class="flex flex-col items-center justify-center pt-10 md:pt-24 pb-12 md:pb-16 px-4 text-center">`
    + `<h1 class="text-[2.75rem] leading-[1.08] md:text-5xl md:leading-tight lg:text-6xl font-bold gradient-heading tracking-tight mb-4 md:mb-6">${HOME.h1.map(esc).join(' ')}</h1>`
    + `<p class="text-slate-300 text-base md:text-lg max-w-2xl mx-auto mb-8 md:mb-12">${HOME.intro.map(esc).join(' ')}</p>`
    // A real form, so searching works before the app loads (and without it).
    + `<form action="/search" method="get" role="search" class="w-full max-w-3xl flex items-center bg-surface-raised p-2 rounded-xl border border-slate-700/50">`
    + `<input type="search" name="q" placeholder="${esc(HOME.searchPlaceholder)}" aria-label="${esc(HOME.searchPlaceholder)}" class="w-full bg-transparent border-none text-white px-4 py-2 focus:outline-none text-base md:text-sm placeholder-slate-400">`
    + `<button type="submit" class="bg-primary text-white px-4 py-3 rounded-md text-sm font-medium shrink-0">Search</button></form>`
    + `</section>`
    + categoryLinks()
    + `<section class="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full">${sectionHead(HOME.featuresEyebrow, HOME.featuresHeading, HOME.featuresIntro)}${featureList(HOME.features)}</section>`
    + cta(HOME.ctaHeading, '/signup', HOME.ctaButton, HOME.ctaText)
    + `</main>`
    + footer(),
  );
}

export function renderSellers(faqList: Faq[]): string {
  return page(
    header([
      { href: '/', label: 'For Buyers' },
      { href: '/affiliate', label: 'Become an Affiliate' },
      { href: '/signin?next=/seller-dashboard', label: 'Log in' },
      { href: '/signup', label: 'Sign up' },
    ])
    + `<main>`
    + hero(SELLERS.badge, SELLERS.h1, SELLERS.intro, { href: '/signup', label: SELLERS.heroButton })
    + `<section class="px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">${sectionHead('', SELLERS.howHeading, SELLERS.howIntro)}${steps(SELLERS.steps, '/signup')}</section>`
    + mission()
    + `<section class="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full">${sectionHead(SELLERS.featuresEyebrow, SELLERS.featuresHeading, SELLERS.featuresIntro)}${featureList(SELLERS.features)}</section>`
    + faqs(faqList)
    + cta(SELLERS.ctaHeading, '/signup', SELLERS.ctaButton)
    + `</main>`
    + footer(),
  );
}

export function renderAbout(): string {
  return page(
    header(BUYER_NAV)
    + `<main>`
    + hero(ABOUT.badge, ABOUT.h1, [ABOUT.intro])
    + mission()
    + `<section class="px-6 lg:px-12 py-16 w-full max-w-7xl mx-auto"><div class="w-full h-auto md:h-[500px] rounded-2xl overflow-hidden">`
    + `<img src="${esc(encodeURI(ABOUT.image.src))}" alt="${esc(ABOUT.image.alt)}" loading="lazy" decoding="async" class="w-full h-full object-cover object-center"></div></section>`
    + `<section class="px-6 lg:px-12 py-16 max-w-7xl mx-auto w-full mb-8">${sectionHead('', ABOUT.valuesHeading, ABOUT.valuesIntro)}${featureList(ABOUT.values)}</section>`
    + cta(ABOUT.ctaHeading, '/signup', ABOUT.ctaButton)
    + `</main>`
    + footer(),
  );
}

export function renderAffiliate(faqList: Faq[]): string {
  const join = '/signup?next=/affiliate-dashboard';
  return page(
    header([
      { href: '/signin?next=/affiliate-dashboard', label: 'Affiliate Log In' },
      { href: join, label: AFFILIATE.heroButton },
    ])
    + `<main>`
    + hero(AFFILIATE.badge, AFFILIATE.h1, AFFILIATE.intro, { href: join, label: AFFILIATE.heroButton })
    + `<section class="px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">${sectionHead('', AFFILIATE.howHeading, AFFILIATE.howIntro)}${steps(AFFILIATE.steps, join)}</section>`
    + `<section class="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full">${sectionHead(AFFILIATE.earningsEyebrow, AFFILIATE.earningsHeading, AFFILIATE.earningsIntro)}`
    + `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">`
    + AFFILIATE.earnings.map((c) => `<div class="bg-surface-raised rounded-xl p-6 border border-slate-700/40"><p class="text-slate-400 text-sm font-medium mb-1">${esc(c.label)}</p>`
      + `<p class="text-white font-medium mb-3">${esc(c.service)}</p><p class="text-green-400 font-semibold text-sm">${esc(`${c.commission} ${c.emoji}`)}</p></div>`).join('')
    + `</div></section>`
    + categoryLinks()
    + faqs(faqList)
    + mission()
    + cta(AFFILIATE.ctaHeading, join, AFFILIATE.heroButton)
    + `</main>`
    + footer(),
  );
}

export function renderLegal(title: string, contentHtml: string, updatedAt: number | null): string {
  const updated = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : String(new Date().getUTCFullYear());
  // Same rule as the page: HTML from the CMS editor, or plain text kept as typed.
  const body = /<\/?[a-z][^>]*>/i.test(contentHtml)
    ? `<div class="text-slate-300 leading-relaxed text-[15px] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3 [&_li]:mb-1 [&_b]:text-white [&_strong]:text-white">${sanitizeRichText(contentHtml)}</div>`
    : `<div class="text-slate-300 leading-relaxed text-[15px] whitespace-pre-wrap">${esc(contentHtml)}</div>`;
  return page(
    header([{ href: '/signin', label: 'Log in' }, { href: '/signup', label: 'Sign up' }])
    + `<main class="flex-1 px-6 lg:px-12 py-16 max-w-4xl mx-auto w-full">`
    + `<div class="inline-block border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-8 tracking-wide">Legal</div>`
    + `<h1 class="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">${esc(title)}</h1>`
    + `<p class="text-slate-500 text-sm mb-12">Last updated: ${esc(updated)}</p>`
    + (contentHtml.trim() ? body : '')
    + `</main>`
    + footer(),
  );
}

/* ─── Listing cards (search results, related listings) ─────────────────────── */

/** A listing as the cards read it. */
export type CardListing = SeoListing & { status?: string };

function cardPrice(l: CardListing): string {
  const min = Number(l.priceMin ?? 0);
  if (l.priceType === 'contact_for_pricing') return `<span class="text-[13px] text-slate-100 leading-6">Contact for pricing</span>`;
  const suffix = l.priceType === 'per_hour' ? 'per hour' : 'per project';
  const price = l.priceMax ? `$${formatAmount(min)} – $${formatAmount(l.priceMax)}` : `$${formatAmount(min)}`;
  return `<span class="text-[13px] text-slate-100">From</span> <span class="font-bold text-white">${esc(price)}</span> <span class="text-[13px] text-slate-100">${suffix}</span>`;
}

// The same classes UserAvatar puts on an image avatar (src/UserAvatar.tsx): a
// light-mode stroke so a white or transparent logo has an edge, and business
// logos contained on a white disc rather than cropped.
const AVATAR_STROKE = 'light:outline light:outline-1 light:-outline-offset-1 light:outline-slate-600';
const avatarFit = (url: string) => (url.includes('listingLogos') ? 'object-contain p-px' : 'object-cover');

function card(l: CardListing, eager: boolean): string {
  const href = esc(listingPath(l));
  const image = (l.images ?? []).find(Boolean);
  const areas = (l as { offeredRemotely?: boolean }).offeredRemotely
    ? (l.primaryLocation ? `Remote (${l.primaryLocation})` : 'Remote')
    : [l.primaryLocation, ...(l.extraLocations ?? [])].filter(Boolean).join(' · ');
  const avatar = l.sellerPhotoURL
    ? `<img src="${esc(l.sellerPhotoURL)}" alt="" loading="lazy" class="w-8 h-8 rounded-full ${avatarFit(l.sellerPhotoURL)} bg-white flex-shrink-0 ${AVATAR_STROKE}">`
    : `<span class="w-8 h-8 text-sm rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0">${esc((l.sellerName ?? '?').charAt(0).toUpperCase())}</span>`;
  return `<article class="group block">`
    + `<div class="aspect-[4/3] w-full rounded-xl overflow-hidden mb-3 bg-surface-raised relative"><a href="${href}" class="block w-full h-full" tabindex="-1">`
    + (image
      ? `<img src="${esc(image)}" alt="${esc(l.title ?? '')}" ${eager ? '' : 'loading="lazy" '}decoding="async" class="w-full h-full object-cover">`
      : `<span class="w-full h-full flex items-center justify-center text-slate-600 text-xs">No image</span>`)
    + `</a></div>`
    + `<a href="${href}" class="block">`
    + `<div class="flex items-center gap-2 mb-2.5">${avatar}<span class="text-sm text-slate-300 truncate min-w-0">${esc(l.sellerName ?? '')}</span></div>`
    + `<h3 class="text-sm font-medium text-white mb-2 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:underline">${esc(l.title ?? '')}</h3>`
    + `<div class="flex items-center text-slate-400 text-[13px] mb-2 min-h-[18px]"><span class="truncate">${esc(areas)}</span></div>`
    + `<div class="flex items-baseline gap-1">${cardPrice(l)}</div>`
    + `</a></article>`;
}

const cardGrid = (items: CardListing[], eagerCount = 0) =>
  `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-8 md:gap-y-12 mb-10">${items.map((l, i) => card(l, i < eagerCount)).join('')}</div>`;

/* ─── Search results ───────────────────────────────────────────────────────── */

export interface SearchRender {
  state: SearchState;
  heading: string;
  /** All matching listings, newest first; this function slices the page. */
  results: CardListing[];
  categories: { value: string; label: string }[];
  categoryLabel: (key: string) => string;
  subcategoryLabel: (category: string, key: string) => string;
}

/** Page numbers to show, with gaps — the same window as the app's PaginationBar. */
export function pageWindow(current: number, total: number): (number | '…')[] {
  // 0-based, as the app counts.
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | '…')[] = [0];
  if (current > 3) pages.push('…');
  for (let i = Math.max(1, current - 2); i <= Math.min(total - 2, current + 2); i++) pages.push(i);
  if (current < total - 4) pages.push('…');
  pages.push(total - 1);
  return pages;
}

export function renderSearch(r: SearchRender): string {
  const { state } = r;
  const totalPages = Math.max(1, Math.ceil(r.results.length / ITEMS_PER_PAGE));
  const current = Math.min(state.page, totalPages) - 1;
  const slice = r.results.slice(current * ITEMS_PER_PAGE, (current + 1) * ITEMS_PER_PAGE);
  const at = (page: number) => esc(searchPath({ ...state, page: page + 1 }));

  const crumbs = state.category
    ? `<nav aria-label="Breadcrumb" class="text-sm font-medium mb-3"><a href="/search" class="text-slate-400 hover:text-white transition-colors">All Services</a>`
      + `<span class="text-slate-600 mx-2">/</span>`
      + (state.subcategory
        ? `<a href="${esc(searchPath({ category: state.category, location: state.location }))}" class="text-slate-400 hover:text-white transition-colors">${esc(r.categoryLabel(state.category))}</a>`
          + `<span class="text-slate-600 mx-2">/</span><span class="text-white">${esc(r.subcategoryLabel(state.category, state.subcategory))}</span>`
        : `<span class="text-white">${esc(r.categoryLabel(state.category))}</span>`)
      + `</nav>`
    : '';

  const pagination = totalPages > 1
    ? `<nav aria-label="Pagination" class="flex items-center justify-center gap-1 flex-wrap">`
      + (current > 0 ? `<a href="${at(current - 1)}" rel="prev" class="px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg">‹ Prev</a>` : '')
      + pageWindow(current, totalPages).map((p) => p === '…'
        ? `<span class="px-2 py-2 text-slate-500 text-sm">…</span>`
        : `<a href="${at(p)}" class="w-9 h-9 rounded-lg text-sm font-medium flex items-center justify-center ${p === current ? 'bg-primary text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}"${p === current ? ' aria-current="page"' : ''}>${p + 1}</a>`).join('')
      + (current < totalPages - 1 ? `<a href="${at(current + 1)}" rel="next" class="px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg">Next ›</a>` : '')
      + `</nav>`
    : '';

  const start = current * ITEMS_PER_PAGE + 1;
  const end = Math.min((current + 1) * ITEMS_PER_PAGE, r.results.length);
  const results = slice.length
    ? cardGrid(slice, 4)
      + `<div class="pt-6 pb-16 flex flex-col sm:flex-row items-center justify-between gap-4">`
      + `<p class="text-slate-400 text-sm">Showing ${start}–${end} of ${r.results.length} result${r.results.length !== 1 ? 's' : ''}</p>${pagination}</div>`
    : `<div class="flex flex-col items-center justify-center py-24 gap-4"><p class="text-slate-400 text-lg font-medium">No services match your filters.</p>`
      + `<a href="/search" class="text-sm text-primary underline underline-offset-4">Browse all services</a></div>`;

  return page(
    `<header class="safe-header w-full px-4 md:px-6 lg:px-12 border-b border-slate-800"><div class="h-16 flex items-center gap-3">${logo('/search')}`
    + `<form action="/search" method="get" role="search" class="flex-1 flex items-center justify-center">`
    + (state.category ? `<input type="hidden" name="category" value="${esc(state.category)}">` : '')
    + (state.location ? `<input type="hidden" name="location" value="${esc(state.location)}">` : '')
    + `<input type="search" name="q" value="${esc(state.q)}" placeholder="${esc(HOME.searchPlaceholder)}" aria-label="${esc(HOME.searchPlaceholder)}" class="w-full max-w-xl bg-background border border-slate-700 rounded-lg h-10 px-4 text-sm text-white placeholder-slate-400"></form>`
    + `<a href="/signin" class="hidden sm:inline text-sm font-medium text-slate-300 hover:text-white">Log in</a></div></header>`
    + `<nav aria-label="Categories" class="w-full border-b border-slate-800"><ul class="flex items-center gap-5 text-sm text-slate-400 whitespace-nowrap font-medium overflow-x-auto px-6 lg:px-12 py-3">`
    + r.categories.map((c) => `<li><a href="${esc(searchPath({ category: c.value }))}" class="py-1 ${c.value === state.category ? 'text-white' : 'hover:text-white'}">${esc(c.label)}</a></li>`).join('')
    + `</ul></nav>`
    + `<main class="flex-1 px-4 md:px-6 lg:px-12 py-6 md:py-10">${crumbs}`
    + `<h1 class="text-2xl md:text-3xl font-bold mb-5 md:mb-8">${esc(r.heading)}</h1>${results}</main>`
    + footer(),
  );
}

/* ─── Listing page ─────────────────────────────────────────────────────────── */

export interface ListingRender {
  listing: CardListing;
  ctx: SeoContext;
  categoryLabel: string;
  subcategoryLabel: string | null;
  related: CardListing[];
}

export function renderListing(r: ListingRender): string {
  const { listing: l, ctx } = r;
  const extra = l as CardListing & { claimStatus?: string; offeredRemotely?: boolean };
  const images = (l.images ?? []).filter(Boolean);
  const description = l.description ?? '';
  const signInTo = (next: string) => `/signin?next=${encodeURIComponent(next)}`;

  // Same structure and order classes as ServiceDetail: on phones the two
  // columns dissolve ("contents") and their blocks interleave by order-N, so
  // the swap to the live page doesn't move anything.
  const claim = l.isGenerated && extra.claimStatus !== 'claimed'
    ? `<a href="${esc(signInTo(`/post-service?claim=${l.id}`))}" class="w-full mb-6 flex items-center justify-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3.5">`
      // lucide "globe", as on the live page (it affects how the text wraps).
      + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-blue-400 flex-shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`
      + `<span class="text-sm text-slate-200 text-center">This post was generated from publicly available business info. `
      + `<span class="font-semibold text-blue-300">Are you the business owner? <span class="underline underline-offset-2">Click here to claim and update it.</span></span></span></a>`
    : '';

  const crumbs = `<nav aria-label="Breadcrumb" class="order-1 flex items-center gap-1.5 text-xs text-slate-400 mb-4 flex-wrap">`
    + `<a href="/search" class="text-slate-400 hover:text-slate-200 shrink-0">All Services</a>`
    + (l.category ? `<span class="text-slate-600 shrink-0">/</span><a href="${esc(searchPath({ category: l.category }))}" class="text-slate-400 hover:text-slate-200 shrink-0">${esc(r.categoryLabel)}</a>` : '')
    + (l.category && l.subcategory && r.subcategoryLabel
      ? `<span class="text-slate-600 shrink-0">/</span><a href="${esc(searchPath({ category: l.category, subcategory: l.subcategory }))}" class="text-slate-300 hover:text-slate-200">${esc(r.subcategoryLabel)}</a>`
      : '')
    + `</nav>`;

  const seller = `<div class="order-4 flex items-center gap-2 mb-5">`
    + (l.sellerPhotoURL
      ? `<img src="${esc(l.sellerPhotoURL)}" alt="${esc(`${ctx.business} logo`)}" class="w-8 h-8 rounded-full ${avatarFit(l.sellerPhotoURL)} bg-white flex-shrink-0 ${AVATAR_STROKE}">`
      : `<span class="w-8 h-8 text-sm rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0">${esc(ctx.business.charAt(0).toUpperCase())}</span>`)
    + `<span class="text-sm text-white font-medium">${esc(ctx.business)}</span></div>`;

  const price = l.priceType === 'contact_for_pricing' || !(Number(l.priceMin) > 0)
    ? `<div class="order-6 mb-5"><span class="text-slate-100 text-lg font-medium">Contact for pricing</span></div>`
    : `<div class="order-6 mb-5"><span class="text-slate-400 text-sm">From </span><span class="text-white text-2xl font-bold">${esc(l.priceMax ? `$${formatAmount(l.priceMin)} – $${formatAmount(l.priceMax)}` : `$${formatAmount(l.priceMin)}`)}</span>`
      + `<span class="text-slate-400 text-sm"> ${l.priceType === 'per_hour' ? 'per hour' : 'per project'}</span></div>`;

  const cta = `<div class="order-7 flex items-stretch gap-3 mb-8"><a href="${esc(signInTo(ctx.canonicalPath))}" class="w-full max-w-[320px] bg-primary text-white font-semibold py-3 rounded-[6px] text-sm text-center">Message seller</a></div>`;

  const areas = [
    ...([l.primaryLocation, ...(l.extraLocations ?? [])].filter(Boolean) as string[]),
    ...(extra.offeredRemotely ? [l.primaryLocation ? `Remote (${l.primaryLocation})` : 'Remote'] : []),
  ];
  const serviceAreas = areas.length
    ? `<div class="order-10 mb-7"><h2 class="text-sm font-medium text-white mb-2">Service Areas</h2><div class="text-slate-400 text-sm space-y-1">${areas.map((a) => `<p>${esc(a)}</p>`).join('')}</div></div>`
    : '';

  const gallery = images.length
    ? `<div class="order-2 mb-8"><div class="relative rounded-xl overflow-hidden bg-slate-900 mb-3 w-full aspect-[4/3]">`
      + `<img src="${esc(images[0])}" alt="${esc(ctx.imageAlt(0))}" decoding="async" fetchpriority="high" class="w-full h-full object-cover"></div>`
      + (images.length > 1
        ? `<div class="flex gap-2 overflow-x-auto pb-1">${images.map((src, i) => `<img src="${esc(src)}" alt="${esc(ctx.imageAlt(i))}" loading="lazy" decoding="async" width="72" height="54" class="shrink-0 rounded-lg object-cover w-[72px] h-[54px]">`).join('')}</div>`
        : '')
      + `</div>`
    : `<div class="order-2 rounded-xl bg-surface-raised border border-slate-800 flex items-center justify-center mb-8 aspect-[4/3]"><p class="text-slate-500 text-sm">No images uploaded</p></div>`;

  const about = `<div class="order-8 mb-8"><h2 class="text-sm font-medium text-white mb-4">About this Service</h2>`
    + (description.trim()
      ? `<div class="text-slate-300 text-sm leading-relaxed whitespace-pre-line [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_b]:text-white [&_strong]:text-white">${sanitizeRichText(description)}</div>`
      : `<span class="text-slate-500 text-sm">No description provided.</span>`)
    + `</div>`;

  const related = r.related.length
    ? `<section class="border-t border-slate-700/60 pt-8 pb-12"><h2 class="text-xl font-medium text-white mb-6">${esc(relatedHeading(ctx))}</h2>${cardGrid(r.related)}</section>`
    : '';

  return page(
    `<header class="safe-header bg-background border-b border-slate-800/70 px-4 md:px-6 lg:px-12"><div class="h-16 flex items-center justify-between">${logo('/search')}`
    + `<nav class="flex items-center gap-4 md:gap-6 text-sm font-medium"><a href="/signin" class="text-slate-300 hover:text-white">Log in</a>`
    + `<a href="/signup" class="text-slate-300 hover:text-white px-4 py-2 border border-slate-700 rounded-full">Sign up</a></nav></div></header>`
    + `<main class="w-full px-4 md:px-6 lg:px-12 py-6 md:py-8 flex flex-col">${claim}`
    + `<div class="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_512px] lg:gap-[100px] mb-10">`
    + `<div class="contents lg:block lg:order-2 lg:min-w-0">${crumbs}`
    + `<h1 class="order-3 text-3xl font-bold leading-snug text-slate-100 mb-4">${esc(ctx.h1)}</h1>`
    + `${seller}${price}${cta}<hr class="order-9 border-slate-700/60 mb-8">${serviceAreas}</div>`
    + `<div class="contents lg:block lg:order-1 lg:min-w-0">${gallery}${about}</div>`
    + `</div>${related}</main>`
    + footer(),
  );
}
