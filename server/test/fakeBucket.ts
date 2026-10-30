// An in-memory stand-in for the Storage bucket: just enough of the Admin SDK
// surface the server uses, and a record of what was done to it.
import type { Bucket } from '@google-cloud/storage';

export interface StoredObject {
  body: Buffer;
  contentType?: string;
  cacheControl?: string;
  token?: string;
  /** Epoch ms; tests set it to simulate old or in-flight objects. */
  createdAt: number;
}

export class FakeBucket {
  readonly name = 'test-bucket';
  readonly objects = new Map<string, StoredObject>();
  /** Saves to paths matching this fail, like a dropped connection. */
  failSaves: RegExp | null = null;
  /** Deletes of paths matching this fail. */
  failDeletes: RegExp | null = null;
  readonly deleted: string[] = [];
  now = () => Date.now();

  seed(path: string, init: Partial<StoredObject> = {}): void {
    this.objects.set(path, { body: Buffer.from(path), createdAt: this.now(), ...init });
  }

  file(path: string) {
    return {
      name: path,
      save: async (
        body: Buffer,
        opts: { metadata?: { contentType?: string; cacheControl?: string; metadata?: { firebaseStorageDownloadTokens?: string } } } = {},
      ) => {
        if (this.failSaves?.test(path)) throw new Error(`save failed: ${path}`);
        this.objects.set(path, {
          body,
          contentType: opts.metadata?.contentType,
          cacheControl: opts.metadata?.cacheControl,
          token: opts.metadata?.metadata?.firebaseStorageDownloadTokens,
          createdAt: this.now(),
        });
      },
      delete: async (opts: { ignoreNotFound?: boolean } = {}) => {
        if (this.failDeletes?.test(path)) throw new Error(`delete failed: ${path}`);
        const existed = this.objects.delete(path);
        if (existed) this.deleted.push(path);
        else if (!opts.ignoreNotFound) throw new Error(`not found: ${path}`);
      },
      setMetadata: async (md: { cacheControl?: string }) => {
        const o = this.objects.get(path);
        if (!o) throw new Error(`not found: ${path}`);
        if (md.cacheControl !== undefined) o.cacheControl = md.cacheControl;
      },
    };
  }

  /** The Admin SDK's getFiles, minus pagination: every object under a prefix. */
  getFiles = async (opts: { prefix?: string } = {}) => {
    const prefix = opts.prefix ?? '';
    const files = [...this.objects.entries()]
      .filter(([p]) => p.startsWith(prefix))
      .map(([p, o]) => ({
        name: p,
        metadata: { size: String(o.body.length), timeCreated: new Date(o.createdAt).toISOString(), cacheControl: o.cacheControl },
        delete: async (d: { ignoreNotFound?: boolean } = {}) => this.file(p).delete(d),
        setMetadata: async (md: { cacheControl?: string }) => this.file(p).setMetadata(md),
      }));
    return [files];
  };

  /** Typed as the real bucket, which is all the code under test sees. */
  asBucket(): Bucket {
    return this as unknown as Bucket;
  }
}
