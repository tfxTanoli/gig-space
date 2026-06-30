import * as admin from 'firebase-admin';
import { type Response } from 'express';
import { type AdminRequest } from '../middleware/verifyAdmin';
import { sendTransactionalEmail, buildAccountDeactivatedEmail } from '../email';
import { stripe } from '../stripeClient';

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface PlatformSettings {
  general: {
    platformName: string;
    tagline: string;
    supportEmail: string;
    maintenanceMode: boolean;
  };
  fees: {
    platformFeePercent: number;
    minimumWithdrawal: number;
  };
  registration: {
    allowNewSignups: boolean;
    allowSellerRegistrations: boolean;
    requireEmailVerification: boolean;
  };
}

const DEFAULTS: PlatformSettings = {
  general: {
    platformName: 'Gigspace',
    tagline: 'Find the perfect freelance service',
    supportEmail: '',
    maintenanceMode: false,
  },
  fees: {
    platformFeePercent: 5,
    minimumWithdrawal: 10,
  },
  registration: {
    allowNewSignups: true,
    allowSellerRegistrations: true,
    requireEmailVerification: false,
  },
};

function mergeSettings(stored: Partial<PlatformSettings> | null): PlatformSettings {
  return {
    general:      { ...DEFAULTS.general,      ...(stored?.general      ?? {}) },
    fees:         { ...DEFAULTS.fees,         ...(stored?.fees         ?? {}) },
    registration: { ...DEFAULTS.registration, ...(stored?.registration ?? {}) },
  };
}

export async function getSettings(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const snap = await admin.database().ref('settings').get();
    res.json(mergeSettings(snap.val() as Partial<PlatformSettings> | null));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/settings GET error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function updateSettings(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { section, data } = req.body as { section: keyof PlatformSettings; data: Record<string, unknown> };

    if (!section || !data || typeof data !== 'object') {
      res.status(400).json({ error: 'section and data are required' }); return;
    }
    if (!(['general', 'fees', 'registration'] as const).includes(section)) {
      res.status(400).json({ error: 'Invalid section' }); return;
    }

    // Validate fees range
    if (section === 'fees') {
      const fee = Number(data.platformFeePercent);
      const min = Number(data.minimumWithdrawal);
      if (isNaN(fee) || fee < 0 || fee > 50) {
        res.status(400).json({ error: 'platformFeePercent must be 0–50' }); return;
      }
      if (isNaN(min) || min < 1) {
        res.status(400).json({ error: 'minimumWithdrawal must be at least $1' }); return;
      }
    }

    const db = admin.database();
    await db.ref(`settings/${section}`).update(data);

    const snap = await db.ref('settings').get();
    res.json(mergeSettings(snap.val() as Partial<PlatformSettings> | null));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/settings PATCH error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function getStats(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const db = admin.database();
    const [usersSnap, servicesSnap, ordersSnap] = await Promise.all([
      db.ref('users').get(),
      db.ref('services').get(),
      db.ref('orders').get(),
    ]);

    const users: Record<string, unknown> = usersSnap.val() ?? {};
    const services: Record<string, unknown> = servicesSnap.val() ?? {};
    const orders: Record<string, unknown> = ordersSnap.val() ?? {};

    const totalUsers = Object.keys(users).length;
    const totalSellers = Object.values(users).filter(
      (u) => (u as { accountType?: string })?.accountType === 'seller',
    ).length;
    const totalServices = Object.keys(services).length;
    const totalOrders = Object.keys(orders).length;
    const totalRevenue = Object.values(orders)
      .filter((o) => (o as { status?: string })?.status === 'completed')
      .reduce((sum: number, o) => sum + (Number((o as { price?: number })?.price) || 0), 0);

    res.json({ totalUsers, totalSellers, totalServices, totalOrders, totalRevenue });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/stats error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function getUsers(req: AdminRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(String(req.query.limit)) || 20, 100);
    const db = admin.database();
    const snap = await db.ref('users').limitToLast(limit).get();
    const data: Record<string, unknown> = snap.val() ?? {};

    const users = Object.entries(data)
      .map(([uid, u]) => {
        const user = u as Record<string, unknown>;
        return {
          uid,
          name: String(user?.name ?? ''),
          email: String(user?.email ?? ''),
          username: String(user?.username ?? ''),
          photoURL: String(user?.photoURL ?? ''),
          accountType: String(user?.accountType ?? 'buyer'),
          role: String(user?.role ?? 'user'),
          createdAt: Number(user?.createdAt ?? 0),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ users });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/users error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function updateUser(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { uid } = req.params;
    if (!uid) { res.status(400).json({ error: 'uid is required' }); return; }

    const { name, username, accountType, role } = req.body as Record<string, string>;

    if (role !== undefined && !['user', 'admin'].includes(role)) {
      res.status(400).json({ error: 'role must be "user" or "admin"' }); return;
    }
    if (accountType !== undefined && !['buyer', 'seller'].includes(accountType)) {
      res.status(400).json({ error: 'accountType must be "buyer" or "seller"' }); return;
    }
    // Prevent admin from stripping their own admin role
    if (uid === req.uid && role && role !== 'admin') {
      res.status(400).json({ error: 'You cannot remove your own admin role' }); return;
    }

    const db = admin.database();
    const snap = await db.ref(`users/${uid}`).get();
    if (!snap.exists()) { res.status(404).json({ error: 'User not found' }); return; }

    const updates: Record<string, string> = {};
    if (name      !== undefined) updates.name        = String(name).trim();
    if (username  !== undefined) updates.username    = String(username).trim();
    if (accountType !== undefined) updates.accountType = accountType;
    if (role      !== undefined) updates.role        = role;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' }); return;
    }

    await db.ref(`users/${uid}`).update(updates);

    const updated = (await db.ref(`users/${uid}`).get()).val() as Record<string, unknown>;
    res.json({
      uid,
      name:        String(updated?.name        ?? ''),
      email:       String(updated?.email       ?? ''),
      username:    String(updated?.username    ?? ''),
      photoURL:    String(updated?.photoURL    ?? ''),
      accountType: String(updated?.accountType ?? 'buyer'),
      role:        String(updated?.role        ?? 'user'),
      createdAt:   Number(updated?.createdAt   ?? 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/users/:uid PATCH error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function deleteUser(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { uid } = req.params;
    if (!uid) { res.status(400).json({ error: 'uid is required' }); return; }
    if (uid === req.uid) {
      res.status(400).json({ error: 'You cannot delete your own account' }); return;
    }

    // Send deactivation email before deleting (fire-and-forget)
    try {
      const userRecord = await admin.auth().getUser(uid);
      if (userRecord.email) {
        const firstName = (userRecord.displayName || 'there').split(' ')[0];
        await sendTransactionalEmail(
          userRecord.email,
          'Your Gigspace account has been deactivated',
          buildAccountDeactivatedEmail(firstName)
        );
      }
    } catch { /* non-fatal */ }

    // Remove from Firebase Auth (ignore "user not found" — DB cleanup still runs)
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      const code = (authErr as { code?: string }).code;
      if (code !== 'auth/user-not-found') throw authErr;
    }

    await admin.database().ref(`users/${uid}`).remove();
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/users/:uid DELETE error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function getServices(req: AdminRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(String(req.query.limit)) || 20, 100);
    const db = admin.database();
    const snap = await db.ref('services').limitToLast(limit).get();
    const data: Record<string, unknown> = snap.val() ?? {};

    const services = Object.entries(data)
      .map(([id, s]) => {
        const svc = s as Record<string, unknown>;
        const images = Array.isArray(svc?.images) ? (svc.images as string[]) : [];
        return {
          id,
          title:       String(svc?.title      ?? ''),
          sellerName:  String(svc?.sellerName ?? ''),
          price:       Number(svc?.priceMin   ?? svc?.price ?? 0),
          status:      String(svc?.status     ?? 'active'),
          imageUrl:    images[0] ?? null,
          category:    String(svc?.category   ?? ''),
          description: String(svc?.description ?? ''),
          createdAt:   Number(svc?.createdAt  ?? 0),
        };
      })
      .sort((a, b) => b.price - a.price);

    res.json({ services });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/services error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function updateService(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { title, status, price } = req.body as { title?: string; status?: string; price?: number };
    const db = admin.database();
    const snap = await db.ref(`services/${id}`).get();
    if (!snap.exists()) { res.status(404).json({ error: 'Service not found' }); return; }

    const updates: Record<string, unknown> = {};
    if (title  !== undefined) updates.title  = String(title).trim();
    if (status !== undefined) updates.status = String(status);
    if (price  !== undefined) updates.priceMin = Number(price);

    await db.ref(`services/${id}`).update(updates);

    const updated = (await db.ref(`services/${id}`).get()).val() as Record<string, unknown>;
    const images = Array.isArray(updated?.images) ? (updated.images as string[]) : [];
    res.json({
      id,
      title:       String(updated?.title      ?? ''),
      sellerName:  String(updated?.sellerName ?? ''),
      price:       Number(updated?.priceMin   ?? updated?.price ?? 0),
      status:      String(updated?.status     ?? 'active'),
      imageUrl:    images[0] ?? null,
      category:    String(updated?.category   ?? ''),
      description: String(updated?.description ?? ''),
      createdAt:   Number(updated?.createdAt  ?? 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/services/:id PATCH error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function deleteService(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = admin.database();
    const snap = await db.ref(`services/${id}`).get();
    if (!snap.exists()) { res.status(404).json({ error: 'Service not found' }); return; }
    const svc = snap.val() as Record<string, unknown>;
    const subscriptionId = svc.subscriptionId ? String(svc.subscriptionId) : '';

    // 1) Cancel the post's Stripe subscription FIRST, so we never delete a record
    //    that is still billing the seller. Each post carries its own subscription
    //    (quantity = extra locations), so cancelling this one leaves the seller's
    //    other posts untouched — which is exactly the "reduce the future bill"
    //    behaviour requested. An already-cancelled/missing sub is treated as success.
    if (subscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== 'resource_missing') {
          res.status(502).json({ error: 'Could not cancel the post’s Stripe subscription, so it was not deleted. Please retry.' });
          return;
        }
      }
    }

    // 2) Preserve audit history: a post referenced by any order is archived
    //    (hidden from search, profiles and direct view) rather than hard-deleted,
    //    so orders, reviews and dispute records stay intact. Clean posts (drafts,
    //    generated listings, anything with no orders) are removed outright.
    const ordersData = ((await db.ref('orders').get()).val() ?? {}) as Record<string, { serviceId?: string }>;
    const hasOrders = Object.values(ordersData).some((o) => o?.serviceId === id);

    if (hasOrders) {
      await db.ref(`services/${id}`).update({
        status: 'deleted',
        deletedAt: Date.now(),
        deletedBy: req.uid,
        subscriptionId: null,
      });
      res.json({ success: true, archived: true });
    } else {
      await db.ref(`services/${id}`).remove();
      if (svc.sellerId) await db.ref(`users/${String(svc.sellerId)}/posts/${id}`).remove();
      res.json({ success: true, archived: false });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/services/:id DELETE error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function getAffiliates(_req: AdminRequest, res: Response): Promise<void> {
  try {
    const db = admin.database();
    const [usersSnap, affiliatesSnap] = await Promise.all([
      db.ref('users').get(),
      db.ref('affiliates').get(),
    ]);

    const users: Record<string, unknown>     = usersSnap.val()     ?? {};
    const affiliateData: Record<string, unknown> = affiliatesSnap.val() ?? {};

    const affiliates = Object.entries(users)
      .filter(([, u]) => (u as { accountType?: string })?.accountType === 'affiliate')
      .map(([uid, u]) => {
        const user = u as Record<string, unknown>;
        const aff  = (affiliateData[uid] ?? {}) as Record<string, unknown>;
        return {
          uid,
          name:             String(user?.name             ?? ''),
          email:            String(user?.email            ?? ''),
          username:         String(user?.username         ?? ''),
          photoURL:         String(user?.photoURL         ?? ''),
          referralCode:     String(aff?.referralCode      ?? ''),
          totalReferrals:   Number(aff?.totalReferrals    ?? 0),
          lifetimeEarnings: Number(aff?.lifetimeEarnings  ?? 0),
          availableBalance: Number(aff?.availableBalance  ?? 0),
          pendingBalance:   Number(aff?.pendingBalance    ?? 0),
          createdAt:        Number(user?.createdAt        ?? 0),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ affiliates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/affiliates error:', msg);
    res.status(500).json({ error: msg });
  }
}

export async function getOrders(req: AdminRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(String(req.query.limit)) || 20, 100);
    const db = admin.database();
    const snap = await db.ref('orders').limitToLast(limit).get();
    const data: Record<string, unknown> = snap.val() ?? {};

    const orders = Object.entries(data)
      .map(([id, o]) => {
        const order = o as Record<string, unknown>;
        return {
          orderId:    id,
          buyerName:  String(order?.buyerName  ?? ''),
          sellerName: String(order?.sellerName ?? ''),
          status:     String(order?.status     ?? ''),
          amount:     Number(order?.price      ?? 0),
          createdAt:  Number(order?.createdAt  ?? 0),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ orders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/orders error:', msg);
    res.status(500).json({ error: msg });
  }
}

// ─── Order conversation (dispute review) ────────────────────────────────────────
// Returns the buyer⇄seller message thread tied to an order so an admin can review
// what's being disputed. Uses the Admin SDK so it isn't gated by client read rules.
export async function getOrderMessages(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    if (!orderId) { res.status(400).json({ error: 'orderId is required' }); return; }

    const db = admin.database();
    const orderSnap = await db.ref(`orders/${orderId}`).get();
    if (!orderSnap.exists()) { res.status(404).json({ error: 'Order not found' }); return; }

    const order = orderSnap.val() as Record<string, unknown>;
    const convId = order?.conversationId ? String(order.conversationId) : '';
    if (!convId) { res.json({ messages: [], conversationId: '' }); return; }

    const msgsSnap = await db.ref(`messages/${convId}`).get();
    const raw = (msgsSnap.val() ?? {}) as Record<string, Record<string, unknown>>;
    const messages = Object.entries(raw)
      .map(([id, m]) => ({
        id,
        senderId:   String(m?.senderId   ?? ''),
        senderName: String(m?.senderName ?? ''),
        text:       String(m?.text       ?? ''),
        imageURL:   m?.imageURL ? String(m.imageURL) : null,
        type:       String(m?.type       ?? 'text'),
        timestamp:  Number(m?.timestamp ?? m?.createdAt ?? 0),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    res.json({ messages, conversationId: convId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/orders/:orderId/messages error:', msg);
    res.status(500).json({ error: msg });
  }
}

// ─── Deactivate / reactivate (auth-level, reversible) ───────────────────────────
// Soft, reversible alternative to deleteUser: disables the Firebase Auth account
// (blocking sign-in) and mirrors a `disabled` flag into RTDB. Revokes existing
// sessions when deactivating so the user is kicked out immediately.
export async function setUserDisabled(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { uid } = req.params;
    const disabled = Boolean((req.body ?? {}).disabled);
    if (!uid) { res.status(400).json({ error: 'uid is required' }); return; }
    if (uid === req.uid) {
      res.status(400).json({ error: 'You cannot deactivate your own account' }); return;
    }

    const db = admin.database();
    const snap = await db.ref(`users/${uid}`).get();
    if (!snap.exists()) { res.status(404).json({ error: 'User not found' }); return; }

    // Auth-level enforcement (ignore "user not found" so a DB-only record still updates).
    try {
      await admin.auth().updateUser(uid, { disabled });
      if (disabled) await admin.auth().revokeRefreshTokens(uid);
    } catch (authErr) {
      const code = (authErr as { code?: string }).code;
      if (code !== 'auth/user-not-found') throw authErr;
    }

    await db.ref(`users/${uid}`).update({
      disabled,
      disabledAt: disabled ? Date.now() : null,
      disabledBy: disabled ? req.uid : null,
      ...(disabled ? { role: 'user' } : {}),
    });

    // Notify the user when deactivated (fire-and-forget).
    if (disabled) {
      try {
        const rec = await admin.auth().getUser(uid);
        if (rec.email) {
          const firstName = (rec.displayName || 'there').split(' ')[0];
          await sendTransactionalEmail(
            rec.email,
            'Your Gigspace account has been deactivated',
            buildAccountDeactivatedEmail(firstName),
          );
        }
      } catch { /* non-fatal */ }
    }

    res.json({ success: true, disabled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/users/:uid/disabled error:', msg);
    res.status(500).json({ error: msg });
  }
}

// ─── Impersonate ────────────────────────────────────────────────────────────────
// Returns a short-lived custom token the admin's browser exchanges for a session
// as the target user (for customer-support purposes). The route is admin-guarded.
export async function impersonateUser(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { uid } = req.params;
    if (!uid) { res.status(400).json({ error: 'uid is required' }); return; }

    const rec = await admin.auth().getUser(uid).catch(() => null);
    if (!rec) { res.status(404).json({ error: 'User not found' }); return; }
    if (rec.disabled) { res.status(400).json({ error: 'User is deactivated' }); return; }

    const token = await admin.auth().createCustomToken(uid, { impersonatedBy: req.uid });
    res.json({ token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/impersonate error:', msg);
    res.status(500).json({ error: msg });
  }
}

// ─── Create user (buyer / seller) ───────────────────────────────────────────────
function makeUsername(seed: string): string {
  const base = seed.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 16) || 'user';
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function createUser(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, accountType } = (req.body ?? {}) as Record<string, string>;
    if (!email || !password) { res.status(400).json({ error: 'email and password are required' }); return; }
    if (password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }
    const type = accountType === 'seller' ? 'seller' : 'buyer';

    const rec = await admin.auth().createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName: name?.trim() || undefined,
    });

    const profile = {
      name: name?.trim() ?? '',
      email: email.trim().toLowerCase(),
      username: makeUsername(name || email.split('@')[0]),
      photoURL: '',
      accountType: type,
      role: 'user',
      emailVerified: false,
      disabled: false,
      createdAt: Date.now(),
    };
    await admin.database().ref(`users/${rec.uid}`).set(profile);

    res.json({ uid: rec.uid, ...profile });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-exists') { res.status(400).json({ error: 'That email is already in use' }); return; }
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/users POST error:', msg);
    res.status(500).json({ error: msg });
  }
}

// ─── Create affiliate (user + referral code + link) ─────────────────────────────
export async function createAffiliate(req: AdminRequest, res: Response): Promise<void> {
  try {
    const { name, email, password } = (req.body ?? {}) as Record<string, string>;
    if (!email || !password) { res.status(400).json({ error: 'email and password are required' }); return; }
    if (password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }

    const rec = await admin.auth().createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName: name?.trim() || undefined,
    });

    const referralCode = rec.uid.substring(0, 8).toLowerCase();
    const db = admin.database();
    const now = Date.now();

    const profile = {
      name: name?.trim() ?? '',
      email: email.trim().toLowerCase(),
      username: makeUsername(name || email.split('@')[0]),
      photoURL: '',
      accountType: 'affiliate',
      role: 'user',
      emailVerified: false,
      disabled: false,
      createdAt: now,
    };

    await Promise.all([
      db.ref(`users/${rec.uid}`).set(profile),
      db.ref(`affiliates/${rec.uid}`).set({
        referralCode,
        totalClicks: 0,
        totalReferrals: 0,
        pendingBalance: 0,
        availableBalance: 0,
        lifetimeEarnings: 0,
        totalWithdrawn: 0,
        createdAt: now,
      }),
      db.ref(`affiliateCodes/${referralCode}`).set(rec.uid),
    ]);

    res.json({ uid: rec.uid, referralCode, ...profile });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-exists') { res.status(400).json({ error: 'That email is already in use' }); return; }
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('/api/admin/affiliates POST error:', msg);
    res.status(500).json({ error: msg });
  }
}
