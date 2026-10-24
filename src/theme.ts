import { useSyncExternalStore } from 'react';

/* ─── Light / dark theme (GIG-73) ──────────────────────────────────────────────
 * The site is styled dark. Light mode is a set of CSS variable overrides under
 * html.light (see index.css), so switching is one class on <html> — no React
 * re-render of every component.
 *
 * Choice order: the user's own pick (remembered in localStorage) wins; with no
 * pick, the device setting decides and is followed live if it changes. The
 * same logic runs as an inline script in index.html before first paint, so a
 * light-mode visitor never sees a flash of dark.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'gigspace-theme';
const THEME_COLOR: Record<Theme, string> = { dark: '#0f172a', light: '#ffffff' };

function storedChoice(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function deviceTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

let current: Theme =
  typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark';
const listeners = new Set<() => void>();

function apply(theme: Theme): void {
  const root = document.documentElement;
  // Every colour changes at once; without this, elements with
  // transition-colors fade from their old colour and flash (index.css).
  root.classList.add('theme-switching');
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  current = theme;
  listeners.forEach((l) => l());
}

/** Explicit choice from the toggle: applied now and remembered. */
export function setTheme(theme: Theme): void {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* private mode: still applies for this visit */ }
  apply(theme);
}

export function toggleTheme(): void {
  setTheme(current === 'light' ? 'dark' : 'light');
}

// With no explicit choice, follow the device as it changes (e.g. at sunset).
if (typeof window !== 'undefined') {
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (!storedChoice()) apply(deviceTheme());
  });
}

/** The active theme; re-renders the caller when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => current,
    () => 'dark',
  );
}
