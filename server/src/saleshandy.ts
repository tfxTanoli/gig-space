/* ─── Saleshandy outreach (GIG-76) ──────────────────────────────────────────────
 * Two calls, both from the server so the API key never reaches a browser:
 *  - addToOutreach(): when a generated post goes live, the business enters
 *    Marcus's cold-email sequence with the five values his templates use.
 *  - unsubscribeFromOutreach(): when someone creates a Gigspace account, any
 *    prospect with that email is marked unsubscribed in the sequence, which
 *    stops the remaining emails and keeps them out of future sequences.
 *
 * Marcus owns the sequence and its fields in Saleshandy, so they are looked up
 * by name rather than hard-coded: renaming nothing breaks nothing, and creating
 * a new sequence only needs SALESHANDY_SEQUENCE_NAME changed. Lookups are cached
 * for the life of the function instance.
 *
 * Every call is best-effort. Outreach must never block a publish or a signup,
 * so callers log failures and carry on.
 */

const BASE = 'https://open-api.saleshandy.com/v1';
const API_KEY = process.env.SALESHANDY_API_KEY || '';
const SEQUENCE_NAME = process.env.SALESHANDY_SEQUENCE_NAME || 'Gigspace — Local Service Pros — Claim Your Post';

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
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Saleshandy ${method} ${path} → ${resp.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

interface Target { sequenceId: string; firstStepId: string; fieldIds: Record<FieldKey, string> }
let target: Promise<Target> | null = null;

/** The sequence, its first step and the field ids, resolved once per instance. */
function resolveTarget(): Promise<Target> {
  if (!target) {
    target = (async () => {
      const seqs = await call<{ payload: { id: string; title: string }[] }>('GET', '/sequences');
      // Compare loosely: the em dashes in the name are easy to retype as hyphens.
      const norm = (s: string) => s.toLowerCase().replace(/[‒-―-]/g, '-').replace(/\s+/g, ' ').trim();
      const seq = seqs.payload.find((s) => norm(s.title) === norm(SEQUENCE_NAME));
      if (!seq) throw new Error(`Saleshandy sequence "${SEQUENCE_NAME}" not found`);

      const steps = await call<{ payload: { id: string; number: number }[] }>('GET', `/sequences/${seq.id}/steps`);
      const first = [...steps.payload].sort((a, b) => a.number - b.number)[0];
      if (!first) throw new Error(`Saleshandy sequence "${SEQUENCE_NAME}" has no steps`);

      const fields = await call<{ payload: { id: string; label: string }[] }>('GET', '/fields?systemFields=true');
      const byLabel = new Map(fields.payload.map((f) => [f.label.trim().toLowerCase(), f.id]));
      const fieldIds = {} as Record<FieldKey, string>;
      for (const [key, label] of Object.entries(FIELD_LABELS) as [FieldKey, string][]) {
        const id = byLabel.get(label.toLowerCase());
        if (!id) throw new Error(`Saleshandy field "${label}" not found`);
        fieldIds[key] = id;
      }
      return { sequenceId: seq.id, firstStepId: first.id, fieldIds };
    })();
    // Don't cache a failure — the next call should retry the lookup.
    target.catch(() => { target = null; });
  }
  return target;
}

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
  const t = await resolveTarget();
  const values: Record<FieldKey, string> = {
    email: p.email.trim(),
    company: p.company,
    city: p.city,
    subcategory: p.subcategory,
    postUrl: p.postUrl,
  };
  const res = await call<{ payload?: { email?: string; status?: number }[] }>('POST', '/prospects/import', {
    prospectList: [{ fields: (Object.keys(values) as FieldKey[]).filter((k) => values[k]).map((k) => ({ id: t.fieldIds[k], value: values[k] })) }],
    stepId: t.firstStepId,
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
  const t = await resolveTarget();
  const found = await call<{ payload?: { id: string; email?: string }[] }>(
    'GET', `/prospects?search=${encodeURIComponent(wanted)}&pageSize=20`,
  );
  const ids = (found.payload ?? []).filter((p) => (p.email ?? '').trim().toLowerCase() === wanted).map((p) => p.id);
  if (ids.length === 0) return 0;
  await call('PATCH', '/prospects/status', {
    prospectAndSequenceIds: ids.map((prospectId) => ({ prospectId, sequenceId: t.sequenceId })),
    status: 'unsubscribed',
  });
  return ids.length;
}
