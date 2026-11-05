// The real search and generate endpoints, with Google's answer stubbed, run on a
// copy of the situation in Marcus's screenshots: a Miami Beach search that also
// returns Miami, and one business listed twice.
import { test, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const adminProto = Object.getPrototypeOf(require('firebase-admin'));

type Controller = typeof import('../src/controllers/listings.controller');
let controller: Controller;

// `.invalid` never resolves, so the contact-scraping step fails fast and quietly.
const comp = (city: string, state: [string, string]) => [
  { longText: city, shortText: city, types: ['locality', 'political'] },
  { longText: state[0], shortText: state[1], types: ['administrative_area_level_1', 'political'] },
  { longText: 'United States', shortText: 'US', types: ['country', 'political'] },
];
const FL: [string, string] = ['Florida', 'FL'];
const place = (id: string, name: string, site: string, city: string, reviews = 5) => ({
  id, displayName: { text: name }, formattedAddress: `1 Main St, ${city}, FL, USA`, websiteUri: site,
  rating: 4.5, userRatingCount: reviews, primaryTypeDisplayName: { text: 'Landscaper' },
  addressComponents: comp(city, FL), location: { latitude: 25.7, longitude: -80.1 },
});

const GOOGLE_RESULTS = [
  place('g-fernando-1', 'Fernando Wong Outdoor Living Design', 'https://fernandowongold.invalid', 'Miami Beach', 3),
  place('g-chop', 'Chop Chop Tree', 'https://treeservice.invalid', 'Miami Beach', 2),
  place('g-fernando-2', 'Fernando Wong Outdoor Living Design', 'https://www.fernandowongold.invalid/', 'Miami Beach', 9),
  place('g-forever', 'ForeverLawn South Beach', 'https://foreverlawn.invalid/southbeach', 'Miami Beach', 5),
  place('g-as4less', 'AS4Less Landscaping', 'https://as4less-landscaping.invalid', 'Miami', 57),
  place('g-gan', 'Gan Eden Landscape', 'https://ganedenlandscape.invalid', 'Miami Beach', 3),
  place('g-nosite', 'No Website Gardens', '', 'Miami Beach', 1),
  place('g-gardens', 'Miami Gardens Lawn Co', 'https://gardenslawn.invalid', 'Miami Gardens', 4),
];

let data: Record<string, unknown>;
let realDatabase: PropertyDescriptor | undefined;
let realFetch: typeof fetch;

function fakeDatabase() {
  const read = (path: string): unknown => path.split('/').filter(Boolean).reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), data);
  return { ref: (path: string) => ({ get: async () => { const v = read(path); return { exists: () => v != null, val: () => v ?? null }; } }) };
}

before(async () => {
  process.env.GOOGLE_PLACES_API_KEY = 'test-key'; // read when the controller is loaded
  controller = await import('../src/controllers/listings.controller');
});
beforeEach(() => {
  data = { services: {} };
  realDatabase = Object.getOwnPropertyDescriptor(adminProto, 'database');
  Object.defineProperty(adminProto, 'database', { get: () => fakeDatabase, configurable: true });
  realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('places.googleapis.com')) {
      return new Response(JSON.stringify({ places: GOOGLE_RESULTS }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(input, init);
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realDatabase) Object.defineProperty(adminProto, 'database', realDatabase);
});

function call<T>(handler: (req: never, res: never) => Promise<void>, body: Record<string, unknown>) {
  const out: { status: number; body: T | undefined } = { status: 200, body: undefined };
  const res = { status(c: number) { out.status = c; return res; }, json(b: T) { out.body = b; return res; } };
  return handler({ body } as never, res as never).then(() => out);
}

type SearchResult = { businesses: { placeId: string; name: string; reviewCount: number; alreadyGenerated: { id: string; status: string } | null }[]; hiddenNearby: number; duplicatesRemoved: number };
const search = (body: Record<string, unknown>) => call<SearchResult>(controller.searchListings as never, { keyword: 'landscaping', ...body });

test("a Miami Beach search offers only Miami Beach, and says how many were left out", async () => {
  const r = await search({ city: 'Miami Beach, Florida' });
  assert.equal(r.status, 200);
  const names = r.body!.businesses.map((b) => b.name);
  assert.ok(!names.includes('AS4Less Landscaping'), 'Miami is another city');
  assert.ok(!names.includes('Miami Gardens Lawn Co'), 'and so is Miami Gardens');
  assert.ok(names.includes('ForeverLawn South Beach') && names.includes('Chop Chop Tree') && names.includes('Gan Eden Landscape'));
  assert.equal(r.body!.hiddenNearby, 2);
});

test('a business listed twice by Google is offered once, as its better-reviewed profile', async () => {
  const r = await search({ city: 'Miami Beach, Florida' });
  const fernando = r.body!.businesses.filter((b) => b.name.startsWith('Fernando Wong'));
  assert.equal(fernando.length, 1);
  assert.equal(fernando[0].placeId, 'g-fernando-2');
  assert.equal(r.body!.duplicatesRemoved, 1);
});

test('a business without a website is still not offered', async () => {
  const r = await search({ city: 'Miami Beach, Florida' });
  assert.ok(!r.body!.businesses.some((b) => b.name === 'No Website Gardens'));
});

test('the admin can include nearby cities, and the duplicate is still removed', async () => {
  const r = await search({ city: 'Miami Beach, Florida', includeNearby: true });
  const names = r.body!.businesses.map((b) => b.name);
  assert.ok(names.includes('AS4Less Landscaping') && names.includes('Miami Gardens Lawn Co'));
  assert.equal(r.body!.hiddenNearby, 0);
  assert.equal(names.filter((n) => n.startsWith('Fernando Wong')).length, 1);
});

test('only a literal true includes nearby cities', async () => {
  for (const includeNearby of ['true', 1, 'yes', null]) {
    const r = await search({ city: 'Miami Beach, Florida', includeNearby });
    assert.ok(!r.body!.businesses.some((b) => b.name === 'AS4Less Landscaping'), JSON.stringify(includeNearby));
  }
});

test('businesses that already have a post are marked, whichever way they are recognised', async () => {
  data = {
    services: {
      '-Opost1': { placeId: 'g-chop', sellerName: 'Chop Chop Tree', website: 'https://treeservice.invalid', status: 'active' },
      // the same business under a different Google profile
      '-Opost2': { placeId: 'older-profile', sellerName: 'Gan Eden Landscape', website: 'https://www.ganedenlandscape.invalid/', status: 'draft' },
      // a deleted post no longer counts
      '-Opost3': { placeId: 'g-forever', sellerName: 'ForeverLawn South Beach', website: 'https://foreverlawn.invalid/southbeach', status: 'deleted' },
    },
  };
  const r = await search({ city: 'Miami Beach, Florida' });
  const by = Object.fromEntries(r.body!.businesses.map((b) => [b.name, b.alreadyGenerated]));
  assert.equal(by['Chop Chop Tree']?.id, '-Opost1');
  assert.equal(by['Gan Eden Landscape']?.id, '-Opost2');
  assert.equal(by['Gan Eden Landscape']?.status, 'draft');
  assert.equal(by['ForeverLawn South Beach'], null, 'deleted');
  assert.equal(by['Fernando Wong Outdoor Living Design'], null);
});

test('if the existing posts cannot be read, the search still works', async () => {
  Object.defineProperty(adminProto, 'database', { get: () => () => ({ ref: () => ({ get: async () => { throw new Error('down'); } }) }), configurable: true });
  const r = await search({ city: 'Miami Beach, Florida' });
  assert.equal(r.status, 200);
  assert.ok(r.body!.businesses.length > 0);
  assert.ok(r.body!.businesses.every((b) => b.alreadyGenerated === null));
});

test('a search with no keyword or city is still refused', async () => {
  assert.equal((await call(controller.searchListings as never, { keyword: '', city: 'Miami Beach' })).status, 400);
  assert.equal((await call(controller.searchListings as never, { keyword: 'x', city: '' })).status, 400);
});

// ─── Generate: a business is never given a second post ─────────────────────────

type GenResult = { created: unknown[]; count: number; skipped?: { name: string; reason: string }[] };
const generate = (businesses: unknown[]) => call<GenResult>(controller.generateListings as never, { category: 'home_garden', subcategory: 'landscaping', language: 'English', businesses });

test('selecting only businesses that already have a post creates nothing and says why', async () => {
  data = { services: { '-Opost1': { placeId: 'g-chop', sellerName: 'Chop Chop Tree', website: 'https://treeservice.invalid', status: 'active' } } };
  const r = await generate([
    { placeId: 'g-chop', name: 'Chop Chop Tree', website: 'https://treeservice.invalid' },
    { placeId: 'g-chop-b', name: 'Chop Chop Tree', website: 'https://www.treeservice.invalid/' }, // same business, other profile
  ]);
  assert.equal(r.status, 200);
  assert.equal(r.body!.count, 0);
  assert.deepEqual(r.body!.skipped?.map((s) => s.reason), ['it already has a post', 'it already has a post']);
});

test('the same business selected twice is not generated twice', async () => {
  // Nothing is generated here (everything is skipped), so no storage or AI is touched.
  data = { services: { '-Opost1': { placeId: 'g-a', sellerName: 'A Co', website: 'https://a.invalid', status: 'active' } } };
  const r = await generate([
    { placeId: 'g-a', name: 'A Co', website: 'https://a.invalid' },
    { placeId: 'g-a', name: 'A Co', website: 'https://a.invalid' },
  ]);
  assert.equal(r.body!.count, 0);
  assert.equal(r.body!.skipped?.length, 2);
});

test('the batch limit still applies', async () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ placeId: `p${i}`, name: `B${i}`, website: `https://b${i}.invalid` }));
  assert.equal((await generate(six)).status, 400);
  assert.equal((await generate([])).status, 400);
});
