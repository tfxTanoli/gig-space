import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithRedirect,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// signInWithRedirect requires the app and Firebase's auth handler to share an
// origin (browsers block cross-domain auth storage). Both the Vercel rewrites
// (production) and the Vite dev-server proxy (localhost) serve /__/auth/* from
// the app's own origin, so authDomain points at the current host.
const authDomain =
  typeof window !== 'undefined'
    ? window.location.host
    : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const database = getDatabase(app);
export const storage = getStorage(app);

// Full-page redirect sign-in (Stripe-style).
export const signInWithGoogle = () => {
  const provider = new GoogleAuthProvider();
  return signInWithRedirect(auth, provider);
};

export default app;
