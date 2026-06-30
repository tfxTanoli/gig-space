/**
 * Seed script — inserts dummy buyer reviews for Baseer Khan's first service.
 * Run from the server/ directory:
 *   npx tsx seed-reviews.ts
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env') });

if (!admin.apps.length) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath || !fs.existsSync(credPath)) {
    throw new Error(`serviceAccountKey.json not found at: ${credPath}`);
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, 'utf-8'))),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();
const SELLER_ID = 'ZOQPxpLUvtNtYi0o38qwvvudH4H3';

const DUMMY_REVIEWS = [
  {
    reviewerName: 'Emily Selman',
    reviewerPhoto: '',
    rating: 5,
    text: 'Absolutely fantastic work! Baseer was professional, responsive, and delivered everything ahead of schedule. Highly recommend.',
    daysAgo: 27,
  },
  {
    reviewerName: 'Hector Gibbons',
    reviewerPhoto: '',
    rating: 5,
    text: 'Before working with Baseer I struggled with this task for weeks. He solved it in no time. Outstanding quality and great communication throughout.',
    daysAgo: 44,
  },
  {
    reviewerName: 'Mark Edwards',
    reviewerPhoto: '',
    rating: 4,
    text: 'Very versatile and knowledgeable. Delivered exactly what was asked for. Will definitely come back for future projects.',
    daysAgo: 55,
  },
  {
    reviewerName: 'Sarah Mitchell',
    reviewerPhoto: '',
    rating: 5,
    text: 'Exceeded my expectations in every way. Clean, polished final deliverable with zero revisions needed. A pleasure to work with.',
    daysAgo: 70,
  },
  {
    reviewerName: 'James Okafor',
    reviewerPhoto: '',
    rating: 5,
    text: 'Quick turnaround and top-notch quality. Baseer understood the brief immediately and nailed it on the first attempt.',
    daysAgo: 88,
  },
  {
    reviewerName: 'Priya Nair',
    reviewerPhoto: '',
    rating: 4,
    text: 'Good experience overall. Solid skills and friendly to work with. Minor tweak was needed but handled quickly.',
    daysAgo: 110,
  },
  {
    reviewerName: 'Luca Ferretti',
    reviewerPhoto: '',
    rating: 5,
    text: 'Third time hiring Baseer — consistently delivers high quality. One of the most reliable freelancers on the platform.',
    daysAgo: 140,
  },
  {
    reviewerName: 'Aisha Tanner',
    reviewerPhoto: '',
    rating: 3,
    text: 'Decent work but took a bit longer than the initial estimate. The final result was good enough for our needs.',
    daysAgo: 165,
  },
];

async function run() {
  // 1. Find one of Baseer's services
  const snap = await db.ref('services').orderByChild('sellerId').equalTo(SELLER_ID).limitToFirst(1).get();
  if (!snap.exists()) {
    console.error('No services found for seller', SELLER_ID);
    process.exit(1);
  }

  const serviceId = Object.keys(snap.val())[0];
  const serviceTitle: string = (snap.val()[serviceId] as { title?: string }).title ?? 'Service';
  console.log(`Seeding reviews for service "${serviceTitle}" (${serviceId})`);

  const now = Date.now();
  const DAY_MS = 86_400_000;

  const updates: Record<string, unknown> = {};

  for (const r of DUMMY_REVIEWS) {
    const orderId = db.ref('orders').push().key!;
    const reviewerId = db.ref('users').push().key!; // fake buyer UID
    const timestamp = now - r.daysAgo * DAY_MS;

    updates[`serviceReviews/${serviceId}/${orderId}`] = {
      rating: r.rating,
      text: r.text,
      reviewerId,
      reviewerName: r.reviewerName,
      reviewerPhoto: r.reviewerPhoto,
      reviewedUserId: SELLER_ID,
      timestamp,
      serviceTitle,
    };
  }

  // 2. Compute aggregate totals to add
  const totalStars = DUMMY_REVIEWS.reduce((s, r) => s + r.rating, 0);
  const reviewCount = DUMMY_REVIEWS.length;

  updates[`services/${serviceId}/totalStars`] = admin.database.ServerValue.increment(totalStars);
  updates[`services/${serviceId}/reviewCount`] = admin.database.ServerValue.increment(reviewCount);
  updates[`userRatings/${SELLER_ID}/totalStars`] = admin.database.ServerValue.increment(totalStars);
  updates[`userRatings/${SELLER_ID}/reviewCount`] = admin.database.ServerValue.increment(reviewCount);

  await db.ref().update(updates);

  console.log(`Done — inserted ${reviewCount} reviews (${totalStars} total stars) on service ${serviceId}`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
