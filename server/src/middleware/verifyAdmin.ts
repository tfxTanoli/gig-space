import { type Request, type Response, type NextFunction } from 'express';
import * as admin from 'firebase-admin';

export interface AdminRequest extends Request {
  uid?: string;
}

export async function verifyAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let uid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(header.split('Bearer ')[1]);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  try {
    const snap = await admin.database().ref(`users/${uid}/role`).get();
    if (snap.val() !== 'admin') {
      res.status(403).json({ error: 'Forbidden: admin access required' });
      return;
    }
    req.uid = uid;
    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
