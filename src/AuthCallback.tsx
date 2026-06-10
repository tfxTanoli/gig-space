import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import { useAuth } from './AuthContext';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile, loading: authLoading } = useAuth();

  // ─── IMPORTANT: this effect must be defined BEFORE the navigation effect.
  // React fires effects in definition order. The navigation effect removes
  // oauthExchangeComplete; if it ran first the guard below would be gone by
  // the time this effect ran, triggering a spurious navigate('/signin').
  useEffect(() => {
    // Guard 1: oauthExchangeInProgress — blocks React StrictMode's second
    //   effect invocation (which fires synchronously before the first async
    //   fetch completes, so the sessionStorage items are already cleared).
    // Guard 2: oauthExchangeComplete — blocks the re-run caused by AuthContext
    //   unmounting/remounting this component while loading the user profile
    //   after signInWithCredential resolves.
    if (
      sessionStorage.getItem('oauthExchangeInProgress') ||
      sessionStorage.getItem('oauthExchangeComplete')
    ) return;
    sessionStorage.setItem('oauthExchangeInProgress', '1');

    const done = () => sessionStorage.removeItem('oauthExchangeInProgress');

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam === 'access_denied') {
      done();
      navigate('/signin');
      return;
    }

    if (!code) {
      done();
      navigate('/signin');
      return;
    }

    const savedState = sessionStorage.getItem('oauthState');
    const codeVerifier = sessionStorage.getItem('oauthCodeVerifier');

    if (!savedState || savedState !== state || !codeVerifier) {
      done();
      sessionStorage.setItem('authRedirectError', 'auth/redirect-lost');
      navigate('/signin');
      return;
    }

    sessionStorage.removeItem('oauthState');
    sessionStorage.removeItem('oauthCodeVerifier');
    sessionStorage.removeItem('authRedirectPending');

    fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
        redirect_uri: `${window.location.origin}/auth/callback`,
        code_verifier: codeVerifier,
      }),
    })
      .then((res) => res.json())
      .then(async (tokens) => {
        if (tokens.error) {
          console.error('[AuthCallback] token error:', tokens.error, '-', tokens.error_description);
          throw new Error(tokens.error_description ?? tokens.error);
        }
        const credential = GoogleAuthProvider.credential(tokens.id_token, tokens.access_token);
        await signInWithCredential(auth, credential);
        done();
        // Mark success so any remount of this component skips the exchange.
        sessionStorage.setItem('oauthExchangeComplete', '1');
      })
      .catch((err: Error) => {
        console.error('[AuthCallback] exchange failed:', err.message);
        done();
        sessionStorage.setItem('authRedirectError', 'auth/redirect-lost');
        navigate('/signin');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate once auth + profile are ready. Defined AFTER the exchange effect
  // so it fires after the guard check above on every mount.
  useEffect(() => {
    if (authLoading || !user) return;
    // Clean up the success marker now that we're leaving this route, so a
    // future sign-in from the same tab can run the exchange again.
    sessionStorage.removeItem('oauthExchangeComplete');
    if (!userProfile?.accountType) {
      navigate('/account-type');
      return;
    }
    const next = sessionStorage.getItem('oauthNext');
    sessionStorage.removeItem('oauthNext');
    if (next && next.startsWith('/')) {
      navigate(next);
      return;
    }
    navigate(
      userProfile.role === 'admin'
        ? '/admin-dashboard'
        : userProfile.accountType === 'seller'
        ? '/seller-dashboard'
        : userProfile.accountType === 'affiliate'
        ? '/affiliate-dashboard'
        : '/buyer-dashboard'
    );
  }, [user, userProfile, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Completing sign-in…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
