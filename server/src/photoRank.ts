/* ─── Which site photos lead a post ──────────────────────────────────────────────
 * Page order is a poor guide to a business's best photo: haulawayjunk.net leads
 * with a picture of its branded caps, and its real jobs (rooms and driveways
 * full of junk) follow as before/after collages. File names and sizes can't
 * tell those apart, so a vision model scores each downloaded photo for how well
 * it shows the work, and generation keeps the best, best first (GIG-74). The
 * same pass drops flyers, logos and merchandise that the byte-level checks in
 * sitePhotos.ts let through.
 *
 * Optional, like the AI titles: without GEMINI_API_KEY, or on any failure, the
 * photos keep their page order.
 */
import type { SitePhoto } from './sitePhotos';

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Inline images count toward Gemini's 20 MB request limit after base64 (+33%).
const PAYLOAD_BUDGET = 12_000_000;

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
 * 0–10 per photo, best for showing the work highest. null for a photo left
 * out to stay under the request size limit, or for the whole batch when
 * scoring isn't configured or fails.
 */
export async function scoreSitePhotos(
  photos: SitePhoto[],
  subject: PhotoSubject,
  timeoutMs = 15_000,
): Promise<(number | null)[] | null> {
  if (!GEMINI_KEY || photos.length === 0 || timeoutMs < 1000) return null;

  const sent: number[] = [];
  let bytes = 0;
  photos.forEach((p, i) => {
    if (bytes + p.body.length > PAYLOAD_BUDGET) return;
    bytes += p.body.length;
    sent.push(i);
  });
  if (sent.length === 0) return null;

  try {
    // Imported lazily so a deploy without the key never pays to load the SDK.
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt(subject, sent.length) },
          ...sent.map((i) => ({ inlineData: { mimeType: photos[i].contentType, data: photos[i].body.toString('base64') } })),
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
    if (!Array.isArray(scores) || scores.length !== sent.length) return null;
    const out: (number | null)[] = photos.map(() => null);
    sent.forEach((photo, k) => {
      const s = Number(scores[k]);
      out[photo] = Number.isFinite(s) ? Math.min(10, Math.max(0, s)) : null;
    });
    console.log(`[photos] ${subject.business}: scores ${out.map((s) => s ?? '-').join(', ')}`);
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[photos] scoring unavailable for ${subject.business}, keeping page order: ${msg}`);
    return null;
  }
}
