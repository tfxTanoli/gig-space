// Username uniqueness helpers. Uniqueness is enforced through a dedicated
// `usernames/{name} -> uid` index in Realtime Database: the `users` collection
// can't be queried by non-admins, so this index is what makes availability
// checks (and the write-time guarantee) possible.

import { ref, get, set, update } from 'firebase/database';
import { database } from './firebase';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Lowercases and strips anything that isn't a-z, 0-9 or underscore. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/** Returns an error message for an (already-normalized) username, or null if valid. */
export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (username.length > USERNAME_MAX) return `Username must be ${USERNAME_MAX} characters or fewer.`;
  if (!/^[a-z0-9_]+$/.test(username)) return 'Use only lowercase letters, numbers and underscores.';
  return null;
}

/** True if `username` is unclaimed, or already owned by `currentUid`. */
export async function isUsernameAvailable(username: string, currentUid?: string): Promise<boolean> {
  const snap = await get(ref(database, `usernames/${username}`));
  if (!snap.exists()) return true;
  return snap.val() === currentUid;
}

/**
 * Claims `username` for `uid`, atomically releasing the user's previous
 * username if one is supplied. Throws 'This username is already taken.' when
 * the name belongs to someone else (the DB rules enforce this too).
 */
export async function claimUsername(
  uid: string,
  username: string,
  previousUsername?: string,
): Promise<void> {
  const normalized = normalizeUsername(username);
  if (!normalized) throw new Error('Invalid username.');

  const snap = await get(ref(database, `usernames/${normalized}`));
  if (snap.exists() && snap.val() !== uid) {
    throw new Error('This username is already taken.');
  }

  const updates: Record<string, unknown> = { [`usernames/${normalized}`]: uid };
  const prev = previousUsername ? normalizeUsername(previousUsername) : '';
  if (prev && prev !== normalized) {
    updates[`usernames/${prev}`] = null;
  }
  await update(ref(database), updates);
}

/**
 * Lazily backfills the index for an existing user whose username predates the
 * index. Safe to call on every load — it only writes when the slot is empty.
 */
export async function ensureUsernameIndexed(uid: string, username: string): Promise<void> {
  const normalized = normalizeUsername(username);
  if (!normalized) return;
  const snap = await get(ref(database, `usernames/${normalized}`));
  if (!snap.exists()) {
    await set(ref(database, `usernames/${normalized}`), uid);
  }
}
