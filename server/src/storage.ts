import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';

type Bucket = ReturnType<ReturnType<typeof admin.storage>['bucket']>;

let bucketForTests: Bucket | null = null;

// Resolved lazily: modules are imported before admin.initializeApp() runs,
// which is where the default bucket gets configured.
export function storageBucket(): Bucket {
  return bucketForTests ?? admin.storage().bucket();
}

/** Swaps in a stand-in bucket so storage logic can be tested without Firebase; null restores the real one. */
export function useBucketForTests(bucket: Bucket | null): void {
  bucketForTests = bucket;
}

/**
 * Everything we write is named once and never overwritten, so browsers can keep
 * it for a year without asking again.
 */
export const LONG_CACHE = 'public, max-age=31536000, immutable';

/** The public download URL of an object, given its firebaseStorageDownloadTokens value. */
export function downloadUrl(bucketName: string, path: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

/**
 * Saves an object and returns its public URL. A download token makes it
 * readable by URL, exactly like a client-side getDownloadURL() upload — no
 * bucket ACL changes needed. Pass the same token for several objects when their
 * URLs need to differ only in the path (see photoVariants.ts).
 */
export async function saveToStorage(
  body: Buffer,
  contentType: string,
  path: string,
  token: string = randomUUID(),
): Promise<string> {
  const bucket = storageBucket();

  await bucket.file(path).save(body, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: LONG_CACHE,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return downloadUrl(bucket.name, path, token);
}
