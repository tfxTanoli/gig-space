import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User, onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, database } from './firebase';

export interface UserProfile {
  name: string;
  username: string;
  photoURL: string;
  accountType: 'buyer' | 'seller';
  email: string;
  createdAt: number;
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
    let profileUnsub: (() => void) | null = null;

    // Fallback: if Firebase Auth doesn't resolve within 6s (e.g. blocked by
    // browser tracking prevention), treat session as unauthenticated so the
    // app doesn't stay blank forever.
    const fallback = setTimeout(() => setLoading(false), 6000);

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(fallback);
      profileUnsub?.();
      profileUnsub = null;
      setUser(firebaseUser);

      if (!firebaseUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const userRef = ref(database, `users/${firebaseUser.uid}`);
      profileUnsub = onValue(userRef, (snapshot) => {
        setUserProfile(snapshot.val() ?? null);
        setLoading(false);
      });
    });

    return () => {
      clearTimeout(fallback);
      authUnsub();
      profileUnsub?.();
    };
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
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
