import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';

export function useUnreadMessages(mode: 'buyer' | 'seller'): number {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!user) return;

    const field = mode === 'buyer' ? 'unreadBuyer' : 'unreadSeller';
    const convIdsRef = ref(database, `userConversations/${user.uid}`);
    const fieldListeners: Record<string, () => void> = {};
    const counts: Record<string, number> = {};

    const recompute = () =>
      setTotalUnread(Object.values(counts).reduce((s, n) => s + n, 0));

    const idsUnsub = onValue(convIdsRef, (snap) => {
      if (!snap.exists()) {
        setTotalUnread(0);
        return;
      }
      const ids = Object.keys(snap.val());

      Object.keys(fieldListeners).forEach(id => {
        if (!ids.includes(id)) {
          fieldListeners[id]();
          delete fieldListeners[id];
          delete counts[id];
        }
      });

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
      idsUnsub();
      Object.values(fieldListeners).forEach(u => u());
    };
  }, [user, mode]);

  return totalUnread;
}
