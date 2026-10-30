/* ─── Removing photos from Storage (GIG-74) ─────────────────────────────────────
 * Nothing used to delete a file: removing or regenerating a post dropped its
 * database record and left every photo online, readable by anyone holding the
 * URL. When a business asks us to take its post down, "hidden" is not enough.
 *
 * What belongs to a post
 *   listingImages/<postId>/…   generated photos, in every size
 *   services/<postId>/…        photos an admin uploaded from the editor
 *   listingLogos/<postId>.<ext> the logo found on the business's site
 * All three are named by the post's own id, which is unique to it. A seller's
 * own uploads sit under their user id instead
 *   serviceImages/<uid>/…, serviceVideos/<uid>/…
 * so those are removed only when the post's record names them, and only when
 * they are under the post's own seller.
 *
 * A name is not proof of ownership, though. When a business claims a generated
 * listing, the seller's new post is created holding the SAME photo URLs, and the
 * original is only paused. Deleting that original must not take the live post's
 * photos with it. So every removal here is handed `inUse`: every file any other
 * post's record still points at, which is never touched.
 *
 * Everything here is written to fail safe: it refuses on anything ambiguous
 * (a malformed id, a URL it cannot place) instead of guessing, leaves files
 * younger than a grace period alone (an upload may be in flight), and never
 * throws — a post is deleted whether or not its files could be.
 */
import { storageBucket, LONG_CACHE } from './storage';
import { VARIANT_SUFFIX } from './photoVariants';

/**
 * Firebase push keys, which is what post ids are: 20 characters opening with a
 * dash. Anything else is refused, so a folder that merely looks like an id —
 * or an id from some other scheme — can never be swept up by mistake.
 */
const POST_ID = /^-[-0-9A-Za-z_]{19}$/;
const UID = /^[A-Za-z0-9_-]{6,128}$/;
export const isPostId = (id: unknown): id is string => typeof id === 'string' && POST_ID.test(id);
const isUid = (id: unknown): id is string => typeof id === 'string' && UID.test(id);

/** Files younger than this are left alone by the sweep: a save may still be in flight. */
export const GRACE_MS = 10 * 60 * 1000;
/**
 * After an admin saves a post, the photos they just took out are older than the
 * save by definition; this only has to cover another admin's upload that has not
 * been saved yet.
 */
export const PRUNE_GRACE_MS = 2 * 60 * 1000;
/** A year, as set on everything we store. */
const LONG_ENOUGH = 31_536_000;

export interface PostRecord {
  sellerId?: unknown;
  images?: unknown;
  ogImage?: unknown;
  sellerPhotoURL?: unknown;
  video?: unknown;
  videoPoster?: unknown;
}

export interface Removal {
  removed: number;
  failed: number;
  /** Why nothing was done, when that is the case. */
  skipped?: string;
  /** Files left because another post uses them. */
  inUse?: number;
  /** Unused files left because they are too new to be sure no save is in flight. */
  recent?: number;
}

/** What a removal is told not to touch: every storage path some other post still uses. */
export interface InUse {
  inUse: ReadonlySet<string>;
}

interface StoredObject {
  name: string;
  size: number;
  created: number;
  cacheControl: string;
}

/** The object a Storage download URL points at, if it is in our bucket. */
export function storagePathOf(url: unknown, bucketName: string): string | null {
  if (typeof url !== 'string' || !url) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  try {
    if (u.hostname === 'firebasestorage.googleapis.com') {
      const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      return m && m[1] === bucketName ? decodeURIComponent(m[2]) : null;
    }
    if (u.hostname === 'storage.googleapis.com') {
      const m = u.pathname.match(/^\/([^/]+)\/(.+)$/);
      return m && m[1] === bucketName ? decodeURIComponent(m[2]) : null;
    }
  } catch { /* malformed escape */ }
  return null;
}

/** Where a post's own files live. See the header. */
export const postPrefixes = (id: string): string[] => [`listingImages/${id}/`, `services/${id}/`, `listingLogos/${id}.`];

/** The card and thumbnail versions that sit beside a gallery-size photo. */
export function siblingsOf(path: string): string[] {
  if (!path.endsWith(VARIANT_SUFFIX.full)) return [];
  const stem = path.slice(0, -VARIANT_SUFFIX.full.length);
  return [stem + VARIANT_SUFFIX.card, stem + VARIANT_SUFFIX.thumb];
}

async function list(prefix: string): Promise<StoredObject[]> {
  const [files] = await storageBucket().getFiles({ prefix });
  return files.map((f) => ({
    name: f.name,
    size: Number(f.metadata.size ?? 0),
    created: Date.parse(String(f.metadata.timeCreated ?? '')) || 0,
    cacheControl: String(f.metadata.cacheControl ?? ''),
  }));
}

async function inChunks<T>(items: T[], size: number, task: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(task));
}

async function deleteAll(names: string[]): Promise<{ removed: number; failed: number }> {
  const bucket = storageBucket();
  let removed = 0;
  let failed = 0;
  await inChunks(names, 10, async (name) => {
    try {
      await bucket.file(name).delete({ ignoreNotFound: true });
      removed += 1;
    } catch (err) {
      failed += 1;
      console.error(`[media] could not delete ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  return { removed, failed };
}

/** Every storage path a post's record points at, with the sizes that sit beside each photo. */
export function referencedPaths(record: PostRecord, bucketName: string): Set<string> {
  const urls: unknown[] = [
    ...(Array.isArray(record.images) ? record.images : []),
    record.ogImage, record.sellerPhotoURL, record.video, record.videoPoster,
  ];
  const paths = new Set<string>();
  for (const url of urls) {
    const p = storagePathOf(url, bucketName);
    if (!p) continue;
    paths.add(p);
    for (const s of siblingsOf(p)) paths.add(s);
  }
  return paths;
}

/**
 * Every storage path any post's record points at, except `exceptId`'s own: the
 * files that must survive the removal of that post. `posts` is all of /services.
 */
export function referencedByPosts(
  posts: Record<string, PostRecord | null> | null | undefined,
  bucketName: string,
  exceptId?: string,
): Set<string> {
  const all = new Set<string>();
  for (const [id, record] of Object.entries(posts ?? {})) {
    if (id === exceptId || !record || typeof record !== 'object') continue;
    for (const p of referencedPaths(record, bucketName)) all.add(p);
  }
  return all;
}

/**
 * Removes everything a post owns from Storage — for a post that has just been
 * deleted — except files another post still uses. Never throws; the post is
 * gone either way.
 */
export async function purgePostMedia(id: unknown, record: PostRecord | null, opts: InUse): Promise<Removal> {
  if (!isPostId(id)) return { removed: 0, failed: 0, skipped: 'not a post id' };
  try {
    const bucketName = storageBucket().name;
    const names = new Set<string>();
    let failed = 0;

    for (const prefix of postPrefixes(id)) {
      try {
        for (const o of await list(prefix)) names.add(o.name);
      } catch (err) {
        failed += 1;
        console.error(`[media] could not list ${prefix}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // The seller's own uploads are named by their user id, not the post's, so the
    // record has to say which they are — and only the seller's own count, so a
    // record can never be made to point at someone else's files.
    const owner = record?.sellerId;
    if (record && isUid(owner)) {
      const mine = [`serviceImages/${owner}/`, `serviceVideos/${owner}/`];
      const urls = [...(Array.isArray(record.images) ? record.images : []), record.video, record.videoPoster];
      for (const url of urls) {
        const p = storagePathOf(url, bucketName);
        if (p && mine.some((m) => p.startsWith(m))) names.add(p);
      }
    }

    const doomed = [...names].filter((n) => !opts.inUse.has(n));
    const shared = names.size - doomed.length;
    const r = await deleteAll(doomed);
    return { removed: r.removed, failed: r.failed + failed, ...(shared > 0 ? { inUse: shared } : {}) };
  } catch (err) {
    console.error(`[media] could not clear media for ${id}: ${err instanceof Error ? err.message : String(err)}`);
    return { removed: 0, failed: 1 };
  }
}

/**
 * Removes the files in a post's own folders that the post no longer uses — the
 * photos an admin took out in the editor — unless another post uses them.
 * Does nothing unless the record's photos can all be placed in our bucket, so a
 * URL it doesn't understand can never make live photos look unused.
 *
 * A record with no photos is refused unless `allowEmpty` says that is the point
 * (an admin removed every photo): an empty record is also what a bad read looks
 * like.
 */
export async function pruneUnusedMedia(
  id: unknown,
  record: PostRecord | null,
  opts: InUse & { now?: number; graceMs?: number; allowEmpty?: boolean },
): Promise<Removal> {
  if (!isPostId(id)) return { removed: 0, failed: 0, skipped: 'not a post id' };
  if (!record) return { removed: 0, failed: 0, skipped: 'the post could not be read' };
  const images = Array.isArray(record.images) ? record.images : [];
  if (images.length === 0 && !opts.allowEmpty) return { removed: 0, failed: 0, skipped: 'the post has no photos on record' };

  try {
    const bucketName = storageBucket().name;
    if (images.some((u) => storagePathOf(u, bucketName) === null)) {
      return { removed: 0, failed: 0, skipped: 'a photo is hosted somewhere other than our storage' };
    }
    const keep = referencedPaths(record, bucketName);
    const now = opts.now ?? Date.now();
    const grace = opts.graceMs ?? PRUNE_GRACE_MS;

    const unused: string[] = [];
    let shared = 0;
    let recent = 0;
    let failed = 0;
    for (const prefix of postPrefixes(id)) {
      try {
        for (const o of await list(prefix)) {
          if (keep.has(o.name)) continue;
          if (opts.inUse.has(o.name)) shared += 1;
          else if (now - o.created <= grace) recent += 1;
          else unused.push(o.name);
        }
      } catch (err) {
        failed += 1;
        console.error(`[media] could not list ${prefix}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const r = await deleteAll(unused);
    return {
      removed: r.removed,
      failed: r.failed + failed,
      ...(shared > 0 ? { inUse: shared } : {}),
      ...(recent > 0 ? { recent } : {}),
    };
  } catch (err) {
    console.error(`[media] could not prune media for ${id}: ${err instanceof Error ? err.message : String(err)}`);
    return { removed: 0, failed: 1 };
  }
}

// ─── Tidying what is already there ─────────────────────────────────────────────

export interface TidyReport {
  applied: boolean;
  /** Files left behind by posts that no longer exist. */
  orphans: {
    posts: number; files: number; bytes: number; removed: number; failed: number;
    /** Files of a deleted post that a live post still uses, so are kept. */
    keptInUse: number;
    sample: { id: string; files: number; bytes: number }[];
  };
  /** Photos and videos not yet cached for a year. */
  caching: { files: number; updated: number; failed: number };
}

/** Which post a stored file belongs to, going by its name; null when it isn't one of the three shapes. */
function ownerOf(name: string): string | null {
  let id: string | undefined;
  if (name.startsWith('listingImages/') || name.startsWith('services/')) id = name.split('/')[1];
  else if (name.startsWith('listingLogos/')) id = name.slice('listingLogos/'.length).split('.')[0];
  return isPostId(id) ? id : null;
}

const cachedLongEnough = (cacheControl: string): boolean => {
  const m = cacheControl.match(/max-age=(\d+)/);
  return !!m && Number(m[1]) >= LONG_ENOUGH;
};

/**
 * Finds (and, with `apply`, removes) files whose post no longer exists, and
 * gives photos and videos that lack it a year-long cache header.
 *
 * `existingIds` is every key under /services and `inUse` every path any of those
 * posts points at: a file of a deleted post that a live post still uses (a
 * claimed listing's photos, which the seller's new post shares) is not an orphan.
 * An empty `existingIds` — what a failed read looks like — would make every file
 * look orphaned, so it is refused outright. So is a result in which orphans
 * wildly outnumber live posts, unless `force` says an admin has seen the number
 * and wants it anyway.
 */
export async function tidyStorage(
  existingIds: Set<string>,
  opts: InUse & { apply: boolean; force?: boolean; now?: number; graceMs?: number },
): Promise<TidyReport> {
  if (existingIds.size === 0) throw new Error('Refusing to tidy: no posts were found, so every file would look unused.');
  const now = opts.now ?? Date.now();
  const grace = opts.graceMs ?? GRACE_MS;
  const bucket = storageBucket();

  const ownPrefixes = ['listingImages/', 'services/', 'listingLogos/'];
  const cachePrefixes = [...ownPrefixes, 'serviceImages/', 'serviceVideos/'];

  // One listing per prefix, shared by both jobs.
  const listed = new Map<string, StoredObject[]>();
  for (const prefix of cachePrefixes) listed.set(prefix, await list(prefix));

  // ── Files of posts that are gone
  const byPost = new Map<string, { files: string[]; bytes: number }>();
  let keptInUse = 0;
  for (const prefix of ownPrefixes) {
    for (const o of listed.get(prefix) ?? []) {
      const id = ownerOf(o.name);
      if (!id || existingIds.has(id) || now - o.created <= grace) continue;
      if (opts.inUse.has(o.name)) { keptInUse += 1; continue; }
      const entry = byPost.get(id) ?? { files: [], bytes: 0 };
      entry.files.push(o.name);
      entry.bytes += o.size;
      byPost.set(id, entry);
    }
  }
  if (!opts.force && byPost.size > existingIds.size * 3 + 25) {
    throw new Error(`Refusing to tidy: ${byPost.size} posts' files look unused against ${existingIds.size} live posts, which is more likely a bad read than a clean-up.`);
  }

  const orphanNames = [...byPost.values()].flatMap((e) => e.files);
  const orphans: TidyReport['orphans'] = {
    posts: byPost.size,
    files: orphanNames.length,
    bytes: [...byPost.values()].reduce((s, e) => s + e.bytes, 0),
    removed: 0,
    failed: 0,
    keptInUse,
    sample: [...byPost.entries()].slice(0, 8).map(([id, e]) => ({ id, files: e.files.length, bytes: e.bytes })),
  };
  if (opts.apply && orphanNames.length > 0) {
    const r = await deleteAll(orphanNames);
    orphans.removed = r.removed;
    orphans.failed = r.failed;
  }

  // ── Caching: only folders whose files are never overwritten (every name is
  // unique), and not files that are about to be removed anyway.
  const gone = new Set(orphanNames);
  const needCaching: string[] = [];
  for (const objects of listed.values()) {
    for (const o of objects) {
      if (!cachedLongEnough(o.cacheControl) && !gone.has(o.name)) needCaching.push(o.name);
    }
  }
  const caching: TidyReport['caching'] = { files: needCaching.length, updated: 0, failed: 0 };
  if (opts.apply) {
    await inChunks(needCaching, 10, async (name) => {
      try {
        await bucket.file(name).setMetadata({ cacheControl: LONG_CACHE });
        caching.updated += 1;
      } catch (err) {
        caching.failed += 1;
        console.error(`[media] could not set caching on ${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }

  return { applied: opts.apply, orphans, caching };
}
