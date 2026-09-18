// Pure SEO builders shared by the browser bundle and the Vercel functions in /api.
// Nothing here may import firebase or touch the DOM.

import { SITE_NAME, SITE_URL, formatArea, humanizeKey, parseLocation, type ParsedLocation } from './slug.js';

/** The subset of a `services/{id}` record the SEO layer reads. */
export interface SeoListing {
  id: string;
  title?: string;
  description?: string;
  sellerName?: string;
  sellerPhotoURL?: string;
  category?: string;
  subcategory?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  priceType?: 'per_project' | 'per_hour' | 'contact_for_pricing' | string;
  images?: string[];
  primaryLocation?: string;
  extraLocations?: string[];
  offeredRemotely?: boolean;
  website?: string;
  isGenerated?: boolean;
  placeId?: string;
  reviewCount?: number;
  totalStars?: number;
  seoPath?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface CategoryLabels {
  category: (key: string) => string;
  subcategory: (category: string, key: string) => string;
}

export interface SeoContext {
  serviceLabel: string;
  categoryLabel: string;
  business: string;
  location: ParsedLocation;
  /** "Los Angeles, CA" */
  area: string;
  /** "Los Angeles, California" */
  areaLong: string;
  h1: string;
  title: string;
  description: string;
  canonicalPath: string;
  canonicalUrl: string;
  image: string;
  priceText: string;
  imageAlt: (index: number) => string;
}

export function stripHtml(html: string | null | undefined): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h\d)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const atWord = cut.replace(/\s+\S*$/, '');
  return `${atWord || cut}…`;
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function resolveServiceLabel(listing: SeoListing, labels: CategoryLabels): string {
  const cat = listing.category ?? '';
  const sub = listing.subcategory ?? '';
  if (sub) {
    const l = labels.subcategory(cat, sub);
    return l !== sub ? l : humanizeKey(sub);
  }
  if (cat) {
    const l = labels.category(cat);
    return l !== cat ? l : humanizeKey(cat);
  }
  return 'Service';
}

export function resolveCategoryLabel(listing: SeoListing, labels: CategoryLabels): string {
  const cat = listing.category ?? '';
  if (!cat) return '';
  const l = labels.category(cat);
  return l !== cat ? l : humanizeKey(cat);
}

/** First location that parses to something usable: primary, then extras. */
export function listingLocation(listing: SeoListing): ParsedLocation {
  const candidates = [listing.primaryLocation, ...(listing.extraLocations ?? [])];
  for (const c of candidates) {
    const loc = parseLocation(c);
    if (loc.city || loc.region || loc.country) return loc;
  }
  return {};
}

export function priceText(listing: SeoListing): string {
  const min = listing.priceMin;
  if (listing.priceType === 'contact_for_pricing' || min == null || !(min > 0)) return 'Contact for pricing';
  const unit = listing.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (listing.priceMax && listing.priceMax > min) return `${formatMoney(min)}–${formatMoney(listing.priceMax)} ${unit}`;
  return `From ${formatMoney(min)} ${unit}`;
}

export function listingPath(listing: Pick<SeoListing, 'id' | 'seoPath'>): string {
  return listing.seoPath ? `/posts/${listing.seoPath}` : `/service-detail?id=${encodeURIComponent(listing.id)}`;
}

export function buildSeoContext(listing: SeoListing, labels: CategoryLabels): SeoContext {
  const serviceLabel = resolveServiceLabel(listing, labels);
  const categoryLabel = resolveCategoryLabel(listing, labels);
  const business = (listing.sellerName ?? '').trim() || SITE_NAME;
  const location = listingLocation(listing);
  const area = formatArea(location);
  const areaLong = formatArea(location, { longState: true });

  const h1 = area ? `${serviceLabel} in ${area}` : serviceLabel;
  const title = `${h1} | ${business} | ${SITE_NAME}`;

  const price = priceText(listing);
  const cta = `Get a quote on ${SITE_NAME}.`;
  const lead = `${`${h1} by ${business}`.replace(/\.+$/, '')}. ${price}.`;
  const room = 155 - lead.length - cta.length - 2;
  let snippet = room > 20 ? truncateWords(stripHtml(listing.description), room) : '';
  if (snippet && !/[.!?…]$/.test(snippet)) snippet += '.';
  const description = [lead, snippet, cta].filter(Boolean).join(' ');

  const canonicalPath = listingPath(listing);
  const image = Array.isArray(listing.images) ? (listing.images[0] ?? '') : '';
  const altBase = areaLong ? `${serviceLabel} by ${business} in ${areaLong}` : `${serviceLabel} by ${business}`;

  return {
    serviceLabel,
    categoryLabel,
    business,
    location,
    area,
    areaLong,
    h1,
    title,
    description,
    canonicalPath,
    canonicalUrl: `${SITE_URL}${canonicalPath}`,
    image,
    priceText: price,
    imageAlt: (index: number) => (index > 0 ? `${altBase} - photo ${index + 1}` : altBase),
  };
}

export interface RatingSummary {
  count: number;
  average: number;
}

export function ratingSummary(listing: SeoListing, loadedReviews?: { rating: number }[]): RatingSummary | null {
  const count = listing.reviewCount ?? 0;
  if ((listing.isGenerated || listing.placeId) && count > 0) {
    return { count, average: (listing.totalStars ?? 0) / count };
  }
  if (loadedReviews && loadedReviews.length > 0) {
    const sum = loadedReviews.reduce((s, r) => s + (Number(r.rating) || 0), 0);
    return { count: loadedReviews.length, average: sum / loadedReviews.length };
  }
  return null;
}

function offerFor(listing: SeoListing, ctx: SeoContext): Record<string, unknown> | null {
  const min = listing.priceMin;
  if (listing.priceType === 'contact_for_pricing' || min == null || !(min > 0)) return null;
  const hourly = listing.priceType === 'per_hour';
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url: ctx.canonicalUrl,
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  };
  if (listing.priceMax && listing.priceMax > min) {
    offer.priceSpecification = {
      '@type': hourly ? 'UnitPriceSpecification' : 'PriceSpecification',
      priceCurrency: 'USD',
      minPrice: min,
      maxPrice: listing.priceMax,
      ...(hourly ? { unitCode: 'HUR', unitText: 'hour' } : {}),
    };
  } else if (hourly) {
    offer.priceSpecification = {
      '@type': 'UnitPriceSpecification',
      priceCurrency: 'USD',
      price: min,
      unitCode: 'HUR',
      unitText: 'hour',
    };
  } else {
    offer.price = min;
  }
  return offer;
}

function areaServed(listing: SeoListing): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const raw of [listing.primaryLocation, ...(listing.extraLocations ?? [])]) {
    const loc = parseLocation(raw);
    const name = formatArea(loc, { longState: true });
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ '@type': loc.city ? 'City' : loc.region ? 'State' : 'Country', name });
  }
  if (listing.offeredRemotely && !out.length) out.push({ '@type': 'Place', name: 'Remote' });
  return out;
}

export function buildJsonLd(listing: SeoListing, ctx: SeoContext, rating: RatingSummary | null): Record<string, unknown> {
  const url = ctx.canonicalUrl;
  const loc = ctx.location;
  const images = (listing.images ?? []).filter(Boolean);
  const description = stripHtml(listing.description) || ctx.description;

  const address = loc.city || loc.region || loc.country
    ? {
        '@type': 'PostalAddress',
        ...(loc.city ? { addressLocality: loc.city } : {}),
        ...(loc.regionCode ?? loc.region ? { addressRegion: loc.regionCode ?? loc.region } : {}),
        ...(loc.country ? { addressCountry: loc.country === 'United States' ? 'US' : loc.country } : {}),
      }
    : null;

  const provider: Record<string, unknown> = {
    '@type': address ? 'LocalBusiness' : 'Organization',
    '@id': `${url}#provider`,
    name: ctx.business,
    url: listing.website || url,
    ...(listing.sellerPhotoURL ? { image: listing.sellerPhotoURL, logo: listing.sellerPhotoURL } : {}),
    ...(address ? { address } : {}),
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Math.round(rating.average * 10) / 10,
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  const offer = offerFor(listing, ctx);
  const service: Record<string, unknown> = {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: ctx.h1,
    serviceType: ctx.serviceLabel,
    ...(ctx.categoryLabel ? { category: ctx.categoryLabel } : {}),
    description: truncateWords(description, 500),
    url,
    provider: { '@id': `${url}#provider` },
    ...(images.length ? { image: images } : {}),
    ...(areaServed(listing).length ? { areaServed: areaServed(listing) } : {}),
    ...(offer ? { offers: offer } : {}),
  };

  const crumbs: { name: string; item?: string }[] = [{ name: 'Home', item: `${SITE_URL}/` }];
  if (ctx.categoryLabel && listing.category) {
    crumbs.push({ name: ctx.categoryLabel, item: `${SITE_URL}/search?category=${encodeURIComponent(listing.category)}` });
  }
  if (listing.subcategory && listing.category) {
    crumbs.push({
      name: ctx.serviceLabel,
      item: `${SITE_URL}/search?category=${encodeURIComponent(listing.category)}&subcategory=${encodeURIComponent(listing.subcategory)}`,
    });
  }
  crumbs.push({ name: ctx.h1 });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: ctx.title,
        description: ctx.description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        ...(ctx.image ? { primaryImageOfPage: ctx.image } : {}),
        ...(listing.updatedAt ? { dateModified: new Date(listing.updatedAt).toISOString() } : {}),
        ...(listing.createdAt ? { datePublished: new Date(listing.createdAt).toISOString() } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          ...(c.item ? { item: c.item } : {}),
        })),
      },
      provider,
      service,
    ],
  };
}

function escapeAttr(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The `<head>` block the server injects into the SPA shell for a listing page. */
export function buildHeadHtml(ctx: SeoContext, jsonLd: Record<string, unknown>, opts: { index: boolean } = { index: true }): string {
  const robots = opts.index ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,follow';
  const ld = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  const lines = [
    `<title>${escapeAttr(ctx.title)}</title>`,
    `<meta name="description" content="${escapeAttr(ctx.description)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${escapeAttr(ctx.canonicalUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:url" content="${escapeAttr(ctx.canonicalUrl)}">`,
    `<meta property="og:title" content="${escapeAttr(ctx.title)}">`,
    `<meta property="og:description" content="${escapeAttr(ctx.description)}">`,
    ...(ctx.image
      ? [
          `<meta property="og:image" content="${escapeAttr(ctx.image)}">`,
          `<meta property="og:image:alt" content="${escapeAttr(ctx.imageAlt(0))}">`,
        ]
      : []),
    `<meta name="twitter:card" content="${ctx.image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeAttr(ctx.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(ctx.description)}">`,
    ...(ctx.image ? [`<meta name="twitter:image" content="${escapeAttr(ctx.image)}">`] : []),
    `<script type="application/ld+json">${ld}</script>`,
  ];
  return lines.join('\n    ');
}
