import * as admin from 'firebase-admin';

/**
 * sellerSales/{uid} is the public count of a seller's completed orders. Posts
 * show "New seller" until it is at least 1 (GIG-74). Clients can read it but
 * never write it.
 *
 * Buyer approval increments it atomically with the order update. Every other
 * way an order's completed status changes (the admin order editor, which is
 * how a dispute is settled) recounts from the orders themselves instead, so
 * moving an order out of Completed lowers it again and the count can't drift.
 */
export async function recountSellerSales(sellerId: string): Promise<number> {
  const db = admin.database();
  const snap = await db.ref('orders').orderByChild('sellerId').equalTo(sellerId).get();
  let completed = 0;
  snap.forEach((order) => {
    if (order.child('status').val() === 'completed') completed++;
  });
  await db.ref(`sellerSales/${sellerId}`).set(completed);
  return completed;
}
