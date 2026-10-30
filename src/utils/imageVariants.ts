// Photos on generated posts are stored in three sizes (server/src/photoVariants.ts):
//
//   <name>-1200w.webp   the photo itself, for the gallery
//   <name>-640w.webp    a 4:3 version for search and listing cards
//   <name>-240w.webp    a 4:3 version for the gallery's thumbnail strip
//
// The three share one download token, so the URL stored on the post — the
// gallery size — gives the other two by swapping the suffix. Anything else (older
// posts, photos a seller uploaded) has no smaller versions and is returned
// untouched. Keep the suffixes in step with the server.
//
// This file is also imported by the server-rendered pages (src/seo/render.ts), so
// it must stay free of browser-only code.

const GALLERY_SIZE = /(\/o\/listingImages%2F[^?]*)-1200w\.webp(?=\?|$)/;

const SUFFIX = {
  card: '-640w.webp',
  thumb: '-240w.webp',
} as const;

export type ImageSize = keyof typeof SUFFIX;

/** Whether `url` is a gallery-size photo that has card and thumbnail versions. */
export const hasSizes = (url: string): boolean => GALLERY_SIZE.test(url);

/** The card or thumbnail version of a photo, or the photo itself when it has none. */
export function imageSize(url: string, size: ImageSize): string {
  return url.replace(GALLERY_SIZE, `$1${SUFFIX[size]}`);
}

export const cardImage = (url: string): string => imageSize(url, 'card');
export const thumbImage = (url: string): string => imageSize(url, 'thumb');
