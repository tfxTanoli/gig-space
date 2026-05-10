import { useState, useEffect } from 'react';
import { ref, onValue, update, get, query, limitToLast, increment } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  relatedId?: string;
  orderId?: string;
  conversationId?: string;
  serviceId?: string;
  isRead: boolean;
  createdAt: number;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Fast single-value listener just for the badge count
    const countUnsub = onValue(
      ref(database, `notificationCounts/${user.uid}/unread`),
      (snap) => setUnreadCount(Math.max(0, snap.val() ?? 0))
    );

    // Limit to last 30 to keep reads cheap
    const notifsUnsub = onValue(
      query(ref(database, `notifications/${user.uid}`), limitToLast(30)),
      (snap) => {
        const items: AppNotification[] = [];
        // NOTE: Firebase's DataSnapshot.forEach() stops iterating if the
        // callback returns a truthy value. `Array.push()` returns the new
        // length (>= 1, always truthy), which would silently cut us off
        // after the first child. Use a block body so the callback returns
        // undefined and iteration continues through all children.
        snap.forEach((child) => {
          items.push({ id: child.key!, ...child.val() });
        });
        setNotifications(items.sort((a, b) => b.createdAt - a.createdAt));
      }
    );

    return () => {
      countUnsub();
      notifsUnsub();
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    const notif = notifications.find((n) => n.id === notificationId);
    if (!notif || notif.isRead) return;
    await update(ref(database), {
      [`notifications/${user.uid}/${notificationId}/isRead`]: true,
      [`notificationCounts/${user.uid}/unread`]: increment(-1),
    });
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;
    const notif = notifications.find((n) => n.id === notificationId);
    if (!notif) return;
    const updates: Record<string, unknown> = {
      [`notifications/${user.uid}/${notificationId}`]: null,
    };
    if (!notif.isRead) {
      updates[`notificationCounts/${user.uid}/unread`] = increment(-1);
    }
    await update(ref(database), updates);
  };

  const markAllAsRead = async () => {
    if (!user) return;

    // Build updates from whatever is locally known to be unread
    const localUnread = notifications.filter((n) => !n.isRead);

    // If local state has unread items, mark them and reset the counter atomically
    if (localUnread.length > 0) {
      const updates: Record<string, unknown> = {
        [`notificationCounts/${user.uid}/unread`]: 0,
      };
      localUnread.forEach((n) => {
        updates[`notifications/${user.uid}/${n.id}/isRead`] = true;
      });
      await update(ref(database), updates);
      return;
    }

    // Fallback: notifications list may still be loading but the counter is > 0.
    // Fetch all notifications from Firebase directly and mark them read.
    const snap = await get(
      query(ref(database, `notifications/${user.uid}`), limitToLast(50))
    );
    if (!snap.exists()) {
      // No notifications in DB — just zero the counter
      await update(ref(database, `notificationCounts/${user.uid}`), { unread: 0 });
      return;
    }

    const updates: Record<string, unknown> = {
      [`notificationCounts/${user.uid}/unread`]: 0,
    };
    snap.forEach((child) => {
      const val = child.val() as { isRead?: boolean };
      if (!val.isRead) {
        updates[`notifications/${user.uid}/${child.key}/isRead`] = true;
      }
    });
    await update(ref(database), updates);
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification };
}
