// The three endpoints, run for real against an in-memory database and bucket.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pruneServiceMedia, purgeOwnPostMedia, tidyMedia } from '../src/controllers/media.controller';
import { downloadUrl, useBucketForTests } from '../src/storage';
import { FakeBucket } from './fakeBucket';

const require = createRequire(import.meta.url);
// `database` is a getter on the namespace's prototype, so that is where the
// stand-in has to go for the controller to see it.
const adminProto = Object.getPrototypeOf(require('firebase-admin'));

const POST = '-OzTestPostAAAAAAA01';
const OTHER = '-OzTestPostBBBBBBB02';
const OWNER = 'ownerUid0000000000000000001';
const STRANGER = 'strangerUid00000000000000002';
const ADMIN = 'adminUid00000000000000000003';
const url = (path: string) => downloadUrl('test-bucket', path, 'tok');
const old = () => Date.now() - 3 * 24 * 3_600_000;

let bucket: FakeBucket;
let data: Record<string, unknown>;
let realDatabase: PropertyDescriptor | undefined;

function fakeDatabase() {
  const read = (path: string): unknown => path.split('/').filter(Boolean).reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), data);
  return { ref: (path: string) => ({ get: async () => { const v = read(path); return { exists: () => v !== undefined && v !== null, val: () => v ?? null }; } }) };
}

beforeEach(() => {
  bucket = new FakeBucket();
  useBucketForTests(bucket.asBucket());
  data = {};
  realDatabase = Object.getOwnPropertyDescriptor(adminProto, 'database');
  Object.defineProperty(adminProto, 'database', { get: () => fakeDatabase, configurable: true });
});
afterEach(() => {
  useBucketForTests(null);
  if (realDatabase) Object.defineProperty(adminProto, 'database', realDatabase);
});

function call<T>(handler: (req: never, res: never) => Promise<void>, req: Record<string, unknown>) {
  const out: { status: number; body: T | undefined } = { status: 200, body: undefined };
  const res = {
    status(code: number) { out.status = code; return res; },
    json(body: T) { out.body = body; return res; },
  };
  return handler(req as never, res as never).then(() => out);
}

function seedPost(id: string) {
  for (const s of ['1200w', '640w', '240w']) bucket.seed(`listingImages/${id}/stem-1-${s}.webp`, { createdAt: old() });
  bucket.seed(`listingLogos/${id}.png`, { createdAt: old() });
}

// ─── A seller deleting their own post ──────────────────────────────────────────

test("a seller can clear their own post's files", async () => {
  data = { services: { [POST]: { sellerId: OWNER, images: [url(`serviceImages/${OWNER}/a.jpg`)] } } };
  bucket.seed(`serviceImages/${OWNER}/a.jpg`);
  bucket.seed(`serviceImages/${OWNER}/keep.jpg`);
  const r = await call<{ removed: number }>(purgeOwnPostMedia, { params: { id: POST }, uid: OWNER });
  assert.equal(r.status, 200);
  assert.equal(r.body?.removed, 1);
  assert.deepEqual([...bucket.objects.keys()], [`serviceImages/${OWNER}/keep.jpg`]);
});

test("nobody else can clear a seller's post", async () => {
  data = { services: { [POST]: { sellerId: OWNER, images: [] } }, users: { [STRANGER]: { role: 'seller' } } };
  seedPost(POST);
  bucket.seed(`serviceImages/${OWNER}/a.jpg`);
  const before = bucket.objects.size;
  const r = await call(purgeOwnPostMedia, { params: { id: POST }, uid: STRANGER });
  assert.equal(r.status, 403);
  assert.equal(bucket.objects.size, before, 'nothing was removed');
});

test('a post with no owner yet (an unclaimed listing) cannot be cleared by an ordinary user', async () => {
  data = { services: { [POST]: { sellerId: '', images: [] } } };
  seedPost(POST);
  const before = bucket.objects.size;
  for (const uid of [STRANGER, '', undefined]) {
    const r = await call(purgeOwnPostMedia, { params: { id: POST }, uid });
    assert.equal(r.status, 403, `uid ${JSON.stringify(uid)}`);
  }
  assert.equal(bucket.objects.size, before);
});

test('an admin can clear any post', async () => {
  data = { services: { [POST]: { sellerId: '', images: [] } }, users: { [ADMIN]: { role: 'admin' } } };
  seedPost(POST);
  const r = await call<{ removed: number }>(purgeOwnPostMedia, { params: { id: POST }, uid: ADMIN });
  assert.equal(r.status, 200);
  assert.equal(r.body?.removed, 4);
  assert.equal(bucket.objects.size, 0);
});

test('clearing a post that does not exist is a 404 and removes nothing', async () => {
  data = { services: {} };
  seedPost(POST);
  const r = await call(purgeOwnPostMedia, { params: { id: POST }, uid: OWNER });
  assert.equal(r.status, 404);
  assert.equal(bucket.objects.size, 4);
});

// ─── Pruning after an admin edit ───────────────────────────────────────────────

test('pruning removes what the saved post no longer uses', async () => {
  data = { services: { [POST]: { sellerId: '', images: [url(`listingImages/${POST}/stem-1-1200w.webp`)] } } };
  seedPost(POST);
  bucket.seed(`listingImages/${POST}/stem-2-1200w.webp`, { createdAt: old() });
  bucket.seed(`listingImages/${POST}/stem-2-640w.webp`, { createdAt: old() });
  bucket.seed(`listingImages/${POST}/stem-2-240w.webp`, { createdAt: old() });
  const r = await call<{ removed: number }>(pruneServiceMedia, { params: { id: POST } });
  assert.equal(r.status, 200);
  assert.equal(r.body?.removed, 4, 'photo 2 in three sizes, plus the logo no longer referenced');
  assert.ok(bucket.objects.has(`listingImages/${POST}/stem-1-1200w.webp`));
  assert.ok(bucket.objects.has(`listingImages/${POST}/stem-1-640w.webp`));
  assert.ok(bucket.objects.has(`listingImages/${POST}/stem-1-240w.webp`));
});

test('pruning a missing post is a 404', async () => {
  data = { services: {} };
  assert.equal((await call(pruneServiceMedia, { params: { id: POST } })).status, 404);
});

// ─── Tidy storage ──────────────────────────────────────────────────────────────

test('tidy reports first and only removes when asked', async () => {
  data = { services: { [POST]: { sellerId: '' } } };
  seedPost(POST);
  seedPost(OTHER);
  const dry = await call<{ orphans: { files: number; removed: number } }>(tidyMedia, { body: {} });
  assert.equal(dry.status, 200);
  assert.equal(dry.body?.orphans.files, 4);
  assert.equal(dry.body?.orphans.removed, 0);
  assert.equal(bucket.objects.size, 8);

  // Anything other than a literal `true` is not a request to remove.
  for (const apply of ['true', 1, 'yes', null]) {
    await call(tidyMedia, { body: { apply } });
    assert.equal(bucket.objects.size, 8, `apply=${JSON.stringify(apply)}`);
  }

  const done = await call<{ orphans: { removed: number } }>(tidyMedia, { body: { apply: true } });
  assert.equal(done.body?.orphans.removed, 4);
  assert.equal(bucket.objects.size, 4);
  assert.ok(bucket.objects.has(`listingLogos/${POST}.png`), 'the live post keeps its files');
});

test('tidy refuses, and removes nothing, when no posts can be read', async () => {
  data = {};
  seedPost(OTHER);
  const r = await call<{ error: string }>(tidyMedia, { body: { apply: true } });
  assert.equal(r.status, 409);
  assert.match(r.body?.error ?? '', /no posts were found/);
  assert.equal(bucket.objects.size, 4);
});
