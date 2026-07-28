/**
 * Formats a money value with thousands separators, for display after a "$".
 *
 * Keeps whole amounts whole ("4,000") and only shows cents when the value
 * actually has them ("5.30"), so adding separators doesn't also start
 * printing ".00" everywhere it didn't before.
 */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
