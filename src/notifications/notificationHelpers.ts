import { ref, push, update, increment } from 'firebase/database';
import { database } from '../firebase';

export type NotificationType =
  | 'message'
  | 'offer'
  | 'offer_accepted'
  | 'delivery'
  | 'revision'
  | 'review';

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
 * Writes a notification for `recipientUid` and atomically increments
 * their unread count. Safe to call from any authenticated client.
 */
export async function sendNotification(
  recipientUid: string,
  payload: NotificationPayload
): Promise<void> {
  const notifId = push(ref(database, `notifications/${recipientUid}`)).key!;
  await update(ref(database), {
    [`notifications/${recipientUid}/${notifId}`]: {
      ...payload,
      isRead: false,
      createdAt: Date.now(),
    },
    [`notificationCounts/${recipientUid}/unread`]: increment(1),
  });
}
