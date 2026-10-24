// Shared by the server-rendered page functions (api/page.ts, api/post-page.ts)
// and the sitemap. Files under api/_lib are helpers, not routes.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { humanizeKey } from '../../src/seo/slug.js';
import { SITE_URL } from '../../src/seo/slug.js';
import type { CategoryLabels } from '../../src/seo/meta.js';

export type Query = Record<string, string | string[] | undefined>;
export interface Req { headers: Record<string, string | string[] | undefined>; query: Query; url?: string }
export interface Res {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
  redirect(status: number, url: string): void;
}

export const DB_URL = (process.env.VITE_FIREBASE_DATABASE_URL ?? '').replace(/\/$/, '');
export const PAGE_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
// A miss is usually temporary — a listing published seconds ago, or one whose
// address is still being assigned. Caching it as long as a real page would
// keep serving "not found" long after the listing goes live.
export const MISS_CACHE = 'public, max-age=0, s-maxage=30';

export const str = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

export async function fetchJson<T>(path: string, query = ''): Promise<T | null> {
  if (!DB_URL) return null;
  try {
    const r = await fetch(`${DB_URL}/${path}.json${query}`, { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/* ─── Categories ─────────────────────────────────────────────────────────── */

type LabelNode = Record<string, { label?: string; order?: number }>;
export interface Labels extends CategoryLabels {
  /** Categories in the app's menu order. */
  categories: { value: string; label: string }[];
}
let labelsCache: { value: { categories: LabelNode; subcategories: Record<string, LabelNode> }; expires: number } | null = null;

/** Category and subcategory names as the app shows them, falling back to a readable key. */
export async function loadLabels(): Promise<Labels> {
  const now = Date.now();
  if (!labelsCache || labelsCache.expires < now) {
    const [categories, subcategories] = await Promise.all([
      fetchJson<LabelNode>('categories'),
      fetchJson<Record<string, LabelNode>>('subcategories'),
    ]);
    labelsCache = { value: { categories: categories ?? {}, subcategories: subcategories ?? {} }, expires: now + 5 * 60_000 };
  }
  const { categories, subcategories } = labelsCache.value;
  return {
    category: (key) => categories[key]?.label ?? key,
    subcategory: (cat, key) => subcategories[cat]?.[key]?.label ?? humanizeKey(key),
    categories: Object.entries(categories)
      .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
      .map(([value, d]) => ({ value, label: d.label ?? value })),
  };
}

/* ─── Listings ───────────────────────────────────────────────────────────── */

export interface ServiceRow {
  id: string;
  status?: string;
  seoPath?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}
let servicesCache: { rows: ServiceRow[]; expires: number } | null = null;

/**
 * Every listing, newest first. The table is small (a few KB per listing) and
 * one read serves the search page, related listings and the sitemap; each
 * warm function instance keeps it for a minute.
 */
export async function loadServices(): Promise<ServiceRow[]> {
  const now = Date.now();
  if (servicesCache && servicesCache.expires > now) return servicesCache.rows;
  const data = await fetchJson<Record<string, Record<string, unknown> | null>>('services');
  if (!data) return servicesCache?.rows ?? [];
  const rows = Object.entries(data)
    .filter((e): e is [string, Record<string, unknown>] => Boolean(e[1]) && typeof e[1] === 'object')
    .map(([id, v]): ServiceRow => ({ ...v, id }))
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  servicesCache = { rows, expires: now + 60_000 };
  return rows;
}

/* ─── The SPA shell ──────────────────────────────────────────────────────── */

let shellCache: { origin: string; html: string; expires: number } | null = null;

export function requestOrigin(req: Req): string {
  const host = str(req.headers['x-forwarded-host'] ?? req.headers.host).split(',')[0].trim();
  return host ? `https://${host}` : SITE_URL;
}

const isShell = (html: string) => html.includes('</head>') && html.includes('id="root"');

/**
 * The built page shell carries the hashed asset URLs for this deployment.
 * vercel.json bundles dist/app.html into the page functions, so it is read
 * from disk — the same deployment's copy, no network hop, and it works on
 * protected preview deployments, where fetching our own URL is answered by the
 * login wall. Failing that, it is fetched from the deployment. The build names
 * it app.html (vite.config.ts), which keeps "/" free for the renderer;
 * index.html is the fallback for a deployment from before that.
 */
export async function loadShell(origin: string): Promise<string | null> {
  const now = Date.now();
  if (shellCache && shellCache.origin === origin && shellCache.expires > now) return shellCache.html;
  try {
    const html = await readFile(join(process.cwd(), 'dist', 'app.html'), 'utf8');
    if (isShell(html)) {
      // Never changes within a deployment.
      shellCache = { origin, html, expires: Number.POSITIVE_INFINITY };
      return html;
    }
  } catch {
    // Not bundled (local tooling, an older config) — fetch it instead.
  }
  for (const file of ['/app.html', '/index.html']) {
    try {
      const r = await fetch(`${origin}${file}`, { headers: { accept: 'text/html' } });
      if (!r.ok) continue;
      const html = await r.text();
      if (!isShell(html)) continue;
      shellCache = { origin, html, expires: now + 60_000 };
      return html;
    } catch {
      // try the next name
    }
  }
  return shellCache?.origin === origin ? shellCache.html : null;
}

export function injectHead(shell: string, head: string): string {
  // The shell carries site-wide defaults (description, canonical, OG, Twitter).
  // A rendered page supplies its own, so drop the defaults rather than emit
  // both — two og:title tags is worse than none.
  return shell
    .replace(/<!--seo-defaults-->[\s\S]*?<!--\/seo-defaults-->\s*/i, '')
    .replace(/<title>[^<]*<\/title>\s*/i, '')
    .replace('</head>', `    ${head}\n  </head>`);
}

/**
 * Puts the page's content into #root in place of the boot spinner. The app
 * takes it from there (src/ssrHandoff.ts). A shell without the markers is
 * returned unchanged: the page still works, it just boots the old way.
 */
export function injectBody(shell: string, html: string): string {
  return shell.replace(/<!--app-boot-->[\s\S]*?<!--\/app-boot-->/, `<div id="ssr">${html}</div>`);
}

export function sendHtml(res: Res, status: number, html: string, cache: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(html);
}
