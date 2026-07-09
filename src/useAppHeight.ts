import { useEffect, type RefObject } from 'react';

/**
 * Pins an element to the real visible viewport height.
 *
 * CSS `100vh` (and sometimes `100dvh`) can overshoot the visible area on
 * mobile Safari — the extra height hides the top of the element behind the
 * status bar and pushes the bottom behind the OS/app chrome. `window.innerHeight`
 * reports the actual visible height across browsers, so we apply it directly.
 * The element keeps its `h-dvh`/`h-screen` class as a pre-JS fallback.
 */
export function useAppHeight<T extends HTMLElement>(ref: RefObject<T | null>) {
  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (el) el.style.height = `${window.innerHeight}px`;
    };

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    // iOS Safari can auto-scroll the page by the address-bar's height right
    // after load/restore (as part of collapsing the toolbar). If that offset
    // gets locked in before we reset it, the app shell's top — including the
    // sticky header — ends up permanently hidden behind the status bar, since
    // locking document/body overflow below removes any way to scroll back.
    const resetAndLock = () => {
      window.scrollTo(0, 0);
      apply();
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    };

    resetAndLock();
    // iOS sometimes performs its toolbar-collapse scroll a frame after paint —
    // catch it before the user can notice.
    const raf = requestAnimationFrame(resetAndLock);

    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    // Reopening a backgrounded/bfcached tab can restore a stale scroll offset
    // and viewport size — recompute both when the page becomes visible again.
    window.addEventListener('pageshow', resetAndLock);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('pageshow', resetAndLock);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [ref]);
}
