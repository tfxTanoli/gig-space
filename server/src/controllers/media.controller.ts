import * as admin from 'firebase-admin';
import { type Response } from 'express';
import { type AdminRequest } from '../middleware/verifyAdmin';
import { pruneUnusedMedia, purgePostMedia, tidyStorage } from '../mediaCleanup';

// POST /api/admin/services/:id/prune-media
// After an admin saves a post: removes the photos they took out of it from
// Storage, so a photo removed at a business's request is actually gone. Safe to
// call after every save — it does nothing it can't be sure of (see mediaCleanup.ts).
export async function pruneServiceMedia(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const snap = await admin.database().ref(`services/${id}`).get();
    if (!snap.exists()) { res.status(404).json({ error: 'Service not found' }); return; }
    res.json(await pruneUnusedMedia(id, snap.val()));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/services/:id/prune-media error:', msg);
    res.status(500).json({ error: msg });
  }
}

// POST /api/admin/media/tidy   { apply?: boolean }
// Without `apply` it only reports: the files left behind by posts that no longer
// exist, and the photos and videos not yet cached for a year.
export async function tidyMedia(req: AdminRequest, res: Response): Promise<void> {
  try {
    const apply = (req.body as { apply?: unknown } | undefined)?.apply === true;
    const snap = await admin.database().ref('services').get();
    const existing = new Set(Object.keys((snap.val() ?? {}) as Record<string, unknown>));
    res.json(await tidyStorage(existing, { apply }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/media/tidy error:', msg);
    // A refusal is the safety check working, not a server fault.
    res.status(/^Refusing to tidy/.test(msg) ? 409 : 500).json({ error: msg });
  }
}

// POST /api/services/:id/purge-media
// A seller deleting their own post: called just before the post record is
// removed, while it can still be checked that the post is theirs. Admins may
// call it for any post.
export async function purgeOwnPostMedia(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = admin.database();
    const snap = await db.ref(`services/${id}`).get();
    if (!snap.exists()) { res.status(404).json({ error: 'Service not found' }); return; }
    const record = snap.val() as { sellerId?: unknown };

    const isOwner = typeof record.sellerId === 'string' && record.sellerId !== '' && record.sellerId === req.uid;
    if (!isOwner) {
      const role = (await db.ref(`users/${req.uid}/role`).get()).val();
      if (role !== 'admin') { res.status(403).json({ error: 'Not your post' }); return; }
    }
    res.json(await purgePostMedia(id, record));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/services/:id/purge-media error:', msg);
    res.status(500).json({ error: msg });
  }
}
