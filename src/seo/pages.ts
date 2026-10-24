// Head tags for the public pages other than listings (GIG-77): a unique
// <title>, a 140–160 character description, a self-referencing canonical and
// matching Open Graph / Twitter tags. Shared by the server renderer
// (api/page.ts), which puts them in the first HTML, and the browser
// (useDocumentMeta), which keeps them right during in-app navigation.
// Nothing here may import firebase or touch the DOM.

import { SITE_NAME, SITE_URL, formatArea, parseLocation } from './slug.js';
import { escapeAttr, type CategoryLabels } from './meta.js';
import { ITEMS_PER_PAGE, searchPath, type SearchState } from './search.js';

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

export interface PageMeta {
  title: string;
  description: string;
  /** Canonical path, query string included. */
  path: string;
  index: boolean;
  jsonLd?: Record<string, unknown>;
}

export const DESCRIPTION_MIN = 140;
export const DESCRIPTION_MAX = 160;

/**
 * Builds a description from slots in order. A slot is a sentence, or a list
 * of alternatives longest first; the first that still fits within 160
 * characters is used and the rest of that slot skipped. Callers pass enough
 * slots for the result to land in 140–160 whatever the dynamic part's length.
 */
export function fitDescription(slots: (string | string[])[]): string {
  let out = '';
  for (const slot of slots) {
    for (const s of Array.isArray(slot) ? slot : [slot]) {
      const next = out ? `${out} ${s}` : s;
      if (next.length <= DESCRIPTION_MAX) { out = next; break; }
    }
  }
  if (out) return out;
  // Only a first sentence longer than the limit gets here.
  const first = Array.isArray(slots[0]) ? slots[0][0] : slots[0];
  return `${first.slice(0, DESCRIPTION_MAX - 1).replace(/\s+\S*$/, '')}…`;
}

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/apple-touch-icon.png`,
};

const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  publisher: { '@id': `${SITE_URL}/#organization` },
};

export type StaticPath = '/' | '/for-sellers' | '/about' | '/affiliate' | '/terms' | '/privacy';

export const STATIC_PAGES: Record<StaticPath, PageMeta> = {
  '/': {
    path: '/',
    index: true,
    title: 'Gigspace | Hire Local Pros and Remote Experts for Any Project',
    description: 'Hire trusted local pros for in-person services or remote experts for digital work. Compare profiles, message sellers instantly and pay securely on Gigspace.',
    jsonLd: { '@context': 'https://schema.org', '@graph': [WEBSITE, ORGANIZATION] },
  },
  '/for-sellers': {
    path: '/for-sellers',
    index: true,
    title: 'Sell Your Services on Gigspace | Get Discovered, Hired and Paid',
    description: 'List your services on Gigspace for free and get found by local and remote clients. Chat with buyers in real time, send custom quotes and get paid securely.',
  },
  '/about': {
    path: '/about',
    index: true,
    title: 'About Gigspace | Changing the Way People Work Together',
    description: 'Gigspace connects people with talented local pros and remote experts. Learn about our mission, our values and how we make hiring simpler, safer and fairer.',
  },
  '/affiliate': {
    path: '/affiliate',
    index: true,
    title: 'Gigspace Affiliate Program | Earn Commission on Every Job Booked',
    description: 'Join the Gigspace affiliate program for free and earn 50% of our platform fee on every completed job booked through your link, with real-time tracking.',
  },
  '/terms': {
    path: '/terms',
    index: true,
    title: 'Terms & Conditions | Gigspace',
    description: 'Read the Gigspace Terms & Conditions covering accounts, buying and selling services, payments, escrow and fees, cancellations, disputes and acceptable use.',
  },
  '/privacy': {
    path: '/privacy',
    index: true,
    title: 'Privacy Policy | Gigspace',
    description: 'Read the Gigspace Privacy Policy to learn what personal information we collect, how we use and protect it, who we share it with and the choices you have.',
  },
};

export const isStaticPath = (p: string): p is StaticPath => Object.prototype.hasOwnProperty.call(STATIC_PAGES, p);

/** What a search page is about: "Junk Removal", "Labor & Moving Services", or nothing. */
export function searchSubject(s: Pick<SearchState, 'category' | 'subcategory'>, labels: CategoryLabels): string {
  if (s.category && s.subcategory) return labels.subcategory(s.category, s.subcategory);
  if (s.category) return `${labels.category(s.category)} Services`;
  return '';
}

export const searchArea = (location: string) => formatArea(parseLocation(location)) || location;

/**
 * A search page is worth indexing when it is a stable topic — a category,
 * a service, a city or a mix — with results to show. Free-text searches are
 * an unbounded URL space and stay out of the index (still followed).
 */
export function searchMeta(s: SearchState, labels: CategoryLabels, total: number): PageMeta {
  const subject = searchSubject(s, labels);
  const area = s.location ? searchArea(s.location) : '';
  const pages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const index = !s.q && total > 0 && s.page <= pages;
  const pageSuffix = s.page > 1 ? ` - Page ${s.page}` : '';

  let heading: string;
  if (s.q) heading = `Results for "${s.q}"${area ? ` in ${area}` : ''}`;
  else if (subject) heading = `${subject}${area ? ` in ${area}` : ''}`;
  else if (area) heading = `Local Services in ${area}`;
  else heading = 'Browse Local Services and Freelancers';

  const what = (subject || 'local service').toLowerCase().replace(/ services$/, '');
  const count = total === 1 ? '1 listing' : `${total} listings`;
  const lead = total > 0
    ? `Compare ${count} for ${what}${area ? ` in ${area}` : ''} on Gigspace.`
    : `Find ${what} pros${area ? ` in ${area}` : ''} on Gigspace.`;

  const description = fitDescription([
    lead,
    [
      'See photos, service areas and prices, then message sellers directly and pay securely through escrow.',
      'See photos, service areas and prices, and message sellers directly.',
      'Message sellers directly and pay securely.',
      'Message sellers directly.',
    ],
    'No buyer fees.',
    'Hire with confidence.',
    'Book today.',
  ]);

  const crumbs: { name: string; path: string }[] = [{ name: 'Home', path: '/' }, { name: 'All Services', path: '/search' }];
  if (s.category) crumbs.push({ name: labels.category(s.category), path: searchPath({ category: s.category }) });
  if (s.category && s.subcategory) crumbs.push({ name: labels.subcategory(s.category, s.subcategory), path: searchPath({ category: s.category, subcategory: s.subcategory }) });

  return {
    title: `${heading}${pageSuffix} | ${SITE_NAME}`,
    description,
    path: searchPath(s),
    index,
    jsonLd: crumbs.length > 2 ? {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE_URL}${c.path}` })),
    } : undefined,
  };
}

/** The search page's visible <h1>, on the server and in the app alike. */
export function searchHeading(s: Pick<SearchState, 'q' | 'category' | 'subcategory' | 'location'>, labels: CategoryLabels): string {
  const cat = s.category ? labels.category(s.category) : '';
  const sub = s.category && s.subcategory ? labels.subcategory(s.category, s.subcategory) : '';
  const area = s.location ? ` in ${searchArea(s.location)}` : '';
  if (s.q) return `Results for "${s.q}"${cat ? ` in ${cat}` : ''}`;
  if (sub) return `${sub}${area}`;
  if (cat) return `${cat}${area}`;
  if (area) return `Services${area}`;
  return 'All Services';
}

/** The <head> block the server injects for a non-listing page. */
export function buildPageHeadHtml(meta: PageMeta): string {
  const url = `${SITE_URL}${meta.path}`;
  const robots = meta.index ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,follow';
  const lines = [
    `<title>${escapeAttr(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${escapeAttr(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}">`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}">`,
    `<meta property="og:image" content="${DEFAULT_OG_IMAGE}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${SITE_NAME}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}">`,
    `<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">`,
    ...(meta.jsonLd ? [`<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`] : []),
  ];
  return lines.join('\n    ');
}
