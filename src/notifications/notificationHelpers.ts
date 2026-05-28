import { ref, push, update, increment } from 'firebase/database';
import { database, auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || '';

export type NotificationType =
  | 'message'
  | 'offer'
  | 'offer_accepted'
  | 'delivery'
  | 'revision'
  | 'review'
  | 'referral_order';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  relatedId?: string;
  orderId?: string;
  conversationId?: string;
  serviceId?: string;
}

/**
 * Writes an in-app notification for `recipientUid` and atomically increments
 * their unread count, then fires an email notification in the background.
 */
export async function sendNotification(
  recipientUid: string,
  payload: NotificationPayload
): Promise<void> {
  // ── In-app notification (Firebase Realtime Database) ─────────────────────
  const notifId = push(ref(database, `notifications/${recipientUid}`)).key!;
  await update(ref(database), {
    [`notifications/${recipientUid}/${notifId}`]: {
      ...payload,
      isRead: false,
      createdAt: Date.now(),
    },
    [`notificationCounts/${recipientUid}/unread`]: increment(1),
  });

  // ── Email notification (fire-and-forget — never blocks the caller) ────────
  auth.currentUser?.getIdToken().then((token) => {
    fetch(`${API_URL}/api/notifications/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientUid, payload }),
    }).catch(() => { /* silently ignore email failures */ });
  }).catch(() => { /* no token — skip email */ });
}
