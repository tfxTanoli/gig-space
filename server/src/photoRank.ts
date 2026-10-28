/* ─── Which site photos lead a post ──────────────────────────────────────────────
 * Page order is a poor guide to a business's best photo: haulawayjunk.net leads
 * with a picture of its branded caps, and its real jobs (rooms and driveways
 * full of junk) follow as before/after collages. File names and sizes can't
 * tell those apart, so a vision model scores each downloaded photo for how well
 * it shows the work, and generation keeps the best, best first (GIG-74). The
 * same pass drops flyers, logos and merchandise that the byte-level checks in
 * sitePhotos.ts let through.
 *
 * Optional, like the AI titles: without GEMINI_API_KEY, or when scoring fails,
 * the photos keep their page order.
 */
import type { SitePhoto } from './sitePhotos';

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Inline images count toward Gemini's 20 MB request limit after base64 (+33%).
const PAYLOAD_BUDGET = 12_000_000;

// A post draws on up to 14 photos (sitePhotos.ts). They're scored a few per
// request, in parallel, so a large set is still scored in full, and a reply that
// loses count of its photos costs only its own group.
const PHOTOS_PER_REQUEST = 7;

export interface PhotoSubject {
  business: string;
  service: string;
  location: string;
}

const prompt = (s: PhotoSubject, count: number) =>
  `These ${count} photos, in order, come from the website of "${s.business}", ` +
  `${s.service ? `a ${s.service} business` : 'a local business'}${s.location ? ` in ${s.location}` : ''}. ` +
  'We are choosing which to show on its marketplace listing, best first. Score each photo ' +
  'from 0 to 10 for how well it shows a customer the kind of work this business does:\n' +
  '- 8 to 10: a clear photo of the actual work or its result, such as a finished job, a ' +
  'before/after comparison, or the crew or equipment on a job.\n' +
  '- 4 to 7: relevant but weaker, such as a company vehicle, a team photo, or a dark or ' +
  'partial view of the work.\n' +
  '- 1 to 3: only loosely related to the service.\n' +
  '- 0: not a photo of the work at all: a flyer, advert, coupon or other graphic with large ' +
  'text, a logo, merchandise such as hats or shirts, a screenshot, a map, or a portrait ' +
  'unrelated to the service.\n' +
  `Return exactly ${count} scores, in the order the photos were given.`;

/**
 * Splits photos (by index) into requests of at most PHOTOS_PER_REQUEST photos
 * and PAYLOAD_BUDGET bytes, in order. A photo over the budget on its own is
 * left out.
 */
export function requestGroups(sizes: number[]): number[][] {
  const groups: number[][] = [];
  let bytes = 0;
  sizes.forEach((size, i) => {
    if (size > PAYLOAD_BUDGET) return;
    const last = groups[groups.length - 1];
    if (last && last.length < PHOTOS_PER_REQUEST && bytes + size <= PAYLOAD_BUDGET) {
      last.push(i);
      bytes += size;
    } else {
      groups.push([i]);
      bytes = size;
    }
  });
  return groups;
}

/**
 * 0–10 per photo, best for showing the work highest. null for a photo whose
 * request failed or that was too large to send, or for the whole batch when
 * scoring isn't configured or every request failed.
 */
export async function scoreSitePhotos(
  photos: SitePhoto[],
  subject: PhotoSubject,
  timeoutMs = 15_000,
): Promise<(number | null)[] | null> {
  if (!GEMINI_KEY || photos.length === 0 || timeoutMs < 1000) return null;

  const groups = requestGroups(photos.map((p) => p.body.length));
  const results = await Promise.all(groups.map((g) => scoreGroup(g.map((i) => photos[i]), subject, timeoutMs)));
  if (results.every((r) => r === null)) return null;

  const out: (number | null)[] = photos.map(() => null);
  groups.forEach((g, k) => g.forEach((photo, j) => { out[photo] = results[k]?.[j] ?? null; }));
  console.log(`[photos] ${subject.business}: scores ${out.map((s) => s ?? '-').join(', ')}`);
  return out;
}

/** One request's scores, in order; null when it fails. */
async function scoreGroup(
  photos: SitePhoto[],
  subject: PhotoSubject,
  timeoutMs: number,
): Promise<(number | null)[] | null> {
  try {
    // Imported lazily so a deploy without the key never pays to load the SDK.
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt(subject, photos.length) },
          ...photos.map((p) => ({ inlineData: { mimeType: p.contentType, data: p.body.toString('base64') } })),
        ],
      }],
      config: {
        abortSignal: AbortSignal.timeout(timeoutMs),
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scores: {
              type: Type.ARRAY,
              description: 'One score from 0 to 10 per photo, in the order given.',
              items: { type: Type.NUMBER },
            },
          },
          required: ['scores'],
        },
      },
    });

    const scores = (JSON.parse(response.text ?? '') as { scores?: unknown }).scores;
    // A short or long array means the model lost track of which photo is
    // which, and a mismatched score is worse than page order.
    if (!Array.isArray(scores) || scores.length !== photos.length) {
      console.error(`[photos] ${subject.business}: ${Array.isArray(scores) ? scores.length : 'no'} scores for ${photos.length} photos, leaving them unscored`);
      return null;
    }
    return scores.map((v) => {
      const s = Number(v);
      return Number.isFinite(s) ? Math.min(10, Math.max(0, s)) : null;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[photos] scoring unavailable for ${subject.business} (${photos.length} photos), leaving them unscored: ${msg}`);
    return null;
  }
}
