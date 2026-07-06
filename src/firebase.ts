import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, signOut } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// ── Admin impersonation ──────────────────────────────────────────────────────
// When an admin impersonates a user, this tab runs the whole app through a
// SECOND Firebase app ("impersonation") whose auth session belongs to the
// impersonated user — so every read/write and API call behaves exactly as that
// user. The admin's own session lives untouched in the default app, so ending
// impersonation just reloads on the default app: the admin is still signed in.
export const IMPERSONATION_FLAG  = 'impersonationActive';
export const IMPERSONATION_NAME  = 'impersonationName';
export const IMPERSONATION_TOKEN = 'impersonationToken';

export const isImpersonating = sessionStorage.getItem(IMPERSONATION_FLAG) === '1';

const app = initializeApp(firebaseConfig);
const activeApp = isImpersonating ? initializeApp(firebaseConfig, 'impersonation') : app;

export const auth = initializeAuth(activeApp, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const database = getDatabase(activeApp);
export const storage = getStorage(activeApp);

/** Begin impersonating a user: stash the custom token and reload into their dashboard. */
export function startImpersonation(token: string, displayName: string, landingPath: string) {
  sessionStorage.setItem(IMPERSONATION_TOKEN, token);
  sessionStorage.setItem(IMPERSONATION_NAME, displayName);
  sessionStorage.setItem(IMPERSONATION_FLAG, '1');
  window.location.href = landingPath; // full reload boots the impersonation app
}

/** End impersonation and return to the admin panel (admin session was never touched). */
export function endImpersonation() {
  sessionStorage.removeItem(IMPERSONATION_FLAG);
  sessionStorage.removeItem(IMPERSONATION_NAME);
  sessionStorage.removeItem(IMPERSONATION_TOKEN);
  if (!isImpersonating) {
    window.location.href = '/admin-dashboard';
    return;
  }
  // Sign the impersonated session out of the secondary app so it can't linger.
  signOut(auth).catch(() => {}).finally(() => {
    window.location.href = '/admin-dashboard';
  });
}

export default app;
