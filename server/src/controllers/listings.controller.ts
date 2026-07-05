import * as admin from 'firebase-admin';
import { type Response } from 'express';
import { type AdminRequest } from '../middleware/verifyAdmin';

// Google Places API (new). Provide GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY)
// in the server environment with Places API (New) enabled.
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

interface PlaceReview {
  rating?: number;
  text?: { text?: string };
  authorAttribution?: { displayName?: string; photoUri?: string };
  publishTime?: string;
}
interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}
interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: { name: string }[];
  reviews?: PlaceReview[];
  editorialSummary?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
}

const photoUrl = (name: string) =>
  `https://places.googleapis.com/v1/${name}/media?maxHeightPx=800&maxWidthPx=1200&key=${PLACES_KEY}`;

// Posts only show city & state (e.g. "Staten Island, New York"), never the street address.
function cityStateOf(p: Place): string {
  const comps = p.addressComponents ?? [];
  const find = (t: string) => comps.find((c) => c.types?.includes(t));
  // NYC boroughs come back as sublocality_level_1 with no locality.
  const city = find('locality') ?? find('sublocality_level_1') ?? find('postal_town');
  const state = find('administrative_area_level_1');
  if (city?.longText && state?.longText) return `${city.longText}, ${state.longText}`;
  // Fallback: "58 Foch Ave, Staten Island, NY 10305, USA" → "Staten Island, NY"
  const parts = (p.formattedAddress ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const cityPart = parts[parts.length - 3];
    const statePart = (parts[parts.length - 2] ?? '').replace(/\s*[\d-]+$/, '').trim();
    return statePart ? `${cityPart}, ${statePart}` : cityPart;
  }
  return p.formattedAddress ?? '';
}

// Business favicon (via Google's favicon service) doubles as the post's logo/avatar.
function faviconOf(website: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(website).hostname}&sz=128`;
  } catch {
    return '';
  }
}

// ─── Search public businesses (preview, not persisted) ──────────────────────────
export async function searchListings(req: AdminRequest, res: Response): Promise<void> {
  try {
    if (!PLACES_KEY) {
      res.status(400).json({ error: 'GOOGLE_PLACES_API_KEY is not configured on the server.' });
      return;
    }
    const { keyword, city } = (req.body ?? {}) as Record<string, string>;
    if (!keyword || !city) { res.status(400).json({ error: 'keyword and city are required' }); return; }

    // Google Places caps each page at 20 places; walk nextPageToken to pull the
    // API's full result set (up to 60 per query — its hard maximum).
    const places: Place[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      const resp = await fetch(TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': PLACES_KEY,
          'X-Goog-FieldMask': [
            'nextPageToken',
            'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
            'places.userRatingCount', 'places.photos', 'places.reviews',
            'places.editorialSummary', 'places.primaryTypeDisplayName',
            'places.websiteUri', 'places.addressComponents',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: `${keyword} in ${city}`,
          pageSize: 20,
          ...(pageToken ? { pageToken } : {}),
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        if (page === 0) {
          res.status(502).json({ error: `Google Places error (${resp.status}): ${text.slice(0, 300)}` });
          return;
        }
        break; // keep whatever earlier pages returned
      }

      const data = (await resp.json()) as { places?: Place[]; nextPageToken?: string };
      places.push(...(data.places ?? []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    // Only businesses with a website are imported — we scrape it for a description
    // and a contact email that powers "Message seller" on unclaimed listings.
    const seen = new Set<string>();
    const mapped = places
      .filter((p) => {
        if (!p.websiteUri || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .map((p) => ({
        placeId: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? '',
        location: cityStateOf(p),
        website: p.websiteUri ?? '',
        logo: faviconOf(p.websiteUri ?? ''),
        rating: p.rating ?? 0,
        reviewCount: p.userRatingCount ?? 0,
        description: p.editorialSummary?.text ?? '',
        type: p.primaryTypeDisplayName?.text ?? '',
        images: (p.photos ?? []).slice(0, 5).map((ph) => photoUrl(ph.name)),
        reviews: (p.reviews ?? []).slice(0, 5).map((r) => ({
          rating: r.rating ?? 0,
          text: r.text?.text ?? '',
          author: r.authorAttribution?.displayName ?? '',
          photo: r.authorAttribution?.photoUri ?? '',
          time: r.publishTime ? new Date(r.publishTime).getTime() : Date.now(),
        })),
      }));

    // Scrape contact emails up front (parallel, email-only) so the admin can see
    // which businesses are reachable before choosing what to generate.
    const emails = await Promise.all(mapped.map((b) => scrapeEmail(b.website)));
    const businesses = mapped.map((b, i) => ({ ...b, email: emails[i] }));

    res.json({ businesses });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/listings/search error:', msg);
    res.status(500).json({ error: msg });
  }
}

// ─── Website scraping (title, description, contact email) ───────────────────────
// Generated posts should read better than "name + address", so we pull the page
// title, a real description (meta/About text) and a contact email from the
// business's own website. Every step degrades gracefully to the Places data.

async function fetchPage(url: string, timeoutMs = 6000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GigspaceBot/1.0; +https://gigspace.co)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!resp.ok || !(resp.headers.get('content-type') ?? '').includes('html')) return '';
    return await resp.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function metaContent(html: string, key: string): string {
  // Matches <meta property="og:description" content="..."> in either attribute order.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
    'i',
  );
  const m = html.match(re);
  return decodeEntities(m?.[1] ?? m?.[2] ?? '');
}

function pageTitle(html: string): string {
  const og = metaContent(html, 'og:title');
  if (og) return og.slice(0, 90);
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeEntities(m?.[1] ?? '').slice(0, 90);
}

// Descriptions are assembled from the meta description plus real body copy so
// posts read like an About section, not a one-liner. Paragraphs are joined with
// blank lines; the post page renders each as its own paragraph.
const DESC_TARGET = 1400;  // stop collecting once we have roughly this much
const DESC_CAP = 2000;
const BOILERPLATE = /cookie|javascript|browser|all rights reserved|privacy policy|terms of (use|service)|subscribe|newsletter|sign up|log in/i;

function pageParagraphs(html: string): string[] {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, '');
  return [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, ' ')))
    .filter((t) => t.length >= 80 && !BOILERPLATE.test(t));
}

// Append non-duplicate paragraphs until the target length is reached.
function mergeParagraphs(parts: string[], extras: string[]): string[] {
  for (const p of extras) {
    if (parts.join('\n\n').length >= DESC_TARGET) break;
    if (parts.some((e) => e.includes(p.slice(0, 80)) || p.includes(e.slice(0, 80)))) continue;
    parts.push(p);
  }
  return parts;
}

const EMAIL_VALID = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function pageEmail(html: string): string {
  const mailto = html.match(/mailto:([^"'?\s>]+)/i)?.[1];
  const inText = html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
  for (const raw of [mailto, ...inText].filter(Boolean) as string[]) {
    const email = decodeEntities(raw).toLowerCase();
    if (!EMAIL_VALID.test(email)) continue;
    // Skip asset filenames (logo@2x.png) and boilerplate/tracker domains.
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(email)) continue;
    if (/example\.|sentry\.|wixpress\.|schema\.org|yourdomain|domain\.com/.test(email)) continue;
    return email;
  }
  return '';
}

// Email-only scrape used at search time: homepage, then contact pages.
async function scrapeEmail(website: string): Promise<string> {
  let origin = '';
  try { origin = new URL(website).origin; } catch { return ''; }
  const home = await fetchPage(website);
  let email = home ? pageEmail(home) : '';
  for (const p of ['/contact', '/contact-us']) {
    if (email) break;
    const html = await fetchPage(origin + p);
    if (html) email = pageEmail(html);
  }
  return email;
}

interface ScrapedSite { title: string; description: string; email: string }

async function scrapeWebsite(website: string): Promise<ScrapedSite> {
  const out: ScrapedSite = { title: '', description: '', email: '' };
  let origin = '';
  try { origin = new URL(website).origin; } catch { return out; }

  let descParts: string[] = [];
  const home = await fetchPage(website);
  if (home) {
    out.title = pageTitle(home);
    out.email = pageEmail(home);
    const meta = metaContent(home, 'og:description') || metaContent(home, 'description');
    if (meta.length >= 60) descParts.push(meta);
    descParts = mergeParagraphs(descParts, pageParagraphs(home));
  }

  // Dig into About-style pages for richer copy, contact pages for an email.
  const fallbacks: { path: string; want: 'description' | 'email' }[] = [
    { path: '/about', want: 'description' },
    { path: '/about-us', want: 'description' },
    { path: '/contact', want: 'email' },
    { path: '/contact-us', want: 'email' },
  ];
  let extraFetches = 0;
  for (const f of fallbacks) {
    if (extraFetches >= 3) break;
    if (f.want === 'description' && descParts.join('\n\n').length >= 500) continue;
    if (f.want === 'email' && out.email) continue;
    extraFetches += 1;
    const html = await fetchPage(origin + f.path);
    if (!html) continue;
    if (f.want === 'description') {
      descParts = mergeParagraphs(descParts, pageParagraphs(html));
    } else {
      out.email = out.email || pageEmail(html);
    }
  }

  out.description = descParts.join('\n\n').slice(0, DESC_CAP);
  return out;
}

// ─── Generate marketplace posts from selected businesses ────────────────────────
interface GenBusiness {
  placeId?: string;
  name?: string;
  address?: string;
  location?: string;
  website?: string;
  logo?: string;
  email?: string;    // scraped at search time; generate reuses it
  rating?: number;      // Google average rating (all reviews)
  reviewCount?: number; // Google total review count — NOT just the ≤5 the API returns
  description?: string;
  type?: string;
  images?: string[];
  extraLocations?: string[];
  reviews?: { rating?: number; text?: string; author?: string; photo?: string; time?: number }[];
}

export async function generateListings(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { category, subcategory, language, businesses } = (req.body ?? {}) as {
      category?: string; subcategory?: string; language?: string; businesses?: GenBusiness[];
    };
    if (!Array.isArray(businesses) || businesses.length === 0) {
      res.status(400).json({ error: 'businesses[] is required' }); return;
    }

    const db = admin.database();
    const created: { id: string; name: string }[] = [];

    // Scrape all selected websites up front (parallel) — title, description, email.
    const scraped = await Promise.all(
      businesses.map((b) => (b.website ? scrapeWebsite(b.website) : Promise.resolve<ScrapedSite>({ title: '', description: '', email: '' }))),
    );

    for (let i = 0; i < businesses.length; i++) {
      const b = businesses[i];
      const site = scraped[i];
      const ref = db.ref('services').push();
      const id = ref.key as string;
      const now = Date.now();
      // Post images are the business's Google Business Profile photos (owner uploads).
      const images = Array.isArray(b.images) ? b.images : [];
      const reviews = Array.isArray(b.reviews) ? b.reviews : [];
      // The Places API returns at most 5 review texts, but the business's REAL
      // totals come from rating/userRatingCount — store those so the post shows
      // e.g. "5.0 · 85 reviews" instead of counting the 5 snippets.
      const reviewCount = Number(b.reviewCount) || reviews.length;
      const avgRating = Number(b.rating)
        || (reviews.length ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length : 0);
      const totalStars = Math.round(avgRating * reviewCount);
      const location = b.location || b.address || '';

      await ref.set({
        sellerId: '',
        sellerName: b.name ?? '',
        sellerUsername: '',
        sellerPhotoURL: b.logo ?? '',
        title: site.title || b.name || '',
        description:
          site.description ||
          b.description ||
          `${b.name ?? ''} — ${b.type || category || ''}. ${location}`.trim(),
        category: category ?? '',
        subcategory: subcategory ?? '',
        priceMin: 0,
        priceMax: null,
        priceType: 'contact_for_pricing',
        images,
        languages: language ? [language] : ['English'],
        primaryLocation: location,
        extraLocations: Array.isArray(b.extraLocations) ? b.extraLocations : [],
        offeredRemotely: false,
        status: 'draft',           // admin reviews then publishes
        isGenerated: true,
        source: 'google',
        claimStatus: 'unclaimed',
        claimedBy: null,
        placeId: b.placeId ?? '',
        website: b.website ?? '',
        contactEmail: b.email || site.email,  // powers the "Message seller" mailto on unclaimed posts
        reviewCount,
        totalStars,
        createdAt: now,
        updatedAt: now,
      });

      // Denormalize reviews so they render on the public detail page.
      if (reviews.length) {
        const updates: Record<string, unknown> = {};
        reviews.forEach((r, i) => {
          updates[`serviceReviews/${id}/g${i}`] = {
            rating: Number(r.rating) || 0,
            text: String(r.text || ''),
            reviewerName: String(r.author || 'Google reviewer'),
            reviewerPhoto: String(r.photo || ''),
            serviceTitle: b.name ?? '',
            timestamp: Number(r.time) || now,
          };
        });
        await db.ref().update(updates);
      }

      created.push({ id, name: b.name ?? '' });
    }

    res.json({ created, count: created.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/listings/generate error:', msg);
    res.status(500).json({ error: msg });
  }
}
