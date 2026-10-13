import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/* ─── Fetching URLs we don't control ───────────────────────────────────────────
 * Listing generation downloads pages and images whose URLs come from business
 * websites' HTML (and from the admin's request). A URL pointing at a private or
 * internal address (localhost, 10.x, the cloud metadata service) must never be
 * requested, so each hop is checked before it is fetched: http(s) only, every
 * address the host resolves to must be public, and redirects are followed by
 * hand so a public URL can't bounce to a private one. Bodies are read with a
 * size cap, so a huge response is abandoned instead of being held in memory.
 */

function ipv4Blocked(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||   // carrier-grade NAT
    (a === 169 && b === 254) ||             // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||               // 192.0.0.0/24 + 192.0.2.0/24 docs
    (a === 198 && (b === 18 || b === 19)) ||// benchmarking
    a >= 224                                // multicast + reserved
  );
}

function ipv6Blocked(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  // IPv4-mapped (::ffff:a.b.c.d), which URL parsing rewrites as ::ffff:7f00:1.
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
    return ipv4Blocked(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);  // unique-local, link-local, multicast
}

export function addressBlocked(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4Blocked(ip);
  if (kind === 6) return ipv6Blocked(ip);
  return true;
}

/** Throws unless `raw` is an http(s) URL whose host resolves only to public addresses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`blocked scheme ${url.protocol}`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || /(^|\.)(localhost|internal|local)$/i.test(host)) throw new Error(`blocked host ${host}`);
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (addrs.length === 0 || addrs.some((a) => addressBlocked(a.address))) throw new Error(`blocked address for ${host}`);
  return url;
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs: number;
  maxRedirects?: number;
}

/**
 * fetch() for untrusted URLs: every hop is checked with assertPublicUrl and
 * the whole exchange shares one timeout. Read the body with readCapped().
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions): Promise<Response> {
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let current = raw;
  for (let hop = 0; hop <= (opts.maxRedirects ?? 5); hop++) {
    const url = await assertPublicUrl(current);
    const resp = await fetch(url, { signal, redirect: 'manual', headers: opts.headers });
    const location = resp.headers.get('location');
    if (resp.status >= 300 && resp.status < 400 && location) {
      await resp.body?.cancel();
      current = new URL(location, url).toString();
      continue;
    }
    return resp;
  }
  throw new Error('too many redirects');
}

/** The body, or null once it passes `maxBytes` (the rest is never downloaded). */
export async function readCapped(resp: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(resp.headers.get('content-length'));
  if (declared > maxBytes) { await resp.body?.cancel(); return null; }
  if (!resp.body) return Buffer.alloc(0);
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
