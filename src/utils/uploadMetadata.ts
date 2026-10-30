/**
 * Photos and videos are uploaded under a name that is never reused, so a browser
 * can keep one for a year without asking again. Without this Storage serves them
 * as `private, max-age=0`, and every visit re-checks every file.
 */
export const LONG_CACHE = 'public, max-age=31536000, immutable';
