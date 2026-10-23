/* ─── Post photos from the business's own website ──────────────────────────────
 * Generated posts used to copy the business's Google photos. Google's Places
 * policy forbids storing its content (only the place ID may be kept), so posts
 * now take their photos from the business's own site instead (GIG-74).
 *
 * Two stages, because they run at different times and costs:
 *  - pageImageCandidates(): pure parsing of a page we already fetched for the
 *    email. Cheap, so the admin search preview can show what will be used.
 *  - pickSitePhotos(): downloads candidates and keeps only real photos. Runs at
 *    generate time, once per business.
 *
 * A naive "first <img> on the page" picked a furnace coupon and a Google-rating
 * badge on two of the first six sites tested, so both stages filter hard.
 */
import { createHash } from 'crypto';
import { safeFetch, readCapped } from './safeFetch';

// Words that mark an image as page furniture rather than a photo of the work.
// Matched against whole tokens of the URL, alt text and class, so "silicone"
// (which contains "icon") or "decorating" (which contains "rating") pass.
const SKIP_TOKENS = new Set([
  'logo', 'logos', 'icon', 'icons', 'favicon', 'sprite', 'sprites', 'badge', 'badges',
  'seal', 'seals', 'award', 'awards', 'rating', 'ratings', 'review', 'reviews',
  'star', 'stars', 'coupon', 'coupons', 'pixel', 'spacer', 'blank', 'placeholder',
  'loader', 'loading', 'arrow', 'arrows', 'chevron', 'btn', 'button', 'avatar',
  'headshot', 'signature', 'qr', 'flag', 'map', 'bbb', 'angi', 'angieslist',
  'visa', 'amex', 'mastercard', 'paypal', 'payment', 'payments', 'financing',
  'certified', 'certification', 'accredited', 'emoji', 'clipart',
  'flyer', 'flyers', 'poster', 'posters', 'brochure', 'promo',
]);
// Brand names are distinctive enough to match inside a token
// ("GoogleRatingColor-300x150.png", "facebook_round.png").
const SKIP_SUBSTRINGS = [
  'google', 'yelp', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok',
  'pinterest', 'twitter', 'homeadvisor', 'thumbtack', 'houzz', 'nextdoor',
  'favicon', 'coupon', 'logo', 'badge', 'certif', 'trustpilot', 'gravatar',
];

const SKIP_EXT = /\.(svg|gif|ico|bmp|tiff?)(?:$|[?#])/i;

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function looksLikeFurniture(...texts: string[]): boolean {
  const joined = texts.join(' ').toLowerCase();
  if (SKIP_SUBSTRINGS.some((w) => joined.includes(w))) return true;
  return tokens(joined).some((t) => SKIP_TOKENS.has(t));
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decode(m?.[1] ?? m?.[2] ?? m?.[3] ?? '');
}

/**
 * The smallest srcset entry that is still sharp at gallery size (1200px wide),
 * or the largest when none is that big ("a.jpg 480w, b.jpg 1200w, c.jpg
 * 2250w" → b.jpg). Anything bigger only adds weight for every visitor.
 */
function bestFromSrcset(srcset: string): string {
  const entries = srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/))
    .filter(([url]) => Boolean(url))
    .map(([url, size]) => ({ url, w: parseFloat(size ?? '') || 0 }));
  const sharp = entries.filter((e) => e.w >= 1200).sort((a, b) => a.w - b.w)[0];
  return sharp?.url ?? entries.sort((a, b) => b.w - a.w)[0]?.url ?? '';
}

function metaImage(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
    'i',
  );
  const m = html.match(re);
  return decode(m?.[1] ?? m?.[2] ?? '');
}

/* ─── Site builders that hide the real image ───────────────────────────────────
 * Some builders put only a placeholder in the HTML and swap the real image in
 * with JavaScript, which we never run:
 *  - Wix serves 50px blurred previews (…/v1/fill/w_50,h_33,blur_3/…) and
 *    gallery images as AVIF, so as4less-landscaping.com gave us nothing but its
 *    share image, which is a flyer (GIG-74). Every Wix image URL carries the
 *    media id, so we ask Wix's CDN for that image at a size of our choosing.
 *  - Squarespace serves the original upload unless ?format= picks a size, and
 *    originals are routinely over the 3 MB download cap.
 */
const WIX_MEDIA = /^https?:\/\/static\.wixstatic\.com\/media\/([^/?#]+)/i;
// Wix's stock libraries: its free media (a bare 32-hex id) and its Unsplash
// collection (11062b_). Template sites ship with these; they show nobody's work.
const WIX_STOCK = /^(?:[0-9a-f]{32}\.[a-z]+$|11062b_)/i;
// Uploads are filed under the uploading account's prefix ("96b0bb_…").
const wixOwner = (url: string) => url.match(WIX_MEDIA)?.[1].match(/^([0-9a-f]{6})_/i)?.[1].toLowerCase() ?? '';

/** The full-size form of a placeholder URL; null for stock images to skip. */
export function fullSizeUrl(url: string): string | null {
  const wix = url.match(WIX_MEDIA);
  if (wix) {
    let id = wix[1];
    try { id = decodeURIComponent(id); } catch { /* keep as found */ }
    if (WIX_STOCK.test(id)) return null;
    return `https://static.wixstatic.com/media/${id}/v1/fit/w_1600,h_1600,q_85/${id}`;
  }
  if (/^https?:\/\/images\.squarespace-cdn\.com\//i.test(url)) {
    const u = new URL(url);
    u.searchParams.set('format', '1500w');
    return u.toString();
  }
  return url;
}

/**
 * Photo candidates from a page in page order: <img> tags, inline background
 * images, then images a Wix page only names in its data. The share image
 * (og:image / twitter:image) comes last: small businesses often set a flyer or
 * logo there, and the page's own photos show the work better. Unverified —
 * pickSitePhotos() checks them.
 */
export function pageImageCandidates(html: string, pageUrl: string, max = 24): string[] {
  // Resolves, upgrades and filters one candidate; null when it should be skipped.
  const resolve = (raw: string, ...context: string[]): { url: string; upgraded: boolean } | null => {
    if (!raw || raw.startsWith('data:')) return null;
    let abs: string;
    try { abs = new URL(raw.trim(), pageUrl).toString(); } catch { return null; }
    if (!/^https?:/i.test(abs) || SKIP_EXT.test(abs)) return null;
    if (looksLikeFurniture(abs, ...context)) return null;
    const url = fullSizeUrl(abs);
    return url ? { url, upgraded: url !== abs } : null;
  };

  const share = [...new Set(
    ['og:image:secure_url', 'og:image', 'twitter:image']
      .map((key) => resolve(metaImage(html, key))?.url ?? '')
      .filter(Boolean),
  )];

  const out: string[] = [];
  const seen = new Set<string>(share);
  const push = (url: string) => { if (!seen.has(url)) { seen.add(url); out.push(url); } };

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const srcset = attr(tag, 'srcset') || attr(tag, 'data-srcset');
    const src = (srcset && bestFromSrcset(srcset))
      || attr(tag, 'data-src') || attr(tag, 'data-lazy-src') || attr(tag, 'data-original') || attr(tag, 'src');
    const c = resolve(src, attr(tag, 'alt'), attr(tag, 'class'), attr(tag, 'id'));
    if (!c) continue;
    // Small declared dimensions mean an icon — unless they describe a
    // placeholder we have just swapped for the full-size image.
    const w = parseInt(attr(tag, 'width'), 10);
    const h = parseInt(attr(tag, 'height'), 10);
    if (!c.upgraded && ((w && w < 200) || (h && h < 150))) continue;
    push(c.url);
  }

  // Hero sections are often a CSS background rather than an <img>.
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    const c = resolve(decode(m[1]));
    if (c) push(c.url);
  }

  // Wix lists section backgrounds and gallery items in page data, not tags.
  // Meta tags are left out so the share image keeps its place at the end.
  const body = html.replace(/<meta\b[^>]*>/gi, '');
  for (const m of body.matchAll(/static\.wixstatic\.com\/media\/([A-Za-z0-9_~%.-]+?\.(?:jpe?g|png|webp))/gi)) {
    const c = resolve(`https://static.wixstatic.com/media/${m[1]}`);
    if (c) push(c.url);
  }

  // On Wix, the site's own uploads go before images a template brought along
  // (filed under another account). The share image is the owner's choice, so
  // its account is the owner's; failing that, the most common one.
  let owner = share.map(wixOwner).find(Boolean) ?? '';
  if (!owner) {
    const counts = new Map<string, number>();
    for (const u of out) { const o = wixOwner(u); if (o) counts.set(o, (counts.get(o) ?? 0) + 1); }
    owner = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }
  const ordered = owner
    ? [...out.filter((u) => !wixOwner(u) || wixOwner(u) === owner), ...out.filter((u) => wixOwner(u) && wixOwner(u) !== owner)]
    : out;

  return [...ordered.slice(0, Math.max(0, max - share.length)), ...share];
}

/** Width/height straight from the file header — no image library needed. */
export function imageDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const t = buf.toString('ascii', 12, 16);
    if (t === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (t === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
    if (t === 'VP8X') return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length - 9;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/**
 * Badges, logos and cut-out graphics are saved losslessly or with transparency,
 * and because they are mostly flat colour they compress to almost nothing.
 * Tested on the first six sites: a Yelp five-star logo (palette PNG, 0.03
 * bytes/pixel), a BBB "A+ Rating" badge filed as "Quick+Edits-5.webp" (WebP
 * with alpha, 0.05), an empty decorative frame (RGBA PNG, 0.01) and product
 * cut-outs (WebP with alpha, 0.04-0.07).
 *
 * The format alone is not enough: Jetpack's image CDN re-encodes ordinary
 * photos as lossless WebP. Those run near 1 byte/pixel, so a lossless or
 * transparent image only counts as a graphic when it is also that compressible.
 */
export function looksLikeGraphic(buf: Buffer): boolean {
  let flatFormat = false;
  if (buf.length > 26 && buf.readUInt32BE(0) === 0x89504e47) {
    const colourType = buf[25];
    flatFormat = colourType === 3 || colourType === 4 || colourType === 6; // palette or alpha
  } else if (buf.length > 21 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    flatFormat = chunk === 'VP8L' || (chunk === 'VP8X' && ((buf[20] >> 4) & 1) === 1);
  }
  if (!flatFormat) return false;
  const d = imageDimensions(buf);
  return !d || buf.length / (d.w * d.h) < 0.25;
}

/**
 * Same photo, different file: "IMG_4496.jpeg" vs "IMG_4496-1024x768.jpeg", or a
 * cache-busting hash appended by an optimiser plugin. Byte hashes can't see
 * these, so compare the file name with size suffixes and long hashes removed.
 */
export function photoNameKey(url: string): string {
  let name = '';
  try { name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? ''); } catch { return url; }
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[-_](?=[a-z0-9]*\d)[a-z0-9]{16,}$/, '')      // trailing hash token
    .replace(/[-_]\d{2,5}x\d{2,5}$/, '')                  // -1024x768
    .replace(/[-_]\d{2,5}w$/, '')                          // -1920w
    .replace(/[-_](scaled|min|large|medium|small|full)$/, '')
    .replace(/@\dx$/, '');
}

/** Lower is better: closeness to a 1.91:1 share card, portrait penalised. */
export function cardScore(d: { w: number; h: number }): number {
  const ar = d.w / d.h;
  return Math.abs(Math.log(ar / 1.91)) + (ar < 1 ? 2 : 0) + (d.w < 600 ? 1 : 0);
}

export interface SitePhoto {
  url: string;
  body: Buffer;
  contentType: string;
  width: number;
  height: number;
}

const CONTENT_EXT: Record<string, true> = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };

async function download(url: string, referer: string, timeoutMs: number): Promise<SitePhoto | null> {
  try {
    // safeFetch refuses private/internal addresses at every redirect hop: these
    // URLs come from third-party HTML.
    const resp = await safeFetch(url, {
      timeoutMs,
      headers: {
        // Some hosts refuse obvious bots or requests without a referring page.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
        // Image CDNs pick the format from this header. Naming AVIF cost us
        // every Wix photo (we can't read its dimensions), and naming WebP gets
        // Jetpack's lossless re-encode: 990 KB for a photo that is 206 KB as
        // JPEG, multiplied by every visitor. Plain .webp files still come back.
        Accept: 'image/jpeg,image/png,image/*;q=0.8',
        ...(referer ? { Referer: referer } : {}),
      },
    });
    if (!resp.ok) { await resp.body?.cancel(); return null; }
    const contentType = (resp.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!CONTENT_EXT[contentType]) { await resp.body?.cancel(); return null; }
    // Over 3 MB is an unoptimised original (one site served a 7.7 MB PNG) —
    // too heavy to put in front of every visitor. Abandoned mid-download.
    const body = await readCapped(resp, 3_000_000);
    if (!body || body.length < 10_000) return null;
    if (looksLikeGraphic(body)) return null;
    const d = imageDimensions(body);
    if (!d) return null;
    // A lossy image this compressible is flat colour — a tinted overlay or a
    // texture behind the page, not a photo of the work.
    if (body.length / (d.w * d.h) < 0.025) return null;
    // Real photos only: big enough to fill a gallery slot, and not a thin
    // strip (header bands, dividers, banner ads).
    const ar = d.w / d.h;
    if (d.w < 400 || d.h < 250 || ar > 3 || ar < 0.45) return null;
    return { url, body, contentType, width: d.w, height: d.h };
  } catch {
    return null;
  }
}

/** Photos a generated post takes from the business's site. */
export const MAX_SITE_PHOTOS = 6;

/** Scores at or below this mean "not a photo of the work" (see photoRank.ts). */
const MIN_PHOTO_SCORE = 3;

/** Scores 0–10 per photo; null for one it didn't score, or for the whole batch when unavailable. */
export type PhotoScorer = (photos: SitePhoto[]) => Promise<(number | null)[] | null>;

export interface PickOptions {
  max?: number;
  /** Per-image download timeout. */
  timeoutMs?: number;
  /** Wall-clock time (ms since epoch) after which no new download starts. */
  deadline?: number;
  /** Orders the photos by what they show; page order without it. */
  score?: PhotoScorer;
}

/**
 * Best first, page order breaking ties. Photos scored as not showing the work
 * are dropped; unscored ones keep their page order after the scored ones.
 */
export function rankByScore<T>(items: T[], scores: (number | null)[]): T[] {
  return items
    .map((item, i) => ({ item, i, s: scores[i] ?? null }))
    .filter(({ s }) => s === null || s >= MIN_PHOTO_SCORE)
    .sort((a, b) => (b.s ?? -1) - (a.s ?? -1) || a.i - b.i)
    .map(({ item }) => item);
}

/**
 * Downloads candidates in page order and keeps up to `max` genuine photos,
 * skipping duplicates (the same photo is often linked at several sizes, or from
 * og:image and the hero <img> both). With a scorer, a few spare photos are
 * gathered and the best are kept, best first.
 *
 * A few at a time rather than all at once: small business hosts throttle a
 * burst of parallel requests, which silently cost one test site every photo but
 * the first. Stops as soon as it has enough, or at the deadline.
 */
export async function pickSitePhotos(
  candidates: string[],
  website: string,
  { max = MAX_SITE_PHOTOS, timeoutMs = 8000, deadline = Infinity, score }: PickOptions = {},
): Promise<SitePhoto[]> {
  let referer = '';
  try { referer = new URL(website).origin + '/'; } catch { /* no referer */ }
  const queue = candidates.slice(0, 24);
  const want = score ? max + 4 : max;
  const picked: SitePhoto[] = [];
  const seen = new Set<string>();
  const BATCH = 3;
  for (let i = 0; i < queue.length && picked.length < want && Date.now() < deadline; i += BATCH) {
    const results = await Promise.all(queue.slice(i, i + BATCH).map((u) => download(u, referer, timeoutMs)));
    for (const r of results) {
      if (!r || picked.length >= want) continue;
      const hash = createHash('sha1').update(r.body).digest('hex');
      const nameKey = photoNameKey(r.url);
      if (seen.has(hash) || seen.has(nameKey)) continue;
      seen.add(hash);
      seen.add(nameKey);
      picked.push(r);
    }
  }
  if (!score || picked.length === 0) return picked.slice(0, max);
  const scores = await score(picked).catch(() => null);
  return (scores ? rankByScore(picked, scores) : picked).slice(0, max);
}
