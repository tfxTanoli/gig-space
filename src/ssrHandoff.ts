import { useEffect } from 'react';

// Hands a page over from its server-rendered HTML to the React app (GIG-77).
//
// Public pages arrive with their content already in the HTML (api/page.ts,
// api/post-page.ts). Before React mounts, holdSsr() moves that content out of
// #root and keeps it on screen while the app boots hidden behind it. Each
// public page calls useSsrReady once it can show the same content, and the
// swap happens then — so nobody sees the boot spinner between the two.

const SSR_ID = 'ssr';
const PENDING_ATTR = 'data-ssr-pending';

// A page that never reports ready (an error, maintenance mode) must not leave
// the app hidden for good.
const FALLBACK_MS = 8000;

let held = false;
let released = true;

/** Whether this load started from server-rendered content still on screen. */
export const ssrHeld = () => held && !released;

/** Moves server-rendered content out of #root before React takes #root over. */
export function holdSsr(root: HTMLElement): void {
  const ssr = document.getElementById(SSR_ID);
  if (!ssr) return;
  root.before(ssr);
  root.setAttribute(PENDING_ATTR, '');
  held = true;
  released = false;
  window.setTimeout(releaseSsr, FALLBACK_MS);
}

/** Swaps the server-rendered content for the live app. Safe to call repeatedly. */
export function releaseSsr(): void {
  if (released) return;
  released = true;
  document.getElementById(SSR_ID)?.remove();
  document.getElementById('root')?.removeAttribute(PENDING_ATTR);
}

/** For public pages: call with true once the page shows its real content. */
export function useSsrReady(ready = true): void {
  useEffect(() => {
    if (ready) releaseSsr();
  }, [ready]);
}
