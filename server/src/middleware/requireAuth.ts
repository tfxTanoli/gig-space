import { type Request, type Response, type NextFunction } from 'express';
import * as admin from 'firebase-admin';

export interface AuthRequest extends Request {
  uid?: string;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.split('Bearer ')[1]);
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
