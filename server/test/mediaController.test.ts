// The endpoints and the database half of removal, run for real against an
// in-memory database and bucket.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pruneServiceMedia, purgeOwnPostMedia, tidyMedia } from '../src/controllers/media.controller';
import { purgeDeletedPostMedia } from '../src/postMedia';
import { downloadUrl, useBucketForTests } from '../src/storage';
import { FakeBucket } from './fakeBucket';

const require = createRequire(import.meta.url);
// `database` is a getter on the namespace's prototype, so that is where the
// stand-in has to go for the controller to see it.
const adminProto = Object.getPrototypeOf(require('firebase-admin'));

const POST = '-OzTestPostAAAAAAA01';
const OTHER = '-OzTestPostBBBBBBB02';
const LIVE = '-OzTestPostLLLLLLL09';
const OWNER = 'ownerUid0000000000000000001';
const STRANGER = 'strangerUid00000000000000002';
const ADMIN = 'adminUid00000000000000000003';
const url = (path: string) => downloadUrl('test-bucket', path, 'tok');
const old = () => Date.now() - 3 * 24 * 3_600_000;
const gallery = (id: string, n: number) => url(`listingImages/${id}/stem-${n}-1200w.webp`);

let bucket: FakeBucket;
let data: Record<string, unknown>;
let servicesUnreadable: boolean;
let realDatabase: PropertyDescriptor | undefined;

function fakeDatabase() {
  const read = (path: string): unknown => path.split('/').filter(Boolean).reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), data);
  const snap = (v: unknown) => ({ exists: () => v !== undefined && v !== null, val: () => v ?? null });
  return {
    ref: (path: string) => ({
      get: async () => {
        if (servicesUnreadable && path === 'services') throw new Error('the database is unreachable');
        return snap(read(path));
      },
      // orders.orderByChild('serviceId').equalTo(id).limitToFirst(1)
      orderByChild: (child: string) => ({
        equalTo: (value: unknown) => ({
          limitToFirst: () => ({
            get: async () => {
              const all = (read(path) ?? {}) as Record<string, Record<string, unknown>>;
              return snap(Object.values(all).some((r) => r && r[child] === value) ? { found: true } : null);
            },
          }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  bucket = new FakeBucket();
  useBucketForTests(bucket.asBucket());
  data = {};
  servicesUnreadable = false;
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

type Removal = { removed: number; failed: number; skipped?: string; inUse?: number; recent?: number };

// ─── A seller deleting their own post ──────────────────────────────────────────

test("a seller can clear their own post's files", async () => {
  data = { services: { [POST]: { sellerId: OWNER, images: [url(`serviceImages/${OWNER}/a.jpg`)] } } };
  bucket.seed(`serviceImages/${OWNER}/a.jpg`);
  bucket.seed(`serviceImages/${OWNER}/keep.jpg`);
  const r = await call<Removal>(purgeOwnPostMedia, { params: { id: POST }, uid: OWNER });
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
  const r = await call<Removal>(purgeOwnPostMedia, { params: { id: POST }, uid: ADMIN });
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

// ─── Files that something else still needs ─────────────────────────────────────

test("a post with orders keeps its photos: the orders' history shows them", async () => {
  data = {
    services: { [POST]: { sellerId: OWNER, images: [url(`serviceImages/${OWNER}/a.jpg`)] } },
    orders: { o1: { serviceId: OTHER }, o2: { serviceId: POST, serviceImage: url(`serviceImages/${OWNER}/a.jpg`) } },
  };
  bucket.seed(`serviceImages/${OWNER}/a.jpg`);
  const r = await call<Removal>(purgeOwnPostMedia, { params: { id: POST }, uid: OWNER });
  assert.equal(r.status, 200);
  assert.equal(r.body?.removed, 0);
  assert.match(r.body?.skipped ?? '', /orders/);
  assert.ok(bucket.objects.has(`serviceImages/${OWNER}/a.jpg`));
});

test("an order on some other post does not protect this one's photos", async () => {
  data = { services: { [POST]: { sellerId: OWNER, images: [url(`serviceImages/${OWNER}/a.jpg`)] } }, orders: { o1: { serviceId: OTHER } } };
  bucket.seed(`serviceImages/${OWNER}/a.jpg`);
  const r = await call<Removal>(purgeOwnPostMedia, { params: { id: POST }, uid: OWNER });
  assert.equal(r.body?.removed, 1);
});

test("deleting a claimed listing's original through the endpoint leaves the live post its photos", async () => {
  // The paused original, and the seller's new post holding the same photo URLs.
  data = {
    services: {
      [POST]: { sellerId: '', isGenerated: true, claimStatus: 'claimed', claimedBy: OWNER, status: 'paused', images: [gallery(POST, 1)] },
      [LIVE]: { sellerId: OWNER, status: 'active', images: [gallery(POST, 1)], ogImage: gallery(POST, 1) },
    },
    users: { [ADMIN]: { role: 'admin' } },
  };
  seedPost(POST);
  const r = await call<Removal>(purgeOwnPostMedia, { params: { id: POST }, uid: ADMIN });
  assert.equal(r.status, 200);
  assert.equal(r.body?.inUse, 3, 'photo 1 in three sizes is shared');
  for (const s of ['1200w', '640w', '240w']) assert.ok(bucket.objects.has(`listingImages/${POST}/stem-1-${s}.webp`), s);
  assert.ok(!bucket.objects.has(`listingLogos/${POST}.png`), 'what the live post does not use goes');
});

test('the same, after the original record is already gone (the account and admin delete paths)', async () => {
  data = { services: { [LIVE]: { sellerId: OWNER, images: [gallery(POST, 1)] } } };
  seedPost(POST);
  const r = await purgeDeletedPostMedia(POST, { sellerId: '' });
  assert.equal(r.inUse, 3);
  assert.ok(bucket.objects.has(`listingImages/${POST}/stem-1-1200w.webp`));
});

test('when it cannot tell what else uses the files, it removes nothing', async () => {
  data = { services: { [POST]: { sellerId: OWNER, images: [] } } };
  seedPost(POST);
  servicesUnreadable = true;
  const r = await call<Removal>(purgeOwnPostMedia, { params: { id: POST }, uid: OWNER });
  // The ownership check also reads the post, so this surfaces as a server error: either way nothing is removed.
  assert.ok(r.status === 500 || r.body?.skipped);
  assert.equal(bucket.objects.size, 4);

  servicesUnreadable = false;
  data = { services: { [OTHER]: { sellerId: OWNER } } };
  servicesUnreadable = true;
  const direct = await purgeDeletedPostMedia(POST, { sellerId: '' });
  assert.equal(direct.removed, 0);
  assert.ok(direct.skipped);
  assert.equal(bucket.objects.size, 4);
});

// ─── Pruning after an admin edit ───────────────────────────────────────────────

test('pruning removes what the saved post no longer uses', async () => {
  data = { services: { [POST]: { sellerId: '', images: [gallery(POST, 1)] } } };
  seedPost(POST);
  for (const s of ['1200w', '640w', '240w']) bucket.seed(`listingImages/${POST}/stem-2-${s}.webp`, { createdAt: old() });
  const r = await call<Removal>(pruneServiceMedia, { params: { id: POST } });
  assert.equal(r.status, 200);
  assert.equal(r.body?.removed, 4, 'photo 2 in three sizes, plus the logo no longer referenced');
  for (const s of ['1200w', '640w', '240w']) assert.ok(bucket.objects.has(`listingImages/${POST}/stem-1-${s}.webp`), s);
});

test('pruning an original leaves what a live post shares', async () => {
  data = { services: { [POST]: { sellerId: '', images: [gallery(POST, 1)] }, [LIVE]: { sellerId: OWNER, images: [gallery(POST, 1), gallery(POST, 2)] } } };
  seedPost(POST);
  for (const s of ['1200w', '640w', '240w']) bucket.seed(`listingImages/${POST}/stem-2-${s}.webp`, { createdAt: old() });
  const r = await call<Removal>(pruneServiceMedia, { params: { id: POST } });
  assert.equal(r.body?.inUse, 3);
  for (const s of ['1200w', '640w', '240w']) assert.ok(bucket.objects.has(`listingImages/${POST}/stem-2-${s}.webp`), `shared photo 2 ${s}`);
});

test('removing every photo is honoured only when the admin says so', async () => {
  data = { services: { [POST]: { sellerId: '' } } }; // the database drops an empty list of photos entirely
  seedPost(POST);
  const refused = await call<Removal>(pruneServiceMedia, { params: { id: POST }, body: {} });
  assert.ok(refused.body?.skipped);
  assert.equal(bucket.objects.size, 4);

  for (const allowEmpty of ['true', 1, 'yes', null]) {
    await call(pruneServiceMedia, { params: { id: POST }, body: { allowEmpty } });
    assert.equal(bucket.objects.size, 4, `allowEmpty=${JSON.stringify(allowEmpty)}`);
  }

  const done = await call<Removal>(pruneServiceMedia, { params: { id: POST }, body: { allowEmpty: true } });
  assert.equal(done.body?.removed, 4);
  assert.equal(bucket.objects.size, 0);
});

test('pruning reports files it kept because they are too new, so the admin can be told', async () => {
  data = { services: { [POST]: { sellerId: '', images: [gallery(POST, 1)] } } };
  bucket.seed(`listingImages/${POST}/stem-1-1200w.webp`, { createdAt: old() });
  bucket.seed(`listingImages/${POST}/stem-1-640w.webp`, { createdAt: old() });
  bucket.seed(`listingImages/${POST}/stem-1-240w.webp`, { createdAt: old() });
  bucket.seed(`listingImages/${POST}/stem-2-1200w.webp`, { createdAt: Date.now() - 30_000 });
  const r = await call<Removal>(pruneServiceMedia, { params: { id: POST } });
  assert.equal(r.body?.removed, 0);
  assert.equal(r.body?.recent, 1);
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

test("tidy keeps a deleted original's photos while a live post uses them", async () => {
  data = { services: { [LIVE]: { sellerId: OWNER, images: [gallery(OTHER, 1)] } } };
  seedPost(OTHER); // its record is long gone
  const dry = await call<{ orphans: { files: number; keptInUse: number } }>(tidyMedia, { body: {} });
  assert.equal(dry.body?.orphans.keptInUse, 3);
  assert.equal(dry.body?.orphans.files, 1, 'only the logo');
  await call(tidyMedia, { body: { apply: true } });
  for (const s of ['1200w', '640w', '240w']) assert.ok(bucket.objects.has(`listingImages/${OTHER}/stem-1-${s}.webp`), s);
});

test('tidy refuses, and removes nothing, when no posts can be read', async () => {
  data = {};
  seedPost(OTHER);
  const r = await call<{ error: string }>(tidyMedia, { body: { apply: true } });
  assert.equal(r.status, 409);
  assert.match(r.body?.error ?? '', /no posts were found/);
  assert.equal(bucket.objects.size, 4);
});

test('a large clean-up is refused until an admin forces it, and force never overrides an empty list', async () => {
  data = { services: { [POST]: { sellerId: '' } } };
  for (let i = 0; i < 40; i++) seedPost(`-OzTestPostZZ${String(i).padStart(7, '0')}`);
  const refused = await call<{ error: string }>(tidyMedia, { body: { apply: true } });
  assert.equal(refused.status, 409);
  assert.equal(bucket.objects.size, 40 * 4);

  const forced = await call<{ orphans: { removed: number } }>(tidyMedia, { body: { apply: true, force: true } });
  assert.equal(forced.body?.orphans.removed, 40 * 4);

  data = {};
  seedPost(OTHER);
  assert.equal((await call(tidyMedia, { body: { apply: true, force: true } })).status, 409);
});
