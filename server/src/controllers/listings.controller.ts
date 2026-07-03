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

    const resp = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask': [
          'places.id', 'places.displayName', 'places.formattedAddress', 'places.rating',
          'places.userRatingCount', 'places.photos', 'places.reviews',
          'places.editorialSummary', 'places.primaryTypeDisplayName',
          'places.websiteUri', 'places.addressComponents',
        ].join(','),
      },
      body: JSON.stringify({ textQuery: `${keyword} in ${city}`, maxResultCount: 20 }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.status(502).json({ error: `Google Places error (${resp.status}): ${text.slice(0, 300)}` });
      return;
    }

    const data = (await resp.json()) as { places?: Place[] };
    // Only businesses with a website are imported — we scrape it for a description
    // and a contact email that powers "Message seller" on unclaimed listings.
    const mapped = (data.places ?? [])
      .filter((p) => !!p.websiteUri)
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

// Post images come from the business's own website (og:image first, then large
// content images) — Google Places photos are only a fallback when the site has none.
// Every candidate is downloaded and its REAL pixel size checked: logos, thumbnails
// and low-res portfolio images don't survive the gate.
const IMG_BLOCKLIST = /logos?|icon|favicon|sprite|avatar|placeholder|captcha|badge|tracking|pixel|thumb|stamp|seal|\.svg|\.gif/i;
const MAX_IMG_CANDIDATES = 12;

function pageImages(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const add = (raw: string | undefined, requireExt: boolean) => {
    if (!raw || out.length >= MAX_IMG_CANDIDATES) return;
    try {
      const abs = new URL(decodeEntities(raw), pageUrl).href;
      if (!/^https?:/i.test(abs) || IMG_BLOCKLIST.test(abs)) return;
      if (requireExt && !/\.(jpe?g|png|webp)([?#]|$)/i.test(abs)) return;
      if (!out.includes(abs)) out.push(abs);
    } catch { /* unparseable URL */ }
  };
  // Declared social images are trustworthy even without a file extension.
  add(metaContent(html, 'og:image'), false);
  add(metaContent(html, 'twitter:image'), false);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (out.length >= MAX_IMG_CANDIDATES) break;
    const tag = m[0];
    const w = Number(tag.match(/\bwidth=["']?(\d+)/i)?.[1] ?? 0);
    const h = Number(tag.match(/\bheight=["']?(\d+)/i)?.[1] ?? 0);
    if ((w && w < 300) || (h && h < 200)) continue; // skip declared-small images
    add(tag.match(/\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i)?.[1], true);
  }
  return out;
}

// Download the first ~64KB of an image — enough to read its header dimensions.
async function fetchImageHead(url: string, maxBytes = 65536, timeoutMs = 5000): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GigspaceBot/1.0; +https://gigspace.co)', Accept: 'image/*' },
    });
    if (!resp.ok || !resp.body) return null;
    const reader = resp.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      total += value.length;
    }
    reader.cancel().catch(() => {});
    return Buffer.concat(chunks);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Minimal header parsers for PNG / JPEG / WebP — no image library needed.
function imageDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 30) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) {                       // PNG
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {                       // JPEG
    let pos = 2;
    while (pos + 9 < buf.length) {
      if (buf[pos] !== 0xff) { pos += 1; continue; }
      const marker = buf[pos + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(pos + 5), w: buf.readUInt16BE(pos + 7) };
      }
      const len = buf.readUInt16BE(pos + 2);
      if (len < 2) return null;
      pos += 2 + len;
    }
    return null;
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fourCC = buf.toString('ascii', 12, 16);
    if (fourCC === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (fourCC === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (fourCC === 'VP8L') {
      const w = 1 + ((buf[22] | ((buf[23] & 0x3f) << 8)));
      const h = 1 + (((buf[23] >> 6) | (buf[24] << 2) | ((buf[25] & 0x0f) << 10)));
      return { w, h };
    }
  }
  return null;
}

// Keep only genuinely large, sensibly-proportioned images (gallery renders 592×444).
const MIN_IMG_W = 600;
const MIN_IMG_H = 350;

async function qualityImages(candidates: string[]): Promise<string[]> {
  const checked = await Promise.all(
    candidates.map(async (url) => {
      const buf = await fetchImageHead(url);
      const d = buf ? imageDims(buf) : null;
      if (!d || d.w < MIN_IMG_W || d.h < MIN_IMG_H) return null;
      const ratio = d.w / d.h;
      if (ratio < 0.5 || ratio > 3.2) return null;  // skip banners/skyscrapers
      return url;
    }),
  );
  return checked.filter((u): u is string => u !== null).slice(0, 5);
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

interface ScrapedSite { title: string; description: string; email: string; images: string[] }

async function scrapeWebsite(website: string): Promise<ScrapedSite> {
  const out: ScrapedSite = { title: '', description: '', email: '', images: [] };
  let origin = '';
  try { origin = new URL(website).origin; } catch { return out; }

  let descParts: string[] = [];
  const home = await fetchPage(website);
  if (home) {
    out.title = pageTitle(home);
    out.email = pageEmail(home);
    out.images = await qualityImages(pageImages(home, website));
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
      businesses.map((b) => (b.website ? scrapeWebsite(b.website) : Promise.resolve<ScrapedSite>({ title: '', description: '', email: '', images: [] }))),
    );

    for (let i = 0; i < businesses.length; i++) {
      const b = businesses[i];
      const site = scraped[i];
      const ref = db.ref('services').push();
      const id = ref.key as string;
      const now = Date.now();
      // Prefer quality-gated images from the business's own website. If none pass,
      // fall back to a single Places cover photo so the post still has an image.
      const images = site.images.length ? site.images : (Array.isArray(b.images) ? b.images.slice(0, 1) : []);
      const reviews = Array.isArray(b.reviews) ? b.reviews : [];
      const reviewCount = reviews.length;
      const totalStars = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0);
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
