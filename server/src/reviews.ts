import * as admin from 'firebase-admin';
import { type Request, type Response } from 'express';

/* ─── Reviews (server-side since the rules review, 2026-10-13) ─────────────────
 * Reviews used to be written straight from the browser, together with the
 * counters they feed: services/{id}/reviewCount + totalStars, serviceReviews
 * and userRatings. The database rules had to let any signed-in user write those
 * counters, so anyone could fake a 5-star rating or put review text back on a
 * post (GIG-74: only real Gigspace reviews). Now this endpoint checks the order
 * and writes everything with the Admin SDK, and the rules lock the counters.
 */

interface ReviewData {
  rating: number;
  text: string;
  reviewerId: string;
  reviewerName: string;
  reviewerPhoto: string;
  reviewedUserId: string;
  timestamp: number;
}

const MAX_TEXT = 2000;

// POST /api/reviews/submit  { orderId, rating, text }  (requires auth)
export async function submitReview(req: Request & { uid?: string }, res: Response): Promise<void> {
  try {
    const uid = req.uid!;
    const { orderId, rating, text } = (req.body ?? {}) as { orderId?: string; rating?: number; text?: string };
    const stars = Number(rating);
    if (!orderId || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      res.status(400).json({ error: 'orderId and a rating from 1 to 5 are required' }); return;
    }
    const body = String(text ?? '').trim().slice(0, MAX_TEXT);

    const db = admin.database();
    const order = (await db.ref(`orders/${orderId}`).get()).val() as {
      buyerId?: string; sellerId?: string; serviceId?: string; serviceTitle?: string; status?: string;
    } | null;
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    const asBuyer = order.buyerId === uid;
    if (!asBuyer && order.sellerId !== uid) { res.status(403).json({ error: 'Not your order' }); return; }
    if (order.status !== 'completed') { res.status(400).json({ error: 'Reviews open once the order is completed' }); return; }

    const key = asBuyer ? 'buyerReview' : 'sellerReview';
    const reviewedUserId = (asBuyer ? order.sellerId : order.buyerId) ?? '';
    if (!asBuyer && !(await db.ref(`reviews/${orderId}/buyerReview`).get()).exists()) {
      res.status(400).json({ error: 'The buyer reviews first' }); return;
    }

    const profile = (await db.ref(`users/${uid}`).get()).val() as { name?: string; photoURL?: string } | null;
    const review: ReviewData = {
      rating: stars,
      text: body,
      reviewerId: uid,
      reviewerName: profile?.name ?? '',
      reviewerPhoto: profile?.photoURL ?? '',
      reviewedUserId,
      timestamp: Date.now(),
    };

    // Claim the slot first, so a double submit can't count twice.
    const claimed = await db.ref(`reviews/${orderId}/${key}`).transaction((current) => (current === null ? review : undefined));
    if (!claimed.committed) { res.status(409).json({ error: 'You have already reviewed this order' }); return; }

    const inc = admin.database.ServerValue.increment;
    const updates: Record<string, unknown> = {
      [`userRatings/${reviewedUserId}/totalStars`]: inc(stars),
      [`userRatings/${reviewedUserId}/reviewCount`]: inc(1),
    };
    // Buyer reviews are shown on the post, so they are copied there too.
    if (asBuyer && order.serviceId) {
      updates[`serviceReviews/${order.serviceId}/${orderId}`] = { ...review, serviceTitle: order.serviceTitle ?? '' };
      if ((await db.ref(`services/${order.serviceId}/sellerId`).get()).exists()) {
        updates[`services/${order.serviceId}/reviewCount`] = inc(1);
        updates[`services/${order.serviceId}/totalStars`] = inc(stars);
      }
    }
    await db.ref().update(updates);
    res.json({ review });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/reviews/submit error:', msg);
    res.status(500).json({ error: msg });
  }
}

// GET /api/services/:id/reviews  (public)
// Buyer reviews for a post whose serviceReviews copy is missing (reviews left
// before that copy existed). The post page used to find them by reading every
// order for the post from the browser, which needed a rule letting any
// signed-in user read all orders. Only review fields are returned, and the
// missing copies are written so the next visit reads them directly.
export async function legacyServiceReviews(req: Request, res: Response): Promise<void> {
  try {
    const serviceId = String(req.params.id ?? '');
    if (!serviceId) { res.status(400).json({ error: 'id is required' }); return; }
    const db = admin.database();
    const service = (await db.ref(`services/${serviceId}`).get()).val() as { title?: string; reviewCount?: number } | null;
    // Only posts whose counter says they have reviews can have legacy ones.
    if (!service || !(Number(service.reviewCount) > 0)) { res.json({ reviews: [] }); return; }

    const orders = await db.ref('orders').orderByChild('serviceId').equalTo(serviceId).get();
    const completed: string[] = [];
    orders.forEach((o) => { if (o.child('status').val() === 'completed') completed.push(o.key!); });
    const snaps = await Promise.all(completed.map((id) => db.ref(`reviews/${id}/buyerReview`).get()));

    const reviews: (ReviewData & { orderId: string; serviceTitle: string })[] = [];
    const heal: Record<string, unknown> = {};
    snaps.forEach((s, i) => {
      if (!s.exists()) return;
      const r = s.val() as ReviewData;
      const entry = {
        rating: Number(r.rating ?? 0), text: String(r.text ?? ''),
        reviewerId: String(r.reviewerId ?? ''), reviewerName: String(r.reviewerName ?? ''),
        reviewerPhoto: String(r.reviewerPhoto ?? ''), reviewedUserId: String(r.reviewedUserId ?? ''),
        timestamp: Number(r.timestamp ?? 0), serviceTitle: service.title ?? '',
      };
      heal[`serviceReviews/${serviceId}/${completed[i]}`] = entry;
      reviews.push({ orderId: completed[i], ...entry });
    });
    if (Object.keys(heal).length) await db.ref().update(heal);
    res.json({ reviews: reviews.sort((a, b) => b.timestamp - a.timestamp) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/services/:id/reviews error:', msg);
    res.status(500).json({ error: msg });
  }
}
