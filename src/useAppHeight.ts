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
    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevScrollRestoration = history.scrollRestoration;

    // Stop the browser from re-applying the scroll offset it saved before the
    // tab was backgrounded/reloaded. It restores that offset *after* our reset
    // runs, which is one of the ways the header ends up under the status bar.
    // These screens lock scrolling anyway, so there is nothing to restore.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    const apply = () => {
      const el = ref.current;
      if (el) el.style.height = `${window.innerHeight}px`;
    };

    const lock = () => {
      html.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    };

    const unlock = () => {
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };

    // iOS Safari can auto-scroll the page by the address-bar's height right
    // after load/restore (as part of collapsing the toolbar). If that offset
    // gets locked in, the app shell's top — including the sticky header — ends
    // up permanently hidden behind the status bar, since the lock below removes
    // any way to scroll back.
    //
    // The unlock/lock dance matters: while overflow is hidden the document is
    // not scrollable, so scrollTo() silently does nothing. Every reset after
    // the first would be a no-op if we scrolled without unlocking first.
    const resetAndLock = () => {
      unlock();
      window.scrollTo(0, 0);
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      apply();
      lock();
    };

    // iOS performs its toolbar-collapse scroll asynchronously, and not always on
    // the same frame — retry across a few ticks rather than betting on one.
    const timers: number[] = [];
    let raf = 0;
    const resetSoon = () => {
      resetAndLock();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(resetAndLock);
      timers.forEach(clearTimeout);
      timers.length = 0;
      timers.push(
        window.setTimeout(resetAndLock, 100),
        window.setTimeout(resetAndLock, 300),
      );
    };

    // `pageshow` covers a fresh load and a bfcache restore, but NOT returning to
    // a tab that stayed alive in memory — closing and reopening the browser
    // usually takes that path, and only fires `visibilitychange` (and `focus`).
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resetSoon();
    };

    // The visual viewport is what iOS actually shifts when it shows/hides the
    // toolbar or the tab is restored — its `resize` fires *after* innerHeight has
    // settled, so re-pinning here catches the final value the timed retries above
    // can miss. `apply` alone (no scroll reset) keeps it cheap enough to run on
    // every viewport change.
    const vv = window.visualViewport;

    resetSoon();

    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('pageshow', resetSoon);
    window.addEventListener('focus', resetSoon);
    document.addEventListener('visibilitychange', onVisibility);
    vv?.addEventListener('resize', apply);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('pageshow', resetSoon);
      window.removeEventListener('focus', resetSoon);
      document.removeEventListener('visibilitychange', onVisibility);
      vv?.removeEventListener('resize', apply);
      if ('scrollRestoration' in history) history.scrollRestoration = prevScrollRestoration;
      unlock();
    };
  }, [ref]);
}
