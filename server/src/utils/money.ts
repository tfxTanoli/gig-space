/**
 * Formats a money value with thousands separators and two decimals
 * ("4,000.00"), for display after a "$".
 *
 * Mirrors `formatMoney` in the frontend's `src/utils/currency.ts` so amounts
 * in emails, notifications and API messages read the same way as they do in
 * the app.
 */
export function formatMoney(amount: number): string {
  return (Number.isFinite(amount) ? amount : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Like {@link formatMoney} but keeps whole amounts whole ("4,000"), for
 * offer and order amounts that are usually round numbers.
 */
export function formatAmount(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
