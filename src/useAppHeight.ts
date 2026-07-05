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
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, [ref]);
}
