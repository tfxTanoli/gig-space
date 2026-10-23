import { useEffect, useState } from 'react';

/**
 * Whether the page has scrolled past `threshold` px. The landing pages' fixed
 * header is transparent over the hero and takes a solid background once
 * content scrolls under it.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}
