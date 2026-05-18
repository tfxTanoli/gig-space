import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { type User, onAuthStateChanged, signOut, getRedirectResult } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, database } from './firebase';

export interface UserProfile {
  name: string;
  username: string;
  photoURL: string;
  accountType: 'buyer' | 'seller';
  email: string;
  createdAt: number;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let profileUnsub: (() => void) | null = null;
    let authUnsub: (() => void) | null = null;

    const fallback = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 6000);

    const subscribeToAuth = () => {
      if (cancelled) return;
      authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
        clearTimeout(fallback);
        profileUnsub?.();
        profileUnsub = null;

        if (!firebaseUser) {
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setUser(firebaseUser);

        const userRef = ref(database, `users/${firebaseUser.uid}`);
        profileUnsub = onValue(userRef, (snapshot) => {
          setUserProfile(snapshot.val() ?? null);
          setLoading(false);
        });
      });
    };

    // getRedirectResult MUST resolve before onAuthStateChanged is set up.
    // With signInWithRedirect, Firebase only completes the sign-in when
    // getRedirectResult is awaited. If onAuthStateChanged fires first it
    // sees null and drops loading, leaving the user stuck on the sign-in page.
    getRedirectResult(auth)
      .catch(() => {})
      .finally(subscribeToAuth);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      authUnsub?.();
      profileUnsub?.();
    };
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  const value = useMemo(
    () => ({ user, userProfile, loading, logout }),
    [user, userProfile, loading, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen bg-[#0E1422] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Loading…</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
