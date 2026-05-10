import { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';

export function useUnreadMessages(mode: 'buyer' | 'seller'): number {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  // Ref-based debounce: batch rapid updates (e.g. multiple convs updating at once)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    const field = mode === 'buyer' ? 'unreadBuyer' : 'unreadSeller';
    const convIdsRef = ref(database, `userConversations/${user.uid}`);
    const fieldListeners: Record<string, () => void> = {};
    const counts: Record<string, number> = {};

    const recompute = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setTotalUnread(Object.values(counts).reduce((s, n) => s + n, 0));
      }, 50);
    };

    const idsUnsub = onValue(convIdsRef, (snap) => {
      if (!snap.exists()) {
        setTotalUnread(0);
        return;
      }
      const ids = Object.keys(snap.val());

      // Remove stale listeners
      Object.keys(fieldListeners).forEach(id => {
        if (!ids.includes(id)) {
          fieldListeners[id]();
          delete fieldListeners[id];
          delete counts[id];
        }
      });

      // Add new listeners only for new conversations
      ids.forEach(id => {
        if (fieldListeners[id]) return;
        const fieldRef = ref(database, `conversations/${id}/${field}`);
        fieldListeners[id] = onValue(fieldRef, (s) => {
          counts[id] = s.val() || 0;
          recompute();
        });
      });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      idsUnsub();
      Object.values(fieldListeners).forEach(u => u());
    };
  }, [user, mode]);

  return totalUnread;
}
