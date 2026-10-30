import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isPostId, postPrefixes, pruneUnusedMedia, purgePostMedia, purgeUserUploads, referencedPaths, siblingsOf, storagePathOf, tidyStorage } from '../src/mediaCleanup';
import { downloadUrl, LONG_CACHE, useBucketForTests } from '../src/storage';
import { FakeBucket } from './fakeBucket';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const old = () => Date.now() - 3 * DAY;

let bucket: FakeBucket;
beforeEach(() => { bucket = new FakeBucket(); useBucketForTests(bucket.asBucket()); });
afterEach(() => useBucketForTests(null));

const POST = '-OzTestPostAAAAAAA01';
const OTHER = '-OzTestPostBBBBBBB02';
const SELLER = 'sellerUid0000000000000000001';
const STRANGER = 'strangerUid00000000000000002';
const url = (path: string) => downloadUrl('test-bucket', path, 'tok');

/** A generated post's files: three sizes of each photo, a logo and an admin upload. */
function seedPost(id: string, extra: Partial<{ created: number }> = {}) {
  const created = extra.created ?? old();
  for (const n of [1, 2, 3]) for (const s of ['1200w', '640w', '240w']) bucket.seed(`listingImages/${id}/stem-${n}-${s}.webp`, { createdAt: created, cacheControl: LONG_CACHE });
  bucket.seed(`listingLogos/${id}.png`, { createdAt: created, cacheControl: LONG_CACHE });
  bucket.seed(`services/${id}/1700000000_upload.jpg`, { createdAt: created });
}
const names = () => [...bucket.objects.keys()].sort();
const under = (p: string) => names().filter((n) => n.startsWith(p));

// ─── Reading a URL ─────────────────────────────────────────────────────────────

test('storagePathOf places only URLs in our own bucket', () => {
  const path = 'listingImages/PostAAAAAAA1/stem-1-1200w.webp';
  assert.equal(storagePathOf(url(path), 'test-bucket'), path);
  assert.equal(storagePathOf(`https://storage.googleapis.com/test-bucket/${path}`, 'test-bucket'), path);
  assert.equal(storagePathOf(url(path), 'another-bucket'), null, 'a different bucket');
  assert.equal(storagePathOf('https://example.com/o/' + path, 'test-bucket'), null, 'a different host');
  assert.equal(storagePathOf('https://firebasestorage.googleapis.com/v0/b/test-bucket/o/%E0%A4%A', 'test-bucket'), null, 'a malformed escape');
  for (const bad of ['', 'not a url', null, undefined, 42]) assert.equal(storagePathOf(bad, 'test-bucket'), null);
});

test('only well-formed post ids are accepted', () => {
  assert.ok(isPostId(POST) && isPostId('-OkAbC123xyzQwErTy12') && isPostId('-P20QvW_F2noBzzNXISG'));
  for (const bad of ['', 'short', 'PostAAAAAAA1', 'OkAbC123xyzQwErTy123', '-OkAbC123xyzQwErTy123', '../etc/passwd', 'a/b/c/d/e/f/g/h', 'Post AAAAAAA1', 'Post.AAAAAAA', null, undefined, 123, 'x'.repeat(41)]) {
    assert.equal(isPostId(bad), false, String(bad));
  }
});

test('a gallery photo knows the sizes that sit beside it', () => {
  assert.deepEqual(siblingsOf('listingImages/P/stem-3-1200w.webp'), ['listingImages/P/stem-3-640w.webp', 'listingImages/P/stem-3-240w.webp']);
  assert.deepEqual(siblingsOf('listingImages/P/stem-3.jpg'), []);
  assert.deepEqual(siblingsOf('listingImages/P/stem-3-640w.webp'), []);
});

// ─── Deleting a post ───────────────────────────────────────────────────────────

test('purge clears everything the post owns and nothing else', async () => {
  seedPost(POST);
  seedPost(OTHER);
  bucket.seed('profilePhotos/' + SELLER);
  bucket.seed(`serviceImages/${SELLER}/unrelated.jpg`);

  const r = await purgePostMedia(POST, { sellerId: '' });

  assert.equal(r.failed, 0);
  assert.equal(r.removed, 3 * 3 + 1 + 1);
  assert.deepEqual(under(`listingImages/${POST}/`), []);
  assert.deepEqual(under(`services/${POST}/`), []);
  assert.deepEqual(under(`listingLogos/${POST}.`), []);
  assert.equal(under(`listingImages/${OTHER}/`).length, 9, 'another post is untouched');
  assert.ok(bucket.objects.has(`listingLogos/${OTHER}.png`));
  assert.ok(bucket.objects.has('profilePhotos/' + SELLER) && bucket.objects.has(`serviceImages/${SELLER}/unrelated.jpg`));
});

test('purge cannot be steered by a look-alike id', async () => {
  const LONGER = POST + 'X'; // a folder whose name starts with the post's id
  seedPost(POST);
  seedPost(LONGER);
  await purgePostMedia(POST, null);
  assert.equal(under(`listingImages/${LONGER}/`).length, 9);
  assert.ok(bucket.objects.has(`listingLogos/${LONGER}.png`), 'the longer id keeps its logo');
  assert.ok(bucket.objects.has(`services/${LONGER}/1700000000_upload.jpg`));
});

test("purge removes the seller's own uploads named by the record, and only those", async () => {
  bucket.seed(`serviceImages/${SELLER}/a-1.jpg`);
  bucket.seed(`serviceImages/${SELLER}/a-2.jpg`);
  bucket.seed(`serviceImages/${SELLER}/other-post.jpg`);
  bucket.seed(`serviceVideos/${SELLER}/clip.mp4`);
  bucket.seed(`serviceImages/${SELLER}/clip-poster.jpg`);
  bucket.seed('profilePhotos/' + SELLER);

  await purgePostMedia(POST, {
    sellerId: SELLER,
    images: [url(`serviceImages/${SELLER}/a-1.jpg`), url(`serviceImages/${SELLER}/a-2.jpg`)],
    video: url(`serviceVideos/${SELLER}/clip.mp4`),
    videoPoster: url(`serviceImages/${SELLER}/clip-poster.jpg`),
    sellerPhotoURL: url('profilePhotos/' + SELLER), // shared by all of their posts: never removed
  });

  assert.deepEqual(names(), [`serviceImages/${SELLER}/other-post.jpg`, 'profilePhotos/' + SELLER].sort());
});

test("a record pointing at someone else's files cannot delete them", async () => {
  bucket.seed(`serviceImages/${STRANGER}/theirs.jpg`);
  bucket.seed(`serviceVideos/${STRANGER}/theirs.mp4`);
  bucket.seed('profilePhotos/' + STRANGER);
  bucket.seed(`listingImages/${OTHER}/stem-1-1200w.webp`, { createdAt: old() });

  await purgePostMedia(POST, {
    sellerId: SELLER,
    images: [url(`serviceImages/${STRANGER}/theirs.jpg`), url(`listingImages/${OTHER}/stem-1-1200w.webp`)],
    video: url(`serviceVideos/${STRANGER}/theirs.mp4`),
    sellerPhotoURL: url('profilePhotos/' + STRANGER),
  });

  assert.equal(bucket.objects.size, 4, 'nothing was removed');
});

test('purge refuses anything that is not a post id', async () => {
  seedPost(POST);
  for (const bad of ['', '..', '../listingImages', 'a/b', undefined, null]) {
    const r = await purgePostMedia(bad as never, { sellerId: SELLER });
    assert.equal(r.removed, 0);
    assert.ok(r.skipped);
  }
  assert.equal(under('listingImages/').length, 9, 'and nothing was touched');
});

test('purge carries on past a failure and never throws', async () => {
  seedPost(POST);
  bucket.failDeletes = /stem-2-640w/;
  const r = await purgePostMedia(POST, null);
  assert.equal(r.failed, 1);
  assert.equal(r.removed, 10);
  assert.deepEqual(under('listingImages/'), [`listingImages/${POST}/stem-2-640w.webp`]);

  const originalGetFiles = bucket.getFiles;
  bucket.getFiles = async () => { throw new Error('listing is down'); };
  const r2 = await purgePostMedia(POST, null);
  assert.equal(r2.removed, 0);
  assert.ok(r2.failed >= 1);
  bucket.getFiles = originalGetFiles;
});

// ─── Editing a post ────────────────────────────────────────────────────────────

const gallery = (id: string, n: number) => url(`listingImages/${id}/stem-${n}-1200w.webp`);

test('prune removes the photos taken out of a post, in every size, and keeps the rest', async () => {
  seedPost(POST);
  // The admin removed photo 2; photo 1 is the cover and the share image; photo 3 stays.
  const r = await pruneUnusedMedia(POST, {
    sellerId: '',
    images: [gallery(POST, 1), gallery(POST, 3)],
    ogImage: gallery(POST, 1),
    sellerPhotoURL: url(`listingLogos/${POST}.png`),
  });

  assert.equal(r.failed, 0);
  assert.deepEqual(under(`listingImages/${POST}/stem-2`), [], 'photo 2 is gone in all three sizes');
  for (const s of ['1200w', '640w', '240w']) {
    assert.ok(bucket.objects.has(`listingImages/${POST}/stem-1-${s}.webp`), `photo 1 ${s}`);
    assert.ok(bucket.objects.has(`listingImages/${POST}/stem-3-${s}.webp`), `photo 3 ${s}`);
  }
  assert.ok(bucket.objects.has(`listingLogos/${POST}.png`), 'the logo the post still shows');
  assert.ok(!bucket.objects.has(`services/${POST}/1700000000_upload.jpg`), 'an upload no longer used');
});

test('prune keeps the share image and logo even when they are the only reference', async () => {
  seedPost(POST);
  await pruneUnusedMedia(POST, { images: [gallery(POST, 1)], ogImage: gallery(POST, 3), sellerPhotoURL: url(`listingLogos/${POST}.png`) });
  assert.ok(bucket.objects.has(`listingImages/${POST}/stem-3-1200w.webp`), 'the share image');
  assert.ok(bucket.objects.has(`listingLogos/${POST}.png`));
  assert.ok(!bucket.objects.has(`listingImages/${POST}/stem-2-1200w.webp`));
});

test('prune leaves a photo alone while its upload may still be in flight', async () => {
  seedPost(POST, { created: Date.now() - 60_000 });
  const r = await pruneUnusedMedia(POST, { images: [gallery(POST, 1)] });
  assert.equal(r.removed, 0);
  assert.equal(bucket.objects.size, 9 + 1 + 1);
});

test('prune keeps older-format photos that the post still lists', async () => {
  bucket.seed(`listingImages/${POST}/stem-1.jpg`, { createdAt: old() });
  bucket.seed(`listingImages/${POST}/stem-2.jpg`, { createdAt: old() });
  bucket.seed(`listingImages/${POST}/3.jpg`, { createdAt: old() });
  const r = await pruneUnusedMedia(POST, { images: [url(`listingImages/${POST}/stem-1.jpg`), url(`listingImages/${POST}/stem-2.jpg`)] });
  assert.equal(r.removed, 1);
  assert.deepEqual(under(`listingImages/${POST}/`), [`listingImages/${POST}/stem-1.jpg`, `listingImages/${POST}/stem-2.jpg`]);
});

test('prune never acts on a record it cannot fully place', async () => {
  seedPost(POST);
  const before = bucket.objects.size;
  const cases: Record<string, unknown> = {
    'no record': null,
    'no photos': { images: [] },
    'photos missing': {},
    'a photo on another site': { images: [gallery(POST, 1), 'https://static.wixstatic.com/media/abc.jpg'] },
    'a photo in another bucket': { images: [gallery(POST, 1), downloadUrl('someone-elses-bucket', 'x/y.jpg', 't')] },
    'a value that is not a URL': { images: [gallery(POST, 1), 12345] },
  };
  for (const [name, record] of Object.entries(cases)) {
    const r = await pruneUnusedMedia(POST, record as never);
    assert.equal(r.removed, 0, name);
    assert.ok(r.skipped, name);
  }
  assert.equal(bucket.objects.size, before);
});

test('prune only ever looks inside the post\'s own folders', async () => {
  seedPost(POST);
  bucket.seed(`serviceImages/${SELLER}/theirs.jpg`, { createdAt: old() });
  bucket.seed(`listingImages/${OTHER}/stem-1-1200w.webp`, { createdAt: old() });
  await pruneUnusedMedia(POST, { images: [gallery(POST, 1)] });
  assert.ok(bucket.objects.has(`serviceImages/${SELLER}/theirs.jpg`));
  assert.ok(bucket.objects.has(`listingImages/${OTHER}/stem-1-1200w.webp`));
});

test('referencedPaths includes the sizes beside each gallery photo', () => {
  const set = referencedPaths({ images: [gallery(POST, 1)], ogImage: gallery(POST, 1) }, 'test-bucket');
  assert.deepEqual([...set].sort(), [
    `listingImages/${POST}/stem-1-1200w.webp`,
    `listingImages/${POST}/stem-1-240w.webp`,
    `listingImages/${POST}/stem-1-640w.webp`,
  ]);
});

// ─── Deleting an account ───────────────────────────────────────────────────────

test("deleting an account removes that user's post uploads and nobody else's", async () => {
  bucket.seed(`serviceImages/${SELLER}/a.jpg`);
  bucket.seed(`serviceVideos/${SELLER}/a.mp4`);
  bucket.seed(`serviceImages/${STRANGER}/b.jpg`);
  bucket.seed('profilePhotos/' + SELLER);
  const r = await purgeUserUploads(SELLER);
  assert.equal(r.removed, 2);
  assert.deepEqual(names(), [`serviceImages/${STRANGER}/b.jpg`, 'profilePhotos/' + SELLER].sort());
  assert.ok((await purgeUserUploads('../x')).skipped);
});

// ─── Tidying what is already there ─────────────────────────────────────────────

test('tidy finds the files of posts that are gone, and removes them only when told to', async () => {
  const LIVE = POST, GONE = OTHER, GONE2 = '-OzTestPostCCCCCCC03';
  seedPost(LIVE);
  seedPost(GONE);
  seedPost(GONE2);

  const dry = await tidyStorage(new Set([LIVE]), { apply: false });
  assert.equal(dry.applied, false);
  assert.equal(dry.orphans.posts, 2);
  assert.equal(dry.orphans.files, 2 * 11);
  assert.equal(dry.orphans.removed, 0);
  assert.equal(bucket.objects.size, 3 * 11, 'a dry run changes nothing');

  const done = await tidyStorage(new Set([LIVE]), { apply: true });
  assert.equal(done.orphans.removed, 22);
  assert.equal(done.orphans.failed, 0);
  assert.equal(bucket.objects.size, 11);
  assert.equal(under(`listingImages/${LIVE}/`).length, 9, 'the live post is untouched');
  assert.ok(bucket.objects.has(`listingLogos/${LIVE}.png`));
});

test("tidy never removes a live post's files, however unused they look", async () => {
  seedPost(POST);
  bucket.seed(`listingImages/${POST}/not-in-any-record.jpg`, { createdAt: old() });
  const r = await tidyStorage(new Set([POST]), { apply: true });
  assert.equal(r.orphans.files, 0);
  assert.ok(bucket.objects.has(`listingImages/${POST}/not-in-any-record.jpg`));
});

test('tidy leaves recent files and odd shapes alone', async () => {
  seedPost(OTHER, { created: Date.now() - 5 * 60_000 }); // saved moments ago, record not written yet
  bucket.seed('listingImages/not-a-post-id-folder-name-x/y.jpg', { createdAt: old() });
  bucket.seed('listingImages/loose-file.jpg', { createdAt: old() });
  bucket.seed('listingLogos/Post.png', { createdAt: old() });
  const r = await tidyStorage(new Set([POST]), { apply: true });
  assert.equal(r.orphans.files, 0);
  assert.equal(bucket.objects.size, 11 + 3);
});

test('tidy refuses when it cannot tell what is unused', async () => {
  seedPost(OTHER);
  await assert.rejects(tidyStorage(new Set(), { apply: true }), /no posts were found/);
  assert.equal(bucket.objects.size, 11, 'nothing removed');

  // Far more unused posts than live ones: a bad read, not a clean-up.
  for (let i = 0; i < 40; i++) seedPost(`-OzTestPostZZ${String(i).padStart(7, '0')}`);
  await assert.rejects(tidyStorage(new Set([POST]), { apply: true }), /more likely a bad read/);
  assert.equal(bucket.objects.size, 11 + 40 * 11, 'still nothing removed');
});

test("tidy gives photos and videos a year's caching, and never touches other folders", async () => {
  bucket.seed(`serviceImages/${SELLER}/a.jpg`, { createdAt: old(), cacheControl: 'private, max-age=0' });
  bucket.seed(`serviceImages/${SELLER}/b.jpg`, { createdAt: old() }); // none set
  bucket.seed(`serviceImages/${SELLER}/c.jpg`, { createdAt: old(), cacheControl: LONG_CACHE });
  bucket.seed(`serviceVideos/${SELLER}/v.mp4`, { createdAt: old(), cacheControl: 'public, max-age=3600' });
  bucket.seed(`services/${POST}/up.jpg`, { createdAt: old(), cacheControl: 'private, max-age=0' });
  // Overwritten in place under a fixed name: must never be made immutable.
  bucket.seed('profilePhotos/' + SELLER, { createdAt: old(), cacheControl: 'private, max-age=0' });
  bucket.seed('avatars/' + SELLER, { createdAt: old() });
  bucket.seed('chat/c1/m1', { createdAt: old() });

  const dry = await tidyStorage(new Set([POST]), { apply: false });
  assert.equal(dry.caching.files, 4);
  assert.equal(bucket.objects.get(`serviceImages/${SELLER}/a.jpg`)?.cacheControl, 'private, max-age=0', 'a dry run changes nothing');

  const r = await tidyStorage(new Set([POST]), { apply: true });
  assert.equal(r.caching.updated, 4);
  for (const p of [`serviceImages/${SELLER}/a.jpg`, `serviceImages/${SELLER}/b.jpg`, `serviceVideos/${SELLER}/v.mp4`, `services/${POST}/up.jpg`]) {
    assert.equal(bucket.objects.get(p)?.cacheControl, LONG_CACHE, p);
  }
  assert.equal(bucket.objects.get('profilePhotos/' + SELLER)?.cacheControl, 'private, max-age=0');
  assert.equal(bucket.objects.get('avatars/' + SELLER)?.cacheControl, undefined);
  assert.equal(bucket.objects.get('chat/c1/m1')?.cacheControl, undefined);
});

test('tidy does not spend effort caching files it is about to remove', async () => {
  bucket.seed(`listingImages/${OTHER}/x-1.jpg`, { createdAt: old(), cacheControl: 'private, max-age=0' });
  bucket.seed(`serviceImages/${SELLER}/a.jpg`, { createdAt: old() });
  const dry = await tidyStorage(new Set([POST]), { apply: false });
  assert.equal(dry.orphans.files, 1);
  assert.equal(dry.caching.files, 1, 'only the seller photo');
});

test('tidy reports failures and carries on', async () => {
  seedPost(OTHER);
  bucket.failDeletes = /stem-1-240w/;
  const r = await tidyStorage(new Set([POST]), { apply: true });
  assert.equal(r.orphans.failed, 1);
  assert.equal(r.orphans.removed, 10);
});
