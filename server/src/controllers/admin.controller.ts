import * as admin from 'firebase-admin';
import { type Response } from 'express';
import { type AdminRequest } from '../middleware/verifyAdmin';

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
        return {
          id,
          title:      String(svc?.title      ?? ''),
          sellerName: String(svc?.sellerName ?? ''),
          price:      Number(svc?.price      ?? 0),
          status:     String(svc?.status     ?? 'active'),
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
