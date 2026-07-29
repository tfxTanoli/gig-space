/**
 * Money formatting helpers.
 *
 * Every user-facing "$…" in the app should go through one of these so amounts
 * over a thousand always read "$4,000" and never "$4000".
 *
 * Values coming out of Realtime Database are schemaless and occasionally
 * arrive as strings, so each helper coerces before formatting rather than
 * silently rendering an unformatted string.
 */

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formats a money value with thousands separators, for display after a "$".
 *
 * Keeps whole amounts whole ("4,000") and only shows cents when the value
 * actually has them ("5.30"), so adding separators doesn't also start
 * printing ".00" everywhere it didn't before. Use for prices and order
 * amounts, which are usually whole dollars.
 */
export function formatAmount(amount: number | string | null | undefined): string {
  const n = toNumber(amount);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a money value with thousands separators and always two decimals
 * ("4,000.00"). Use for balances, fees and ledger rows, where dropping the
 * cents would look like a rounding error.
 */
export function formatMoney(amount: number | string | null | undefined): string {
  return toNumber(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Adds thousands separators to any "$1234" already embedded in a stored
 * string.
 *
 * Notification bodies are composed once and written to the database, so
 * records created before the formatting fix would otherwise keep rendering
 * "$4000" forever. Applying this at render time repairs the display of
 * existing rows without rewriting them.
 *
 * Only runs of four or more digits are touched, so amounts that are already
 * formatted ("$4,000") are left alone.
 */
export function formatAmountsInText(text: string): string {
  return text.replace(/\$(\d{4,}(?:\.\d{1,2})?)/g, (_, amount: string) => `$${formatAmount(Number(amount))}`);
}
