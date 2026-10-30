/* ─── Photos in the sizes we show them (GIG-74) ─────────────────────────────────
 * A business's own photos arrive at whatever size its site uses — often several
 * hundred KB each — and used to be stored untouched. Every post view then
 * downloaded the whole gallery at full size, thumbnails included, and every
 * search card pulled a full-size photo into a 300px slot.
 *
 * Each photo is now stored three times, resized once:
 *
 *   <stem>-<n>-1200w.webp   gallery     up to 1200 x 1600
 *   <stem>-<n>-640w.webp    search card up to 640 x 480   (4:3, centre-cropped)
 *   <stem>-<n>-240w.webp    thumbnail   up to 240 x 180   (4:3, centre-cropped)
 *
 * The card and thumbnail are cropped to 4:3 because that is the shape of the
 * slot they fill; the browser would centre-crop the full photo to the same
 * region, so nothing looks different, it just weighs less.
 *
 * The three objects share one download token, so a URL for any size follows
 * from the gallery URL by swapping the suffix. src/utils/imageVariants.ts does
 * that swap in the browser and in the server-rendered pages — keep the suffixes
 * in step with it. Posts made before this change keep their single stored
 * photo, which that helper leaves alone.
 *
 * Resizing is best effort: if it fails or time is short, the original is stored
 * as before and the post is created regardless.
 */
import { randomUUID } from 'crypto';
import { saveToStorage, storageBucket } from './storage';

export const FULL_WIDTH = 1200;
export const FULL_MAX_HEIGHT = 1600;
export const CARD_WIDTH = 640;
export const THUMB_WIDTH = 240;

export const VARIANT_SUFFIX = {
  full: `-${FULL_WIDTH}w.webp`,
  card: `-${CARD_WIDTH}w.webp`,
  thumb: `-${THUMB_WIDTH}w.webp`,
} as const;

type Sharp = typeof import('sharp').default;

// Loaded on first use, so a deploy where the native image library can't start
// still serves every other route, and generation falls back to the originals.
let sharpLoader: Promise<Sharp> | null = null;
function loadSharp(): Promise<Sharp> {
  sharpLoader ??= import('sharp').then((m) => {
    // Compiled to CommonJS, the callable module is the namespace's default.
    const sharp = (m.default ?? (m as unknown)) as Sharp;
    sharp.cache(false);     // each photo is processed once; nothing to reuse
    sharp.concurrency(2);   // threads per job: a serverless function has little CPU
    return sharp;
  });
  return sharpLoader;
}

export interface PhotoVariants {
  full: Buffer;
  card: Buffer;
  thumb: Buffer;
  /** Pixel size of the gallery version. */
  width: number;
  height: number;
}

/**
 * The largest 4:3 region of a width x height photo, capped at maxWidth wide and
 * never larger than the photo itself — a small photo is cropped, not stretched.
 */
export function fitFourThree(width: number, height: number, maxWidth: number): { width: number; height: number } {
  let w = Math.min(maxWidth, width);
  let h = Math.round((w * 3) / 4);
  if (h > height) {
    h = height;
    w = Math.round((h * 4) / 3);
  }
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

/** Decodes once, then derives all three sizes from the same pixels. Throws on anything it can't read. */
export async function makeVariants(input: Buffer): Promise<PhotoVariants> {
  const sharp = await loadSharp();

  const { data, info } = await sharp(input, { failOn: 'none', limitInputPixels: 120_000_000 })
    .rotate() // honour the camera's orientation flag
    .resize({ width: FULL_WIDTH, height: FULL_MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = { raw: { width: info.width, height: info.height, channels: info.channels } };
  const card = fitFourThree(info.width, info.height, CARD_WIDTH);
  const thumb = fitFourThree(info.width, info.height, THUMB_WIDTH);

  const [full, cardBuf, thumbBuf] = await Promise.all([
    sharp(data, pixels).webp({ quality: 78, effort: 2 }).toBuffer(),
    sharp(data, pixels).resize(card.width, card.height, { fit: 'cover', position: 'centre' }).webp({ quality: 72, effort: 2 }).toBuffer(),
    sharp(data, pixels).resize(thumb.width, thumb.height, { fit: 'cover', position: 'centre' }).webp({ quality: 68, effort: 2 }).toBuffer(),
  ]);

  return { full, card: cardBuf, thumb: thumbBuf, width: info.width, height: info.height };
}

/**
 * Proves this deployment can resize photos: loads the native image library and
 * runs a tiny photo through the real pipeline. Served at /api/health/images so a
 * deploy can be checked with one request.
 */
export async function imageSupport(): Promise<{ sharp: string; libvips: string; resized: boolean }> {
  const sharp = await loadSharp();
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#7a8b6f' } }).png().toBuffer();
  const v = await makeVariants(png);
  return { sharp: sharp.versions.sharp, libvips: sharp.versions.vips, resized: v.full.length > 0 && v.card.length > 0 && v.thumb.length > 0 };
}

// Decoding and encoding are the one CPU-heavy step of generation, and a batch
// of businesses runs them all at once. A shared limit keeps the function's CPU
// and memory bounded however many photos are in flight.
export function createLimiter(max: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function limited<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    else active += 1;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next(); // hand the slot straight to the next waiter
      else active -= 1;
    }
  };
}
const limited = createLimiter(3);

async function removeQuietly(paths: string[]): Promise<void> {
  const bucket = storageBucket();
  await Promise.allSettled(paths.map((p) => bucket.file(p).delete({ ignoreNotFound: true })));
}

export interface PhotoInput {
  body: Buffer;
  contentType: string;
}

/**
 * Stores one photo in all three sizes under `dir` and returns the gallery URL.
 * `n` is its 1-based position in the post. `fallbackPath` is where the untouched
 * original goes if the sizes can't be made — or if `deadline` (ms since epoch)
 * has passed, so a slow run still finishes inside the function's time limit.
 */
export async function storePhoto(
  photo: PhotoInput,
  dir: string,
  stem: string,
  n: number,
  fallbackPath: string,
  deadline = Infinity,
): Promise<string> {
  if (Date.now() < deadline) {
    let variants: PhotoVariants | null = null;
    try {
      variants = await limited(() => makeVariants(photo.body));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[photos] could not resize ${dir}/${stem}-${n}, storing the original: ${msg}`);
    }

    if (variants) {
      const base = `${dir}/${stem}-${n}`;
      const paths = [base + VARIANT_SUFFIX.full, base + VARIANT_SUFFIX.card, base + VARIANT_SUFFIX.thumb];
      const token = randomUUID();
      try {
        const [url] = await Promise.all([
          saveToStorage(variants.full, 'image/webp', paths[0], token),
          saveToStorage(variants.card, 'image/webp', paths[1], token),
          saveToStorage(variants.thumb, 'image/webp', paths[2], token),
        ]);
        return url;
      } catch (err) {
        // All three or none: a post must never point at a size that isn't there.
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[photos] could not store the sizes of ${base}, storing the original: ${msg}`);
        await removeQuietly(paths);
      }
    }
  }
  return saveToStorage(photo.body, photo.contentType, fallbackPath);
}
