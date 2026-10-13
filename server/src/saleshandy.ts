/* ─── Saleshandy outreach (GIG-76) ──────────────────────────────────────────────
 * Two calls, both from the server so the API key never reaches a browser:
 *  - addToOutreach(): when a generated post goes live, the business enters
 *    Marcus's cold-email sequence with the five values his templates use.
 *  - leaveOutreach(): when someone creates a Gigspace account, any prospect
 *    with that email is marked unsubscribed in the sequence, which stops the
 *    remaining emails and keeps them out of future sequences.
 *
 * Marcus owns the sequence and its fields in Saleshandy, so they are looked up
 * by name rather than hard-coded, and creating a new sequence only needs
 * SALESHANDY_SEQUENCE_NAME changed. Setting SALESHANDY_SEQUENCE_ID pins the
 * sequence instead, so renaming it in Saleshandy can't break anything.
 * Unsubscribing needs only the sequence, never the field names, so a renamed
 * field can at worst stop new prospects being added — never stop a signed-up
 * business being taken out. Lookups are cached for the life of the instance.
 *
 * Every call is best-effort and time-limited. Outreach must never block or
 * slow down a publish or a signup, so failures are logged and swallowed.
 */

const BASE = 'https://open-api.saleshandy.com/v1';
const API_KEY = process.env.SALESHANDY_API_KEY || '';
const SEQUENCE_ID = (process.env.SALESHANDY_SEQUENCE_ID || '').trim();
const SEQUENCE_NAME = process.env.SALESHANDY_SEQUENCE_NAME || 'Gigspace — Local Service Pros — Claim Your Post';
const CALL_TIMEOUT_MS = 6_000;

// The labels Marcus gave the fields his templates reference ({{Company}} etc.).
// Email, Company and City are Saleshandy's built-in fields; the other two are
// custom fields he created.
const FIELD_LABELS = {
  email: 'Email',
  company: 'Company',
  city: 'City',
  subcategory: 'Subcategory',
  postUrl: 'Post URL',
} as const;
type FieldKey = keyof typeof FIELD_LABELS;

export function outreachConfigured(): boolean {
  return !!API_KEY;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'x-api-key': API_KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    // A hung Saleshandy must not hold up a signup or the welcome email.
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Saleshandy ${method} ${path} → ${resp.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Caches a lookup for the life of the instance, but never caches a failure. */
function cached<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p) {
      p = load();
      p.catch(() => { p = null; });
    }
    return p;
  };
}

/** The sequence: the pinned id, or the one whose name matches. */
const sequenceId = cached(async (): Promise<string> => {
  if (SEQUENCE_ID) return SEQUENCE_ID;
  const seqs = await call<{ payload: { id: string; title: string }[] }>('GET', '/sequences');
  // Compare loosely: the em dashes in the name are easy to retype as hyphens.
  const norm = (s: string) => s.toLowerCase().replace(/[‒-―-]/g, '-').replace(/\s+/g, ' ').trim();
  const seq = seqs.payload.find((s) => norm(s.title) === norm(SEQUENCE_NAME));
  if (!seq) throw new Error(`Saleshandy sequence "${SEQUENCE_NAME}" not found`);
  return seq.id;
});

/** The sequence's first step, which new prospects are imported into. */
const firstStepId = cached(async (): Promise<string> => {
  const seq = await sequenceId();
  const steps = await call<{ payload: { id: string; number: number }[] }>('GET', `/sequences/${seq}/steps`);
  const first = [...steps.payload].sort((a, b) => a.number - b.number)[0];
  if (!first) throw new Error(`Saleshandy sequence ${seq} has no steps`);
  return first.id;
});

/** Field ids for the five values the templates use, found by label. */
const fieldIds = cached(async (): Promise<Record<FieldKey, string>> => {
  const fields = await call<{ payload: { id: string; label: string }[] }>('GET', '/fields?systemFields=true');
  const byLabel = new Map(fields.payload.map((f) => [f.label.trim().toLowerCase(), f.id]));
  const ids = {} as Record<FieldKey, string>;
  for (const [key, label] of Object.entries(FIELD_LABELS) as [FieldKey, string][]) {
    const id = byLabel.get(label.toLowerCase());
    if (!id) throw new Error(`Saleshandy field "${label}" not found`);
    ids[key] = id;
  }
  return ids;
});

export interface OutreachProspect {
  email: string;
  company: string;
  city: string;
  subcategory: string;
  postUrl: string;
}

/**
 * Adds a business to the first step of the sequence. A prospect Saleshandy
 * already has is left as it is (noUpdate), so re-publishing a post never
 * restarts someone's emails or revives an unsubscribed prospect.
 * Returns Saleshandy's per-prospect status code (10000/10200 = added).
 */
export async function addToOutreach(p: OutreachProspect): Promise<{ status: number | null }> {
  const [stepId, ids] = await Promise.all([firstStepId(), fieldIds()]);
  const values: Record<FieldKey, string> = {
    email: p.email.trim(),
    company: p.company,
    city: p.city,
    subcategory: p.subcategory,
    postUrl: p.postUrl,
  };
  const res = await call<{ payload?: { email?: string; status?: number }[] }>('POST', '/prospects/import', {
    prospectList: [{ fields: (Object.keys(values) as FieldKey[]).filter((k) => values[k]).map((k) => ({ id: ids[k], value: values[k] })) }],
    stepId,
    verifyProspects: false,
    conflictAction: 'noUpdate',
  });
  return { status: res.payload?.[0]?.status ?? null };
}

/**
 * Marks every prospect with this email as unsubscribed in the sequence.
 * Saleshandy's search matches names too, so results are filtered to an exact
 * email match. Returns how many prospects were updated.
 */
export async function unsubscribeFromOutreach(email: string): Promise<number> {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return 0;
  const [seq, found] = await Promise.all([
    sequenceId(),
    call<{ payload?: { id: string; email?: string }[] }>('GET', `/prospects?search=${encodeURIComponent(wanted)}&pageSize=20`),
  ]);
  const ids = (found.payload ?? []).filter((p) => (p.email ?? '').trim().toLowerCase() === wanted).map((p) => p.id);
  if (ids.length === 0) return 0;
  await call('PATCH', '/prospects/status', {
    prospectAndSequenceIds: ids.map((prospectId) => ({ prospectId, sequenceId: seq })),
    status: 'unsubscribed',
  });
  return ids.length;
}

/**
 * A new Gigspace account leaves the cold-email sequence. Called wherever an
 * account comes into being (email signup, first sign-in, admin-created users)
 * and again at profile setup as a backstop; repeating it is harmless. Never
 * throws: the reason is logged so a broken setup shows up in the server logs.
 */
export async function leaveOutreach(email: string | null | undefined, context: string): Promise<void> {
  if (!outreachConfigured() || !email) return;
  try {
    const n = await unsubscribeFromOutreach(email);
    if (n) console.log(`[outreach] ${email} has an account (${context}); unsubscribed ${n} prospect(s)`);
  } catch (e) {
    console.error(`[outreach] unsubscribe FAILED for ${email} (${context}):`, e instanceof Error ? e.message : e);
  }
}
