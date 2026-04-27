import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
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
      authUnsub();
      profileUnsub?.();
    };
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
