import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { type User, onAuthStateChanged, signOut, getRedirectResult } from 'firebase/auth';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { auth, database } from './firebase';
import { ensureUsernameIndexed } from './username';

export interface UserProfile {
  name: string;
  username: string;
  photoURL: string;
  accountType: 'buyer' | 'seller' | 'affiliate';
  email: string;
  createdAt: number;
  role?: string;
  /** Mirrors Firebase Auth's emailVerified — kept in sync on every load. */
  emailVerified?: boolean;
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
    let usernameSyncedUid: string | null = null;

    // True when the user clicked "Continue with Google" and we're waiting for
    // the OAuth redirect to complete. Prevents onAuthStateChanged(null) from
    // collapsing the spinner before getRedirectResult has had a chance to run.
    let pendingRedirect = !!sessionStorage.getItem('authRedirectPending');

    // Fallback: if Firebase Auth doesn't resolve within 6s (e.g. blocked by
    // browser tracking prevention), treat session as unauthenticated so the
    // app doesn't stay blank forever.
    const fallback = setTimeout(() => {
      pendingRedirect = false;
      sessionStorage.removeItem('authRedirectPending');
      setLoading(false);
    }, 6000);

    const SESSION_TIMEOUT_MS = 48 * 60 * 60 * 1000; // 48 hours

    // Process any pending OAuth redirect result as early as possible —
    // before any child component mounts — so onAuthStateChanged receives the
    // authenticated user instead of null.
    getRedirectResult(auth).then((result) => {
      if (!pendingRedirect) return;
      pendingRedirect = false;
      sessionStorage.removeItem('authRedirectPending');
      if (!result) {
        // Redirect returned but Firebase found no result (cross-site storage
        // issue or user cancelled). Surface a generic error to the sign-in page.
        sessionStorage.setItem('authRedirectError', 'auth/redirect-lost');
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
      // If result exists, onAuthStateChanged fires with the user automatically.
    }).catch((err: any) => {
      if (!pendingRedirect) return;
      pendingRedirect = false;
      sessionStorage.removeItem('authRedirectPending');
      if (err?.code) sessionStorage.setItem('authRedirectError', err.code);
      setUser(null);
      setUserProfile(null);
      setLoading(false);
    });

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      clearTimeout(fallback);
      profileUnsub?.();
      profileUnsub = null;

      if (!firebaseUser) {
        // While a redirect is in flight, hold the spinner.
        // getRedirectResult above will resolve and take over.
        if (pendingRedirect) return;
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // User signed in — redirect (if any) is complete.
      pendingRedirect = false;
      sessionStorage.removeItem('authRedirectPending');

      // Enforce 48-hour session timeout based on the last sign-in time stored
      // in the Firebase Auth token (more reliable than localStorage).
      const lastSignIn = firebaseUser.metadata.lastSignInTime
        ? new Date(firebaseUser.metadata.lastSignInTime).getTime()
        : Date.now();
      if (Date.now() - lastSignIn > SESSION_TIMEOUT_MS) {
        signOut(auth);
        return;
      }

      // Hold the spinner while we load the profile so components never see
      // an intermediate state where user is set but userProfile is still null.
      setLoading(true);
      setUser(firebaseUser);

      const userRef = ref(database, `users/${firebaseUser.uid}`);
      profileUnsub = onValue(userRef, (snapshot) => {
        const profile: UserProfile | null = snapshot.val() ?? null;
        setUserProfile(profile);
        setLoading(false);

        // Keep the stored emailVerified flag in sync with Firebase Auth, so
        // the "Verified" search filter reflects reality (e.g. after the user
        // clicks the verification link). Only writes when it actually drifts.
        if (profile && profile.emailVerified !== firebaseUser.emailVerified) {
          set(
            ref(database, `users/${firebaseUser.uid}/emailVerified`),
            firebaseUser.emailVerified,
          ).catch(() => {
            // non-fatal — will retry on the next load
          });
        }

        // Backfill the usernames index for users whose profile predates it.
        // Runs at most once per session; ensureUsernameIndexed only writes
        // when the slot is empty.
        if (profile?.username && usernameSyncedUid !== firebaseUser.uid) {
          usernameSyncedUid = firebaseUser.uid;
          ensureUsernameIndexed(firebaseUser.uid, profile.username).catch(() => {
            // non-fatal — will retry on the next load
          });
        }
      });
    });

    return () => {
      clearTimeout(fallback);
      authUnsub();
      profileUnsub?.();
    };
  }, []);

  // Keep online status and lastSeen current while the user is authenticated.
  useEffect(() => {
    if (!user) return;
    const lastSeenRef = ref(database, `users/${user.uid}/lastSeen`);
    const onlineRef  = ref(database, `users/${user.uid}/online`);

    set(onlineRef, true).catch(() => {});
    const updateLastSeen = () => set(lastSeenRef, Date.now()).catch(() => {});
    updateLastSeen();

    // On tab close / crash / network drop: mark offline and stamp lastSeen on server.
    onDisconnect(onlineRef).set(false).catch(() => {});
    onDisconnect(lastSeenRef).set(serverTimestamp()).catch(() => {});

    const iv = setInterval(updateLastSeen, 60_000);
    return () => {
      clearInterval(iv);
      onDisconnect(onlineRef).cancel().catch(() => {});
      onDisconnect(lastSeenRef).cancel().catch(() => {});
    };
  }, [user]);

  const logout = useCallback(async () => {
    if (user) {
      // Mark offline and record accurate lastSeen before signing out.
      await Promise.all([
        set(ref(database, `users/${user.uid}/online`), false),
        set(ref(database, `users/${user.uid}/lastSeen`), Date.now()),
      ]).catch(() => {});
    }
    return signOut(auth);
  }, [user]);

  const value = useMemo(
    () => ({ user, userProfile, loading, logout }),
    [user, userProfile, loading, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen bg-background flex items-center justify-center">
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
