// The server writes three sizes of each photo and the browser derives the URL of
// the smaller two from the stored one. These tests run both halves against each
// other, so a change to either that breaks the other fails here.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { storePhoto } from '../src/photoVariants';
import { useBucketForTests } from '../src/storage';
import { cardImage, hasSizes, imageSize, thumbImage } from '../../src/utils/imageVariants';
import { FakeBucket } from './fakeBucket';

let bucket: FakeBucket;
beforeEach(() => { bucket = new FakeBucket(); useBucketForTests(bucket.asBucket()); });
afterEach(() => useBucketForTests(null));

/** The object a download URL points at, if it exists with a matching token. */
function resolve(url: string): { path: string; width?: number } | null {
  const m = url.match(/\/o\/([^?]+)\?alt=media&token=([0-9a-f-]+)$/);
  if (!m) return null;
  const path = decodeURIComponent(m[1]);
  const obj = bucket.objects.get(path);
  return obj && obj.token === m[2] ? { path } : null;
}

async function stored(stem = 'junk-busters-dallas-texas', n = 1): Promise<string> {
  const jpeg = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#5b8c3a' } }).jpeg().toBuffer();
  return storePhoto({ body: jpeg, contentType: 'image/jpeg' }, 'listingImages/-OkAbC123xyz', stem, n, `listingImages/-OkAbC123xyz/${stem}-${n}.jpg`);
}

test("the card and thumbnail URLs derived from a stored photo's URL are real objects", async () => {
  const url = await stored();
  assert.ok(hasSizes(url));

  const full = resolve(url);
  const card = resolve(cardImage(url));
  const thumb = resolve(thumbImage(url));
  assert.ok(full && card && thumb, 'all three resolve to objects carrying the same token');
  assert.match(card.path, /-640w\.webp$/);
  assert.match(thumb.path, /-240w\.webp$/);
  assert.equal(card.path.replace('-640w.webp', ''), full.path.replace('-1200w.webp', ''), 'same photo, different size');
});

test('every photo of a post resolves, whatever its position or name', async () => {
  for (const [stem, n] of [['a', 1], ['as4less-landscaping-miami-florida', 10], ['caf-m-ller', 2]] as const) {
    const url = await stored(stem, n);
    assert.ok(resolve(cardImage(url)) && resolve(thumbImage(url)), `${stem}-${n}`);
  }
});

test('a photo stored as the original (no sizes) is left alone', async () => {
  bucket.failSaves = /w\.webp$/;
  const url = await stored('x', 1);
  assert.equal(hasSizes(url), false);
  assert.equal(cardImage(url), url);
  assert.equal(thumbImage(url), url);
  assert.ok(resolve(url), 'and the original is where the URL says');
});

test('only generated-post photos are treated as having sizes', () => {
  const generated = 'https://firebasestorage.googleapis.com/v0/b/b/o/listingImages%2F-Oid%2Fstem-1-1200w.webp?alt=media&token=t-1';
  assert.equal(hasSizes(generated), true);
  assert.equal(imageSize(generated, 'card'), 'https://firebasestorage.googleapis.com/v0/b/b/o/listingImages%2F-Oid%2Fstem-1-640w.webp?alt=media&token=t-1');

  const untouched = [
    // a seller who happened to name a file this way
    'https://firebasestorage.googleapis.com/v0/b/b/o/serviceImages%2Fuid%2Fphoto-1200w.webp?alt=media&token=t',
    // an older generated photo
    'https://firebasestorage.googleapis.com/v0/b/b/o/listingImages%2F-Oid%2Fstem-1.webp?alt=media&token=t',
    'https://firebasestorage.googleapis.com/v0/b/b/o/listingImages%2F-Oid%2Fstem-1.jpg?alt=media&token=t',
    // a size that is already small
    'https://firebasestorage.googleapis.com/v0/b/b/o/listingImages%2F-Oid%2Fstem-1-640w.webp?alt=media&token=t',
    '',
    'https://example.com/photo.jpg',
  ];
  for (const u of untouched) {
    assert.equal(hasSizes(u), false, u);
    assert.equal(cardImage(u), u, u);
    assert.equal(thumbImage(u), u, u);
  }
});

test('the token is never touched, and the suffix is only swapped in the path', () => {
  // A token can't contain the suffix, but prove the swap stops at the query.
  const odd = 'https://firebasestorage.googleapis.com/v0/b/b/o/listingImages%2F-Oid%2Fa-1-1200w.webp?alt=media&token=abc-1200w.webp';
  assert.equal(thumbImage(odd), 'https://firebasestorage.googleapis.com/v0/b/b/o/listingImages%2F-Oid%2Fa-1-240w.webp?alt=media&token=abc-1200w.webp');
});
