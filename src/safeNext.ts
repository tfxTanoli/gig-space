/**
 * The `?next=` return path after sign-in, or null if it isn't a path on this
 * site. Every page that honours `next` goes through here.
 *
 * A plain `startsWith('/')` check is an open redirect: browsers read `//host`
 * and `/\host` as another site, and URL parsing strips tabs and newlines, so
 * `/<tab>/host` becomes `//host`. React Router then falls back to a full-page
 * jump to that site. So: one leading slash, no second slash or backslash, no
 * control characters, and the resolved URL must stay on this origin.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !/^\/(?![/\\])/.test(raw)) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
