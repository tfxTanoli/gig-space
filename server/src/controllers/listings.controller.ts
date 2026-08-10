import * as admin from 'firebase-admin';
import { createHash, randomUUID } from 'crypto';
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

/* ─── Re-hosting Google photos in our own Storage ──────────────────────────────
 * A Places photo URL carries our API key and is billed by Google on every
 * *view*, so linking to it straight from a post means paying for — and exposing
 * the key in — every page load, forever. Instead we download each photo once,
 * when the post is generated, and serve it from Firebase Storage. Google is
 * then billed a single time per photo, the key never leaves the server, and the
 * images survive Places rotating its photo resource names.
 */

const STORAGE_PREFIX = 'listingImages';
const GOOGLE_PHOTO_URL = /^https:\/\/(places|maps)\.googleapis\.com\//;
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

export function isGooglePhotoUrl(url: unknown): url is string {
  return typeof url === 'string' && GOOGLE_PHOTO_URL.test(url);
}

// Resolved lazily: this module is imported before admin.initializeApp() runs,
// which is where the default bucket gets configured.
function storageBucket() {
  return admin.storage().bucket();
}

async function saveToStorage(body: Buffer, contentType: string, path: string): Promise<string> {
  const bucket = storageBucket();
  // A download token makes the object publicly readable by URL, exactly like a
  // client-side getDownloadURL() upload — no bucket ACL changes needed.
  const token = randomUUID();

  await bucket.file(path).save(body, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

async function rehostPhoto(sourceUrl: string, folder: string, index: number): Promise<string> {
  const resp = await fetch(sourceUrl, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`Google returned ${resp.status}`);

  const contentType = (resp.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
  if (!contentType.startsWith('image/')) throw new Error(`unexpected content-type "${contentType}"`);

  const path = `${STORAGE_PREFIX}/${folder}/${index}.${EXT_BY_TYPE[contentType] ?? 'jpg'}`;
  return saveToStorage(Buffer.from(await resp.arrayBuffer()), contentType, path);
}

/**
 * Copies any Google-hosted photos into our Storage bucket and returns the list
 * with those entries swapped for our own URLs. Anything already hosted by us is
 * passed through untouched, and a photo that fails to copy keeps its original
 * URL — a post with a Google-hosted image is better than a post with none.
 */
export async function rehostPhotos(urls: unknown[], folder: string): Promise<string[]> {
  return Promise.all(
    urls.map(async (url, i) => {
      if (!isGooglePhotoUrl(url)) return String(url ?? '');
      try {
        return await rehostPhoto(url, folder, i);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[listings] could not re-host photo ${folder}#${i}: ${msg}`);
        return url;
      }
    }),
  );
}

/* ─── Business logo (the post's avatar) ────────────────────────────────────────
 * Google's favicon service answers for *every* domain — when it has no icon it
 * hands back a faint generic globe, which inside a small round avatar reads as a
 * barely-visible smudge. So we go looking for a real icon on the business's own
 * site first (apple-touch-icons are opaque and ≥120px, ideal for a circle), only
 * fall back to the favicon service, and reject its placeholder by fingerprint.
 * Whatever we settle on is copied into our Storage like the photos are, so the
 * post never hot-links a third party. When nothing usable exists we store no
 * logo at all and the post falls back to the business's initial — a filled
 * circle beats an empty outline.
 */

const LOGO_PREFIX = 'listingLogos';
const FAVICON_SERVICE = 'https://www.google.com/s2/favicons';
const ICON_REL = /(^|\s)(apple-touch-icon(-precomposed)?|(shortcut\s+)?icon)(\s|$)/i;
const BROWSER_UA = 'Mozilla/5.0 (compatible; GigspaceBot/1.0; +https://gigspace.co)';

// Cheap, unverified preview URL — used only to show something next to each
// business in the admin's search results, never persisted onto a post.
function faviconPreview(website: string): string {
  try {
    return `${FAVICON_SERVICE}?domain=${new URL(website).hostname}&sz=128`;
  } catch {
    return '';
  }
}

interface FetchedImage { body: Buffer; contentType: string }

// Kept tight: a single unresponsive host must not eat the request budget. Logo
// resolution can try several candidates, and this runs inside a serverless
// function with a hard ceiling on total duration.
const IMAGE_FETCH_TIMEOUT = 4000;
// Whole-of-logo budget, so a site whose every icon URL hangs still gives up in
// time for the rest of generation to finish.
const LOGO_BUDGET_MS = 15000;

async function fetchImage(url: string, timeoutMs = IMAGE_FETCH_TIMEOUT): Promise<FetchedImage | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*' },
    });
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) return null;
    const body = Buffer.from(await resp.arrayBuffer());
    // Anything this small is a tracking pixel or a broken placeholder, not a logo.
    if (body.length < 256) return null;
    return { body, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// The favicon service returns the same globe for every domain it doesn't know,
// so one sample from a domain that cannot exist identifies all of them. Fetched
// once per process.
let placeholderFingerprint: Promise<string | null> | null = null;
const fingerprint = (body: Buffer) => createHash('sha1').update(body).digest('hex');

function faviconPlaceholder(): Promise<string | null> {
  placeholderFingerprint ??= fetchImage(`${FAVICON_SERVICE}?domain=gigspace-no-such-domain.invalid&sz=256`)
    .then((img) => (img ? fingerprint(img.body) : null))
    .catch(() => null);
  return placeholderFingerprint;
}

// Icon <link> tags on the page, best candidate first.
function iconLinks(html: string, origin: string): string[] {
  const found: { url: string; score: number }[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] ?? '';
    if (!ICON_REL.test(rel)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    let url: string;
    try { url = new URL(decodeEntities(href), origin).toString(); } catch { continue; }
    const declared = Number(tag.match(/\bsizes=["'](\d+)/i)?.[1] ?? 0);
    // Apple touch icons carry no size attribute but are opaque and ≥120px, so
    // they outrank everything; past that, the largest declared size wins. A
    // bare <link rel="icon"> is usually a 16px .ico, so it sorts last.
    const score = /apple-touch-icon/i.test(rel) ? 1000 : declared || (/\.svg$/i.test(url) ? 512 : 16);
    found.push({ url, score });
  }
  return found.sort((a, b) => b.score - a.score).map((f) => f.url);
}

/**
 * Pixel dimensions straight from the file header, so a candidate's shape can be
 * judged without decoding it or pulling in an image library. Returns null for
 * formats we don't parse (WebP, SVG), which callers treat as "no objection".
 */
function imageSize(body: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte signature, then an IHDR chunk carrying the dimensions.
  if (body.length > 24 && body.toString('ascii', 12, 16) === 'IHDR') {
    return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
  }
  // GIF: dimensions sit right after the "GIF87a"/"GIF89a" signature.
  if (body.length > 10 && body.toString('ascii', 0, 3) === 'GIF') {
    return { width: body.readUInt16LE(6), height: body.readUInt16LE(8) };
  }
  // ICO: first directory entry; a stored 0 means 256.
  if (body.length > 8 && body.readUInt16LE(0) === 0 && body.readUInt16LE(2) === 1) {
    return { width: body[6] || 256, height: body[7] || 256 };
  }
  // JPEG: walk the marker segments to the start-of-frame, which holds the size.
  if (body.length > 4 && body[0] === 0xff && body[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < body.length) {
      if (body[offset] !== 0xff) { offset += 1; continue; }
      const marker = body[offset + 1];
      // SOF0-SOF15, excluding the non-frame markers DHT/JPG/DAC.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: body.readUInt16BE(offset + 7), height: body.readUInt16BE(offset + 5) };
      }
      offset += 2 + body.readUInt16BE(offset + 2);
    }
  }
  return null;
}

// A logo is displayed inside a small circle, so a banner-shaped file shrinks to
// a sliver and reads as an empty disc. Anything roughly square is fine.
function isRoughlySquare(body: Buffer): boolean {
  const size = imageSize(body);
  if (!size || !size.width || !size.height) return true;  // unknown — don't object
  const ratio = size.width / size.height;
  return ratio >= 0.75 && ratio <= 1.34;
}

/**
 * Downloads the best available logo for a business and returns our own URL for
 * it, or '' when the site has nothing better than the favicon service's globe.
 *
 * Square candidates win outright. A banner-shaped icon is held back and used
 * only if nothing else turns up, because the favicon service — which always
 * returns a square icon — is usually the better answer: one real listing
 * declared a 353x212 wide logo as its only icon, and that rendered as a blank
 * disc where the service had a perfectly good square version of the same mark.
 */
async function resolveLogo(candidates: string[], website: string, folder: string): Promise<string> {
  let origin = '';
  let hostname = '';
  try { const u = new URL(website); origin = u.origin; hostname = u.hostname; } catch { return ''; }

  const store = (img: FetchedImage) =>
    saveToStorage(img.body, img.contentType, `${LOGO_PREFIX}/${folder}.${EXT_BY_TYPE[img.contentType] ?? 'png'}`);

  // Site's own icons first, then the two conventional paths sites serve without
  // declaring. Capped so a site with a dozen dead icon links can't stall a run.
  const deadline = Date.now() + LOGO_BUDGET_MS;
  const fromSite = [...candidates, `${origin}/apple-touch-icon.png`, `${origin}/favicon.ico`].slice(0, 6);
  let banner: FetchedImage | null = null;
  for (const url of fromSite) {
    // Leave room for the favicon service, which is the most reliable candidate.
    if (Date.now() > deadline - IMAGE_FETCH_TIMEOUT) break;
    const img = await fetchImage(url);
    if (!img) continue;
    if (isRoughlySquare(img.body)) return store(img);
    banner ??= img;
  }

  const fallback = await fetchImage(`${FAVICON_SERVICE}?domain=${hostname}&sz=256`);
  if (fallback && fingerprint(fallback.body) !== (await faviconPlaceholder())) return store(fallback);

  return banner ? store(banner) : '';
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
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const fetchPage = (token?: string) =>
      fetch(TEXT_SEARCH_URL, {
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
          ...(token ? { pageToken: token } : {}),
        }),
      });

    const places: Place[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      if (pageToken) {
        // A freshly-issued nextPageToken isn't valid yet — Google needs a short
        // delay before it activates, otherwise the follow-up request 400s and
        // that page's results are silently dropped.
        await sleep(2000);
      }
      let resp = await fetchPage(pageToken);
      if (!resp.ok && pageToken) {
        // Likely hit the token-not-ready window — wait longer and retry once
        // before giving up on this page.
        await sleep(2000);
        resp = await fetchPage(pageToken);
      }

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
        logo: faviconPreview(p.websiteUri ?? ''),
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

const HTML_ENTITY = /&(#\d+|#x[0-9a-f]+|amp|quot|apos|nbsp|lt|gt);/i;

// Entity decoding only — no whitespace handling, so it's safe to run over text
// whose line breaks carry meaning (descriptions are split into paragraphs on
// blank lines, which a whitespace collapse would flatten).
function decodeHtmlEntities(s: string): string {
  return s
    // Numeric entities first — sites encode "&" as "&#38;" and "'" as "&#8217;"
    // often enough that leaving them raw shows up verbatim on the post.
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Used while scraping, where runs of whitespace are just HTML formatting.
function decodeEntities(s: string): string {
  return decodeHtmlEntities(s).replace(/\s+/g, ' ').trim();
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

/* ─── Post titles ──────────────────────────────────────────────────────────────
 * A business's own <title> is frequently just "Home" or "Welcome | Acme" — fine
 * as a browser tab, useless as a marketplace headline. We drop those junk
 * segments and compose what's left into "<Business> — <what they do> in <city>",
 * which always yields something readable from the Places data alone. When an
 * Anthropic key is configured the batch then gets a single rewrite pass for a
 * more enticing headline, falling back to the composed title on any failure.
 */

const TITLE_JUNK = /^(home|home\s?page|welcome|index|untitled|main|start|default|landing(\s?page)?|site|web\s?site|our\s?website|official\s?(site|website))$/i;
const TITLE_SEPARATORS = /\s*[|•·–—:>»]+\s*|\s+-\s+/;

// Search results and cards give a title roughly two lines before it wraps or
// clips, so anything past this stops being read rather than adding information.
const TITLE_MAX = 80;

// Sites often append their postal address or phone number to the page title.
// Neither helps a buyer scanning search results, and an address fragment is
// actively confusing once the title is trimmed ("… — 10742 Colewood").
const TITLE_ADDRESS = /^\d+[\w-]*\s+\S/;      // "10742 Colewood Lane, …"
const TITLE_NO_WORDS = /^[^A-Za-z]+$/;        // "10742", "(214) 555-0134", "2024"

const isUsefulSegment = (s: string) =>
  Boolean(s) && !TITLE_JUNK.test(s) && !TITLE_ADDRESS.test(s) && !TITLE_NO_WORDS.test(s);

function titleSegments(raw: string): string[] {
  return raw.split(TITLE_SEPARATORS).map((s) => s.trim()).filter(isUsefulSegment);
}

/**
 * Site titles routinely repeat themselves across separators — "HVAC CONTRACTOR |
 * HVAC contractor Cleveland, Ohio". Where one segment contains another, only the
 * longer survives; it carries everything the shorter did plus more.
 */
function dedupeSegments(segments: string[]): string[] {
  const kept: string[] = [];
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    const overlapping = kept.findIndex(
      (k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()),
    );
    if (overlapping === -1) kept.push(segment);
    else if (segment.length > kept[overlapping].length) kept[overlapping] = segment;
  }
  return kept;
}

function cleanSiteTitle(raw: string, businessName: string): string {
  const segments = titleSegments(raw);
  if (!segments.length) return '';

  // A segment that only repeats the business name adds nothing once we prepend
  // the name ourselves — unless it's the only segment there is.
  const name = businessName.trim().toLowerCase();
  const descriptive = segments.filter((s) => s.toLowerCase() !== name);
  const kept = dedupeSegments(descriptive.length ? descriptive : segments).join(' — ');
  return kept.length < 3 ? '' : kept;
}

/**
 * Trims to the length budget on a word boundary, so a title that has to be cut
 * still ends on a whole word instead of mid-syllable. Trailing punctuation left
 * dangling by the cut is removed too.
 */
function trimToWords(text: string, max = TITLE_MAX): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  // A single word longer than the budget has no boundary to fall back on.
  const trimmed = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return trimmed.replace(/[\s\-–—,:;|/&]+$/, '');
}

/**
 * Picks the longest candidate that fits the budget, falling back to a
 * word-boundary trim of the last one. Callers pass candidates richest-first, so
 * detail is dropped a piece at a time rather than the whole title being chopped.
 */
function fitTitle(candidates: string[]): string {
  const usable = candidates.map((c) => c.trim()).filter(Boolean);
  return usable.find((c) => c.length <= TITLE_MAX) ?? trimToWords(usable[usable.length - 1] ?? '');
}

const includesCI = (haystack: string, needle: string) =>
  Boolean(needle) && haystack.toLowerCase().includes(needle.toLowerCase());

/**
 * Whole-word containment. A plain substring test is wrong for deciding whether a
 * title names something: "Chicagoland" contains "Chicago" but is not about
 * Chicago Heating & Cooling, and treating it as a match is what let that title
 * survive as-is.
 */
function containsWord(haystack: string, word: string): boolean {
  const trimmed = word.trim();
  if (trimmed.length < 3) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

// Subcategories are stored as slugs ("hvac", "web_design"), so they need casing
// before they can appear in a headline. Acronyms are listed explicitly rather
// than inferred from length — a "short words are acronyms" rule turns
// "web_design" into "WEB Design".
const SERVICE_STOPWORDS = new Set(['and', 'or', 'for', 'the', 'to', 'in', 'of', 'a', 'an']);
const SERVICE_ACRONYMS = new Set([
  'hvac', 'cctv', 'seo', 'sem', 'ppc', 'smm', 'crm', 'erp', 'pos', 'iot', 'vpn',
  'cad', 'gis', 'api', 'ui', 'ux', 'it', 'ac', 'tv', 'av', 'pc', 'dj', 'rv',
  'suv', 'atv', 'led', 'hd', '3d', '2d', 'pr', 'hr', 'b2b', 'b2c', 'diy', 'qa',
]);

function humanizeService(raw: string): string {
  return raw
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      if (/[A-Z]/.test(word)) return word;  // already cased upstream — leave it
      if (i > 0 && SERVICE_STOPWORDS.has(word)) return word;
      if (SERVICE_ACRONYMS.has(word)) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function composeTitle(name: string, siteTitle: string, rawService: string, location: string): string {
  const service = humanizeService(rawService);
  // "HVAC contractor in Austin, Texas", or just one half when that's all we have
  // — the "in" only makes sense once there's a service in front of it.
  const fromPlaces = [service, location && (service ? `in ${location}` : location)].filter(Boolean).join(' ');
  const fromSite = cleanSiteTitle(siteTitle, name);

  // A site title that only echoes the business name tells a buyer nothing the
  // name already did, so the Places data wins that tie.
  const echoesName = fromSite.toLowerCase() === name.trim().toLowerCase();
  const detail = (echoesName ? fromPlaces || fromSite : fromSite || fromPlaces).trim();

  const join = (d: string) =>
    !name ? d : includesCI(d, name) ? d : [name, d].filter(Boolean).join(' — ');

  // Richest first. A long scraped title usually stacks several claims — keeping
  // only its first segment loses the least, and dropping to the Places wording
  // ("HVAC in Cleveland, Ohio") is the last stop before the name alone.
  const firstSegment = titleSegments(detail)[0] ?? '';
  return fitTitle([
    join(detail),
    join(firstSegment),
    join(fromPlaces),
    join(service),
    name,
    detail,
    service,
    'Local service provider',
  ]);
}

/* ─── Optional AI polish ───────────────────────────────────────────────────────
 * Set GEMINI_API_KEY (or ANTHROPIC_API_KEY) to have generated titles rewritten
 * as marketplace headlines. Gemini is preferred when both are present — it's the
 * cheaper of the two and this deployment already sits on Google Cloud. Without
 * either key, generation still works and posts keep their composed title.
 *
 * One batched request per generate, so cost scales with batches rather than
 * posts. Every failure path returns [] and the composed title stands.
 */
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

const TITLE_SYSTEM_PROMPT =
  'You write listing headlines for a local-services marketplace. For each business, ' +
  'write one title that names the business and what it actually does, so a buyer ' +
  `browsing search results knows whether to click. Hard limit ${TITLE_MAX} characters — ` +
  'aim for 50 to 70. Use title case, with no quotes, emoji, or trailing punctuation. ' +
  'Copy the business name verbatim, including "&" and any Inc. or LLC suffix, then ' +
  'separate it from the service description with an em dash. Mention the city only ' +
  'when it fits naturally. Never invent services, credentials, awards, or claims that ' +
  'are not in the supplied data. Return exactly one title per business, in the order given.';

interface TitleSubject {
  name: string;
  service: string;
  location: string;
  fallback: string;
  description: string;
}

const titlePayload = (subjects: TitleSubject[]) =>
  JSON.stringify(
    subjects.map((s) => ({
      business: s.name,
      service: s.service,
      location: s.location,
      currentTitle: s.fallback,
      about: s.description.slice(0, 400),
    })),
  );

/**
 * Validates a model's reply against the batch it was asked about. A short or
 * over-long array means the model lost the ordering, and a mis-mapped title is
 * worse than no title at all — so the whole batch is rejected rather than
 * risking one business getting another's headline.
 */
function parseTitles(rawJson: string, expected: number): string[] {
  const titles = (JSON.parse(rawJson) as { titles?: unknown }).titles;
  if (!Array.isArray(titles) || titles.length !== expected) return [];
  const cleaned = titles.map((t) => trimToWords(String(t ?? '').trim()));
  // A blank entry would silently blank out a post's title.
  return cleaned.every(Boolean) ? cleaned : [];
}

const TITLES_JSON_SCHEMA = {
  type: 'object',
  properties: {
    titles: {
      type: 'array',
      description: 'One rewritten title per business, in the order given.',
      items: { type: 'string' },
    },
  },
  required: ['titles'],
  additionalProperties: false,
} as const;

async function geminiTitles(subjects: TitleSubject[]): Promise<string[]> {
  // Imported lazily so a deploy without the key never pays to load the SDK.
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: titlePayload(subjects),
    config: {
      systemInstruction: TITLE_SYSTEM_PROMPT,
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titles: {
            type: Type.ARRAY,
            description: 'One rewritten title per business, in the order given.',
            items: { type: Type.STRING },
          },
        },
        required: ['titles'],
      },
    },
  });

  return parseTitles(response.text ?? '', subjects.length);
}

async function anthropicTitles(subjects: TitleSubject[]): Promise<string[]> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const response = await client.messages.create({
    model: 'claude-opus-5',
    // Generous ceiling: max_tokens covers reasoning as well as the titles
    // themselves, and a truncated response would fail the schema and cost us
    // the whole batch. Billing is on tokens actually used, not the ceiling.
    max_tokens: 8000,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: TITLES_JSON_SCHEMA },
    },
    system: TITLE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: titlePayload(subjects) }],
  });

  // A refusal or a truncated response can't be parsed against the schema, so
  // say which it was rather than surfacing a bare JSON error.
  if (response.stop_reason !== 'end_turn') {
    console.error(`[listings] title polish stopped early (${response.stop_reason})`);
    return [];
  }
  return parseTitles(response.content.find((b) => b.type === 'text')?.text ?? '', subjects.length);
}

export async function polishTitles(subjects: TitleSubject[]): Promise<string[]> {
  if (subjects.length === 0) return [];
  const provider = GEMINI_KEY ? 'gemini' : ANTHROPIC_KEY ? 'anthropic' : '';
  if (!provider) return [];

  try {
    return provider === 'gemini' ? await geminiTitles(subjects) : await anthropicTitles(subjects);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[listings] ${provider} title polish unavailable, using composed titles: ${msg}`);
    return [];
  }
}

// ─── Rewrite one title on demand (the admin drawer's "rewrite" button) ──────────
// Generation polishes a whole batch; this is the single-post equivalent, so an
// admin unhappy with one headline can ask for another without regenerating the
// post. It only returns a suggestion — the drawer puts it in the field and the
// admin still has to save, so nothing is written here.
export async function rewriteListingTitle(req: AdminRequest, res: Response): Promise<void> {
  try {
    if (!GEMINI_KEY && !ANTHROPIC_KEY) {
      res.status(503).json({
        error: 'AI titles are not configured. Add GEMINI_API_KEY to the server environment.',
      });
      return;
    }

    const { name, service, location, title, description } = (req.body ?? {}) as Record<string, string>;
    const businessName = (name ?? '').trim();
    if (!businessName && !(title ?? '').trim()) {
      res.status(400).json({ error: 'A business name or a current title is required.' });
      return;
    }

    const serviceLabel = humanizeService(service ?? '');
    const [rewritten] = await polishTitles([{
      name: businessName,
      service: serviceLabel,
      location: (location ?? '').trim(),
      // Give the model the current wording as the baseline to improve on, or a
      // composed title when the field is empty.
      fallback: (title ?? '').trim() || composeTitle(businessName, '', service ?? '', location ?? ''),
      description: (description ?? '').trim(),
    }]);

    if (!rewritten) {
      res.status(502).json({ error: 'Could not write a title just now. Please try again.' });
      return;
    }
    res.json({ title: rewritten });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/listings/rewrite-title error:', msg);
    res.status(500).json({ error: msg });
  }
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

interface ScrapedSite { title: string; description: string; email: string; iconUrls: string[] }

const emptySite = (): ScrapedSite => ({ title: '', description: '', email: '', iconUrls: [] });

async function scrapeWebsite(website: string): Promise<ScrapedSite> {
  const out = emptySite();
  let origin = '';
  try { origin = new URL(website).origin; } catch { return out; }

  let descParts: string[] = [];
  const home = await fetchPage(website);
  if (home) {
    out.title = pageTitle(home);
    out.email = pageEmail(home);
    out.iconUrls = iconLinks(home, origin);
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

    // Scrape all selected websites up front (parallel) — title, description,
    // email, and the page's icon links (the raw material for the post's logo).
    const scraped = await Promise.all(
      businesses.map((b) => (b.website ? scrapeWebsite(b.website) : Promise.resolve(emptySite()))),
    );

    // What the business actually does, best available first: Places' own label
    // ("HVAC contractor"), then the subcategory the admin filed it under
    // ("hvac"), and only then the broad category ("Skilled Trade").
    const serviceLabel = (b: GenBusiness) => b.type || subcategory || category || '';

    // Compose a readable title for every business, then hand the whole batch to
    // the model in one request. `polished` is empty whenever AI titles aren't
    // configured or the call failed, so the composed title is always the floor.
    const composed = businesses.map((b, i) =>
      composeTitle(
        b.name ?? '',
        scraped[i].title,
        serviceLabel(b),
        b.location || b.address || '',
      ),
    );
    const polished = await polishTitles(
      businesses.map((b, i) => ({
        name: b.name ?? '',
        service: humanizeService(serviceLabel(b)),
        location: b.location || b.address || '',
        fallback: composed[i],
        description: scraped[i].description || b.description || '',
      })),
    );

    // Reserve every key up front so media can be copied in parallel — each
    // business's files are stored under its own id.
    const refs = businesses.map(() => db.ref('services').push());

    // Post images are the business's Google Business Profile photos (owner
    // uploads), copied into our own Storage so viewing a post never calls — or
    // gets billed by — Google again. The avatar is resolved the same way.
    //
    // Businesses are processed together rather than one after another: this runs
    // in a serverless function with a hard duration ceiling, and a couple of
    // slow-responding sites in a batch used to add up past it.
    const media = await Promise.all(
      businesses.map(async (b, i) => {
        const id = refs[i].key as string;
        const [images, logo] = await Promise.all([
          rehostPhotos(Array.isArray(b.images) ? b.images : [], id),
          b.website ? resolveLogo(scraped[i].iconUrls, b.website, id) : Promise.resolve(''),
        ]);
        return { images, logo };
      }),
    );

    for (let i = 0; i < businesses.length; i++) {
      const b = businesses[i];
      const site = scraped[i];
      const ref = refs[i];
      const id = ref.key as string;
      const now = Date.now();
      const { images, logo } = media[i];
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
        sellerPhotoURL: logo,
        title: polished[i] || composed[i],
        description:
          site.description ||
          b.description ||
          `${b.name ?? ''} — ${humanizeService(serviceLabel(b))}. ${location}`.trim(),
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

// ─── Backfill: move already-generated posts onto our own storage ────────────────
// Newly generated posts already store their photos and logo with us — this is
// purely for posts created before that, which still point at
// places.googleapis.com for photos or at the favicon service for their avatar.
// It walks them in batches (one HTTP call can only do so much before the
// serverless timeout) and reports what's left so the caller can keep going.
const REHOST_BATCH_MAX = 25;
const HOTLINKED_LOGO = /^https:\/\/(www\.)?google\.com\/s2\/favicons/;

// Anything not already on our own bucket needs replacing — an empty avatar on a
// generated post means we never resolved one.
const needsLogo = (service: Record<string, unknown>) =>
  service.isGenerated === true &&
  typeof service.website === 'string' &&
  service.website !== '' &&
  (typeof service.sellerPhotoURL !== 'string' ||
    service.sellerPhotoURL === '' ||
    HOTLINKED_LOGO.test(service.sellerPhotoURL));

/**
 * Whether a stored title is one we should rebuild. A hand-written title is never
 * touched — the drawer records `titleEditedByAdmin` on save, and that flag is
 * checked by the caller before this runs — so the only titles reaching here came
 * from scraping, and the bar is simply "would a buyer learn anything from it".
 *
 * Four cases qualify:
 *   - empty
 *   - a raw HTML entity, always a scraping artefact
 *   - nothing but junk once cleaned ("Home", "Welcome")
 *   - a bare fragment: too short to inform, and naming neither the business nor
 *     what it does. "Chicagoland" is the motivating example — a real word, but
 *     it tells a buyer browsing search results nothing at all.
 */
const TITLE_MIN_USEFUL_WORDS = 3;

function isWeakTitle(title: unknown, businessName: string, service: string, location: string): title is string {
  if (typeof title !== 'string' || !title.trim()) return true;
  if (HTML_ENTITY.test(title)) return true;

  const cleaned = cleanSiteTitle(title, businessName);
  if (!cleaned) return true;

  // Long enough to be carrying real information — leave it be.
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= TITLE_MIN_USEFUL_WORDS) return false;

  // Short, but still anchored to something a buyer recognises. Whole-word
  // matching matters here: "Chicagoland" must not count as naming "Chicago".
  const firstNameWord = businessName.trim().split(/\s+/)[0] ?? '';
  const anchored =
    containsWord(cleaned, firstNameWord) ||
    containsWord(cleaned, humanizeService(service)) ||
    containsWord(cleaned, location.split(',')[0]);

  return !anchored;
}

/**
 * Whether the backfill should rebuild this title. Weak content is one reason;
 * simply being over the length budget is the other, and it's an objective
 * measurement rather than a judgement about wording. Kept separate from
 * `isWeakTitle` because an over-long scraped title is still worth *reading* —
 * `composeTitle` can shed a segment and keep the useful part, whereas a weak one
 * has nothing worth salvaging.
 */
function needsTitleRepair(title: unknown, name: string, service: string, location: string): boolean {
  if (isWeakTitle(title, name, service, location)) return true;
  // isWeakTitle already rejected every non-string, so this is safe.
  const text = String(title);
  if (text.length > TITLE_MAX) return true;
  // Carries a segment we would now reject — a postal address, a phone number,
  // or a "Home"-style filler that an earlier version of this code let through.
  const raw = text.split(TITLE_SEPARATORS).map((s) => s.trim()).filter(Boolean);
  return raw.length !== titleSegments(text).length;
}

// Descriptions only ever need the entity fix — the scraped copy itself is fine.
const hasRawEntity = (text: unknown): text is string =>
  typeof text === 'string' && HTML_ENTITY.test(text);

export async function rehostListingPhotos(req: AdminRequest, res: Response): Promise<void> {
  try {
    const requested = Number((req.body ?? {}).limit);
    const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 5, REHOST_BATCH_MAX);

    const db = admin.database();
    const snap = await db.ref('services').once('value');

    interface Pending {
      id: string;
      images: unknown[];
      website: string;      // '' when neither repair below needs the homepage
      staleLogo: boolean;
      brokenTitle: boolean;
      rawDescription: string;   // '' unless it still carries undecoded entities
      name: string;
      service: string;
      location: string;
    }

    const pending: Pending[] = [];
    snap.forEach((child) => {
      const service = (child.val() ?? {}) as Record<string, unknown>;
      if (service.isGenerated !== true) return false;

      const images = Array.isArray(service.images) ? service.images : [];
      const name = String(service.sellerName ?? '');
      // Subcategory is the specific trade ("HVAC"); category is the bucket.
      const trade = String(service.subcategory || service.category || '');
      const location = String(service.primaryLocation ?? '');
      const staleLogo = needsLogo(service);
      // An admin who wrote this title owns it — we never second-guess their wording.
      const brokenTitle =
        service.titleEditedByAdmin !== true && needsTitleRepair(service.title, name, trade, location);
      const rawDescription = hasRawEntity(service.description) ? service.description : '';

      if (images.some(isGooglePhotoUrl) || staleLogo || brokenTitle || rawDescription) {
        pending.push({
          id: child.key as string,
          images,
          // A weak title also needs the homepage, to read the real <title>.
          website: staleLogo || brokenTitle ? String(service.website ?? '') : '',
          staleLogo,
          brokenTitle,
          rawDescription,
          name,
          service: trade,
          location,
        });
      }
      return false; // keep iterating
    });

    let migrated = 0;
    let photos = 0;
    let logos = 0;
    let titles = 0;
    let descriptions = 0;
    let failed = 0;

    const batch = pending.slice(0, limit);
    const patches = new Map<string, Record<string, unknown>>();
    // Titles rebuilt below are collected so the whole batch can go through the
    // same AI pass a freshly generated post gets — one request, not one per post.
    const titleWork: { id: string; subject: TitleSubject }[] = [];

    for (const item of batch) {
      const patch: Record<string, unknown> = {};

      const rehosted = await rehostPhotos(item.images, item.id);
      const copied = rehosted.filter((url, i) => url !== item.images[i]).length;
      if (copied) { patch.images = rehosted; photos += copied; }
      failed += rehosted.filter(isGooglePhotoUrl).length;

      // Pure text fix — no refetch needed, and paragraph breaks are preserved.
      const description = item.rawDescription ? decodeHtmlEntities(item.rawDescription) : '';
      if (description) patch.description = description;

      if (item.website) {
        // One homepage fetch serves both repairs below.
        const home = await fetchPage(item.website);
        let origin = '';
        try { origin = new URL(item.website).origin; } catch { /* resolveLogo handles it */ }

        if (item.staleLogo) {
          const logo = await resolveLogo(home && origin ? iconLinks(home, origin) : [], item.website, item.id);
          if (logo) patch.sellerPhotoURL = logo;
        }

        if (item.brokenTitle) {
          // If the site's own title is as weak as the one we're replacing,
          // ignore it and compose from the Places data instead — re-scraping
          // "Chicagoland" and storing it again would fix nothing.
          const scraped = home ? pageTitle(home) : '';
          const usable = isWeakTitle(scraped, item.name, item.service, item.location) ? '' : scraped;
          const rebuilt = composeTitle(item.name, usable, item.service, item.location);
          // Only worth a write if we ended up somewhere other than the bare name.
          if (rebuilt && rebuilt !== item.name) {
            patch.title = rebuilt;
            titleWork.push({
              id: item.id,
              subject: {
                name: item.name,
                service: humanizeService(item.service),
                location: item.location,
                fallback: rebuilt,
                description,
              },
            });
          }
        }
      }

      if (Object.keys(patch).length) patches.set(item.id, patch);
    }

    // Same graceful degradation as generation: no key or any failure leaves the
    // composed titles in place.
    const polished = await polishTitles(titleWork.map((t) => t.subject));
    titleWork.forEach((t, i) => {
      if (polished[i]) patches.get(t.id)!.title = polished[i];
    });

    for (const [id, patch] of patches) {
      patch.updatedAt = Date.now();
      await db.ref(`services/${id}`).update(patch);
      migrated += 1;
      if (patch.sellerPhotoURL) logos += 1;
      if (patch.title) titles += 1;
      if (patch.description) descriptions += 1;
    }

    res.json({
      pending: pending.length,
      processed: Math.min(limit, pending.length),
      migrated,
      photos,
      logos,
      titles,
      descriptions,
      failed,
      remaining: Math.max(0, pending.length - limit),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/listings/rehost-photos error:', msg);
    res.status(500).json({ error: msg });
  }
}
