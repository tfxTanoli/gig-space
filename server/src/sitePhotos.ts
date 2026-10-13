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

/** The largest entry of a srcset ("a.jpg 480w, b.jpg 1200w" → b.jpg). */
function largestFromSrcset(srcset: string): string {
  let best = '';
  let bestW = -1;
  for (const part of srcset.split(',')) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const w = parseFloat(size ?? '') || 0;
    if (w > bestW) { best = url; bestW = w; }
  }
  return best;
}

function metaImage(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
    'i',
  );
  const m = html.match(re);
  return decode(m?.[1] ?? m?.[2] ?? '');
}

/**
 * Photo candidates from a page, best guess first: the image the site itself
 * marks as its main one (og:image / twitter:image), then <img> and inline
 * background images in page order. Unverified — pickSitePhotos() checks them.
 */
export function pageImageCandidates(html: string, pageUrl: string, max = 16): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string, ...context: string[]) => {
    if (!raw || raw.startsWith('data:')) return;
    let url: string;
    try { url = new URL(raw.trim(), pageUrl).toString(); } catch { return; }
    if (!/^https?:/i.test(url) || SKIP_EXT.test(url)) return;
    if (looksLikeFurniture(url, ...context)) return;
    if (seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };

  add(metaImage(html, 'og:image:secure_url'));
  add(metaImage(html, 'og:image'));
  add(metaImage(html, 'twitter:image'));

  // Strip scripts/styles/noscript-free markup is not needed: we only read tags.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const w = parseInt(attr(tag, 'width'), 10);
    const h = parseInt(attr(tag, 'height'), 10);
    if ((w && w < 200) || (h && h < 150)) continue;
    const srcset = attr(tag, 'srcset') || attr(tag, 'data-srcset');
    const src = (srcset && largestFromSrcset(srcset))
      || attr(tag, 'data-src') || attr(tag, 'data-lazy-src') || attr(tag, 'data-original') || attr(tag, 'src');
    add(src, attr(tag, 'alt'), attr(tag, 'class'), attr(tag, 'id'));
    if (out.length >= max) return out;
  }

  // Hero sections are often a CSS background rather than an <img>.
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    add(decode(m[1]));
    if (out.length >= max) break;
  }
  return out.slice(0, max);
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Some hosts refuse obvious bots or requests without a referring page.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        ...(referer ? { Referer: referer } : {}),
      },
    });
    if (!resp.ok) return null;
    const contentType = (resp.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!CONTENT_EXT[contentType]) return null;
    const body = Buffer.from(await resp.arrayBuffer());
    // Over 3 MB is an unoptimised original (one site served a 7.7 MB PNG) —
    // too heavy to put in front of every visitor.
    if (body.length < 10_000 || body.length > 3_000_000) return null;
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
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads candidates in page order and keeps up to `max` genuine photos,
 * skipping duplicates (the same photo is often linked at several sizes, or from
 * og:image and the hero <img> both).
 *
 * A few at a time rather than all at once: small business hosts throttle a
 * burst of parallel requests, which silently cost one test site every photo but
 * the first. Stops as soon as it has enough.
 */
export async function pickSitePhotos(
  candidates: string[],
  website: string,
  max = 3,
  timeoutMs = 8000,
): Promise<SitePhoto[]> {
  let referer = '';
  try { referer = new URL(website).origin + '/'; } catch { /* no referer */ }
  const queue = candidates.slice(0, 12);
  const picked: SitePhoto[] = [];
  const seen = new Set<string>();
  const BATCH = 3;
  for (let i = 0; i < queue.length && picked.length < max; i += BATCH) {
    const results = await Promise.all(queue.slice(i, i + BATCH).map((u) => download(u, referer, timeoutMs)));
    for (const r of results) {
      if (!r || picked.length >= max) continue;
      const hash = createHash('sha1').update(r.body).digest('hex');
      const nameKey = photoNameKey(r.url);
      if (seen.has(hash) || seen.has(nameKey)) continue;
      seen.add(hash);
      seen.add(nameKey);
      picked.push(r);
    }
  }
  return picked;
}
