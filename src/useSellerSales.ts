import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from './firebase';

/**
 * Completed sales per seller, from the public `sellerSales` node the server
 * increments when a buyer approves a delivery. It drives the "New seller"
 * badge (GIG-74): a post shows it until its seller's first completed sale.
 *
 * One small map shared by every card on the page, cached across mounts so
 * navigating between search and a listing doesn't refetch it. `null` while
 * the first read is in flight.
 */
let cached: Record<string, number> | null = null;

export function useSellerSales(): Record<string, number> | null {
  const [sales, setSales] = useState<Record<string, number> | null>(cached);
  useEffect(
    () =>
      onValue(
        ref(database, 'sellerSales'),
        (snap) => {
          cached = (snap.val() ?? {}) as Record<string, number>;
          setSales(cached);
        },
        // Unreadable (e.g. rules not deployed): stay "unknown" so pages fall back
        // to showing a rating when there is one, rather than guessing "new".
        (err) => console.error('[sellerSales] read failed:', err.message),
      ),
    [],
  );
  return sales;
}

/**
 * A post is from a new seller until that seller has a completed sale. Posts
 * nobody owns yet (unclaimed generated listings) always are.
 */
export function isNewSeller(sellerId: string | undefined, sales: Record<string, number> | null): boolean {
  if (!sellerId) return true;
  return (sales?.[sellerId] ?? 0) === 0;
}
