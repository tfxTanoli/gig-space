import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createLimiter, fitFourThree, makeVariants, RESIZE_SLOTS, storePhoto, VARIANT_SUFFIX } from '../src/photoVariants';
import { useBucketForTests } from '../src/storage';
import { FakeBucket } from './fakeBucket';

// A smooth, photo-like image: gradients compress the way photographs do, where
// pure noise would not.
async function photo(width: number, height: number, format: 'jpeg' | 'png' = 'jpeg', channels: 3 | 4 = 3): Promise<Buffer> {
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      data[i] = Math.round((x / width) * 255);
      data[i + 1] = Math.round((y / height) * 255);
      data[i + 2] = Math.round(((x + y) / (width + height)) * 255);
      if (channels === 4) data[i + 3] = x < width / 2 ? 255 : 128;
    }
  }
  const img = sharp(data, { raw: { width, height, channels } });
  return format === 'jpeg' ? img.jpeg({ quality: 92 }).toBuffer() : img.png().toBuffer();
}

const dims = async (b: Buffer) => {
  const m = await sharp(b).metadata();
  return { w: m.width, h: m.height, format: m.format };
};

test('fitFourThree takes the largest 4:3 region, never larger than the photo', () => {
  assert.deepEqual(fitFourThree(4000, 3000, 640), { width: 640, height: 480 });
  assert.deepEqual(fitFourThree(600, 395, 640), { width: 527, height: 395 }); // short photo: cropped, not stretched
  assert.deepEqual(fitFourThree(1200, 300, 640), { width: 400, height: 300 }); // panorama
  assert.deepEqual(fitFourThree(100, 100, 240), { width: 100, height: 75 });
  assert.deepEqual(fitFourThree(640, 1600, 640), { width: 640, height: 480 }); // portrait
});

test('a landscape photo becomes three WebP sizes of the right shape', async () => {
  const original = await photo(2000, 1500);
  const v = await makeVariants(original);

  assert.deepEqual(await dims(v.full), { w: 1200, h: 900, format: 'webp' });
  assert.deepEqual(await dims(v.card), { w: 640, h: 480, format: 'webp' });
  assert.deepEqual(await dims(v.thumb), { w: 240, h: 180, format: 'webp' });
  assert.equal(v.width, 1200);
  assert.equal(v.height, 900);
  assert.ok(v.full.length < original.length, 'gallery size is lighter than the original');
  assert.ok(v.card.length < v.full.length && v.thumb.length < v.card.length, 'each size is lighter than the last');
});

test('a tall photo is capped in height and its card is a 4:3 crop', async () => {
  const v = await makeVariants(await photo(800, 2000));
  assert.deepEqual(await dims(v.full), { w: 640, h: 1600, format: 'webp' });
  assert.deepEqual(await dims(v.card), { w: 640, h: 480, format: 'webp' });
  assert.deepEqual(await dims(v.thumb), { w: 240, h: 180, format: 'webp' });
});

test('a small photo is never enlarged', async () => {
  const v = await makeVariants(await photo(600, 395));
  assert.deepEqual(await dims(v.full), { w: 600, h: 395, format: 'webp' });
  assert.deepEqual(await dims(v.card), { w: 527, h: 395, format: 'webp' });
  assert.deepEqual(await dims(v.thumb), { w: 240, h: 180, format: 'webp' });
});

test("the camera's orientation flag is honoured", async () => {
  // Stored 400 wide by 200 tall, flagged to display turned a quarter: 200 x 400.
  const rotated = await sharp(await photo(400, 200)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const v = await makeVariants(rotated);
  assert.deepEqual(await dims(v.full), { w: 200, h: 400, format: 'webp' });
});

test('transparency survives', async () => {
  const v = await makeVariants(await photo(800, 600, 'png', 4));
  assert.equal((await sharp(v.full).metadata()).hasAlpha, true);
});

test('something that is not an image throws', async () => {
  await assert.rejects(makeVariants(Buffer.from('<html>not a photo</html>')));
});

test('the limiter never runs more than its share at once, and runs everything', async () => {
  const limited = createLimiter(3);
  let running = 0;
  let peak = 0;
  const order: number[] = [];
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      limited(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        order.push(i);
        running--;
      }),
    ),
  );
  assert.equal(peak, 3);
  assert.equal(order.length, 12);
});

test('the limiter keeps going after a task fails', async () => {
  const limited = createLimiter(1);
  await assert.rejects(limited(async () => { throw new Error('x'); }));
  assert.equal(await limited(async () => 'next'), 'next');
});

// ─── storePhoto ────────────────────────────────────────────────────────────────

let bucket: FakeBucket;
beforeEach(() => { bucket = new FakeBucket(); useBucketForTests(bucket.asBucket()); });
afterEach(() => useBucketForTests(null));

const DIR = 'listingImages/-Oabc123';
const input = (body: Buffer) => ({ body, contentType: 'image/jpeg' });

test('storePhoto stores all three sizes under one token and returns the gallery URL', async () => {
  const url = await storePhoto(input(await photo(1600, 1200)), DIR, 'junk-busters-dallas', 3, `${DIR}/junk-busters-dallas-3.jpg`);

  const paths = [...bucket.objects.keys()].sort();
  assert.deepEqual(paths, [
    `${DIR}/junk-busters-dallas-3-1200w.webp`,
    `${DIR}/junk-busters-dallas-3-240w.webp`,
    `${DIR}/junk-busters-dallas-3-640w.webp`,
  ]);

  const tokens = new Set([...bucket.objects.values()].map((o) => o.token));
  assert.equal(tokens.size, 1, 'one token for all three sizes');
  for (const o of bucket.objects.values()) {
    assert.equal(o.contentType, 'image/webp');
    assert.equal(o.cacheControl, 'public, max-age=31536000, immutable');
  }

  const [token] = tokens;
  assert.equal(
    url,
    `https://firebasestorage.googleapis.com/v0/b/test-bucket/o/${encodeURIComponent(`${DIR}/junk-busters-dallas-3${VARIANT_SUFFIX.full}`)}?alt=media&token=${token}`,
  );
});

test('storePhoto stores the original when the photo cannot be resized', async () => {
  const body = Buffer.from('definitely not an image');
  const url = await storePhoto(input(body), DIR, 'x', 1, `${DIR}/x-1.jpg`);
  assert.deepEqual([...bucket.objects.keys()], [`${DIR}/x-1.jpg`]);
  assert.ok(url.includes(encodeURIComponent(`${DIR}/x-1.jpg`)));
  assert.deepEqual(bucket.objects.get(`${DIR}/x-1.jpg`)?.body, body);
});

test('storePhoto stores the original once the deadline has passed', async () => {
  const body = await photo(1600, 1200);
  await storePhoto(input(body), DIR, 'x', 1, `${DIR}/x-1.jpg`, Date.now() - 1);
  assert.deepEqual([...bucket.objects.keys()], [`${DIR}/x-1.jpg`]);
  assert.deepEqual(bucket.objects.get(`${DIR}/x-1.jpg`)?.body, body, 'the original, byte for byte');
});

test('storePhoto never leaves a partial set: one failed size falls back to the original', async () => {
  bucket.failSaves = /-240w\.webp$/;
  const url = await storePhoto(input(await photo(1600, 1200)), DIR, 'x', 1, `${DIR}/x-1.jpg`);
  assert.deepEqual([...bucket.objects.keys()], [`${DIR}/x-1.jpg`], 'the sizes that did upload are removed');
  assert.ok(url.includes(encodeURIComponent(`${DIR}/x-1.jpg`)));
});

test('storePhoto still returns when cleaning up a failed set also fails', async () => {
  bucket.failSaves = /-240w\.webp$/;
  bucket.failDeletes = /w\.webp$/;
  const url = await storePhoto(input(await photo(800, 600)), DIR, 'x', 1, `${DIR}/x-1.jpg`);
  assert.ok(url.includes(encodeURIComponent(`${DIR}/x-1.jpg`)));
});

test('the cutoff applies when a photo reaches the front of the queue, not only when it joins it', async () => {
  // A batch admits every photo at once, then three at a time get resized. Checking
  // the deadline only on admission lets all of them through and resizes the last
  // ones long after it. Time one photo, then give the batch about four of them.
  const sample = await photo(2400, 1800);
  await makeVariants(sample); // warm the library
  const t0 = Date.now();
  await makeVariants(sample);
  const unit = Math.max(Date.now() - t0, 5);

  const bodies = await Promise.all(Array.from({ length: 30 }, () => photo(2400, 1800)));
  const deadline = Date.now() + unit * 4;
  const urls = await Promise.all(bodies.map((b, i) => storePhoto(input(b), DIR, 'x', i + 1, `${DIR}/x-${i + 1}.jpg`, deadline)));

  const resized = urls.filter((u) => u.includes('-1200w.webp')).length;
  const asCame = urls.length - resized;
  assert.ok(resized > 0, 'photos at the front of the queue before the deadline are resized');
  assert.ok(asCame > 0, `photos that reached the front after the deadline are stored as they came (${resized} resized, ${asCame} as they came)`);
  assert.ok(asCame >= 10, 'and that is most of a long queue, not one straggler');
});

test('the shared resize limit is three at a time', () => {
  assert.equal(RESIZE_SLOTS, 3);
});
