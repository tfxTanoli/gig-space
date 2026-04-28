import { useState, useEffect } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';

export function useSavedServices() {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setSavedIds(new Set()); setLoading(false); return; }
    const unsub = onValue(ref(database, `savedServices/${user.uid}`), (snap) => {
      const ids = new Set<string>();
      snap.forEach((child) => ids.add(child.key!));
      setSavedIds(ids);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const toggleSave = async (serviceId: string) => {
    if (!user) return;
    const path = `savedServices/${user.uid}/${serviceId}`;
    if (savedIds.has(serviceId)) {
      await remove(ref(database, path));
    } else {
      await set(ref(database, path), { savedAt: Date.now() });
    }
  };

  const isSaved = (serviceId: string) => savedIds.has(serviceId);

  return { savedIds, toggleSave, isSaved, loading };
}
