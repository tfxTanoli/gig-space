/* The database half of removing a post's photos (see mediaCleanup.ts for the
 * rules about what may be removed). Everything here reads before it deletes, and
 * when it cannot read it does nothing: a post is deleted whether or not its
 * files could be, but a file must never be deleted on a guess.
 */
import * as admin from 'firebase-admin';
import { storageBucket } from './storage';
import { purgePostMedia, referencedByPosts, type PostRecord, type Removal } from './mediaCleanup';

/**
 * Every storage path some post still points at, except `exceptId`'s own — the
 * files a removal must leave alone. Throws if the posts cannot be read.
 */
export async function pathsInUse(exceptId?: string): Promise<Set<string>> {
  const snap = await admin.database().ref('services').get();
  return referencedByPosts(snap.val() as Record<string, PostRecord> | null, storageBucket().name, exceptId);
}

/** Whether any order was placed on this post. Orders keep the post's first photo for their history. */
export async function hasOrders(serviceId: string): Promise<boolean> {
  const snap = await admin.database().ref('orders').orderByChild('serviceId').equalTo(serviceId).limitToFirst(1).get();
  return snap.exists();
}

/**
 * Removes a deleted post's files, unless an order still refers to them (its
 * order history shows the photo) or another post uses them (a claimed listing's
 * photos are shared with the seller's new post). Never throws.
 *
 * `exceptId` is the post being removed when its record still exists, so it is
 * not counted as using its own files.
 */
export async function purgeDeletedPostMedia(
  id: string,
  record: PostRecord | null,
  opts: { exceptId?: string } = {},
): Promise<Removal> {
  try {
    if (await hasOrders(id)) {
      return { removed: 0, failed: 0, skipped: "the post has orders, and their history shows its photos" };
    }
    const inUse = await pathsInUse(opts.exceptId);
    return await purgePostMedia(id, record, { inUse });
  } catch (err) {
    console.error(`[media] could not check what else uses the files of ${id}, leaving them: ${err instanceof Error ? err.message : String(err)}`);
    return { removed: 0, failed: 0, skipped: 'could not check what else uses these photos' };
  }
}
