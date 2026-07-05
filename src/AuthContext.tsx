import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { type User, onAuthStateChanged, signOut, getRedirectResult, signInWithCustomToken } from 'firebase/auth';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { auth, database, isImpersonating, endImpersonation, IMPERSONATION_FLAG, IMPERSONATION_NAME, IMPERSONATION_TOKEN } from './firebase';
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
  /** Set by an admin to deactivate the account. Deactivated users are signed out on load. */
  disabled?: boolean;
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

    // True while an admin-impersonation custom-token sign-in is in flight —
    // holds the spinner the same way so ProtectedRoute doesn't bounce off the
    // initial signed-out state of the secondary Firebase app.
    const impersonationToken = sessionStorage.getItem(IMPERSONATION_TOKEN);
    let pendingImpersonation = isImpersonating && !!impersonationToken;

    // Fallback: if Firebase Auth doesn't resolve within 6s (e.g. blocked by
    // browser tracking prevention), treat session as unauthenticated so the
    // app doesn't stay blank forever.
    const fallback = setTimeout(() => {
      pendingRedirect = false;
      pendingImpersonation = false;
      sessionStorage.removeItem('authRedirectPending');
      setLoading(false);
    }, 6000);

    const SESSION_TIMEOUT_MS = 48 * 60 * 60 * 1000; // 48 hours

    // Complete a pending admin impersonation: the custom token minted by the
    // backend signs the impersonated user into this tab's secondary Firebase
    // app. The admin's own session (default app) is never touched.
    if (isImpersonating && impersonationToken) {
      sessionStorage.removeItem(IMPERSONATION_TOKEN);
      signInWithCustomToken(auth, impersonationToken).catch(() => {
        // Token expired/invalid — drop back to the admin panel on next load.
        sessionStorage.removeItem(IMPERSONATION_FLAG);
        sessionStorage.removeItem(IMPERSONATION_NAME);
        pendingImpersonation = false;
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      });
    }

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
        // While a redirect or impersonation sign-in is in flight, hold the
        // spinner — the pending sign-in will resolve and take over.
        if (pendingRedirect || pendingImpersonation) return;
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // User signed in — redirect/impersonation (if any) is complete.
      pendingRedirect = false;
      pendingImpersonation = false;
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

        // Enforce admin deactivation: a deactivated account is signed out
        // immediately and cannot access Gigspace. The sign-in page reads the
        // `authDeactivated` flag to explain why. Admins impersonating a user
        // are exempt so they can inspect deactivated accounts.
        if (profile?.disabled && !isImpersonating) {
          sessionStorage.setItem('authDeactivated', '1');
          setUserProfile(null);
          signOut(auth);
          return;
        }

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

  // Opportunistically claim a pending admin invite (server grants the role only if
  // a pending adminInvite matches the user's verified email). Runs once per session.
  useEffect(() => {
    if (!user || sessionStorage.getItem('adminClaimChecked')) return;
    sessionStorage.setItem('adminClaimChecked', '1');
    user.getIdToken()
      .then((token) => fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/claim-admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }))
      .catch(() => { /* non-fatal — backend may be unreachable */ });
  }, [user]);

  const logout = useCallback(async () => {
    // Signing out while impersonating just ends the impersonation — the admin
    // returns to their panel, still signed in.
    if (isImpersonating) {
      endImpersonation();
      return;
    }
    if (user) {
      // Fire-and-forget — don't block sign-out on presence writes that may
      // hang when the RTDB connection is slow or offline.
      Promise.all([
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
