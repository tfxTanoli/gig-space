import { useEffect } from 'react';
import { SITE_NAME, SITE_URL } from './slug';
import { DEFAULT_OG_IMAGE, type PageMeta } from './pages';

// Keeps a public page's head tags right during in-app navigation (GIG-77).
// Direct loads already get the same tags from the server (api/page.ts); this
// applies them when a visitor arrives by clicking through the app instead.

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useDocumentMeta(meta: PageMeta | null): void {
  const title = meta?.title;
  const description = meta?.description;
  const path = meta?.path;
  const index = meta?.index;

  useEffect(() => {
    if (!title || description === undefined || path === undefined) return;
    const url = `${SITE_URL}${path}`;
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', index ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,follow');
    upsertCanonical(url);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
    return () => {
      // Pages without their own tags (dashboards, sign-in) shouldn't inherit
      // this page's canonical or robots directive.
      document.title = SITE_NAME;
      document.head.querySelector('link[rel="canonical"]')?.remove();
      document.head.querySelector('meta[name="robots"]')?.remove();
    };
  }, [title, description, path, index]);
}
