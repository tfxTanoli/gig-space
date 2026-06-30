import { useState, useEffect, type FormEvent } from 'react';
import Logo from './Logo';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { ref as dbRef, get } from 'firebase/database';
import { auth, database } from './firebase';
import { useAuth } from './AuthContext';

const b64url = (buf: Uint8Array) =>
  btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const generateCodeVerifier = () => { const a = new Uint8Array(32); crypto.getRandomValues(a); return b64url(a); };
const generateCodeChallenge = async (v: string) =>
  b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));

const errorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/popup-blocked': '',
  'auth/redirect-lost': 'Google sign-in could not be completed. Please try again.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'auth/unauthorized-domain': 'This domain is not authorised for Google sign-in.',
  'auth/operation-not-allowed': 'Google sign-in is not enabled. Please contact support.',
};

const getErrorMessage = (code: string) =>
  errorMessages[code] ?? 'Something went wrong. Please try again.';

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Honour the admin "Allow New Signups" toggle (Settings → User Registration).
  const [signupsClosed, setSignupsClosed] = useState(false);
  useEffect(() => {
    get(dbRef(database, 'settings/registration/allowNewSignups')).then((snap) => {
      if (snap.exists() && snap.val() === false) setSignupsClosed(true);
    }).catch(() => {});
  }, []);

  const next = searchParams.get('next');

  // As soon as auth resolves with a signed-in user, navigate away.
  // This fires for popup sign-in, email sign-up, and redirect returns.
  useEffect(() => {
    if (authLoading || !user) return;
    if (!userProfile?.accountType) {
      navigate(next ? `/account-type?next=${encodeURIComponent(next)}` : '/account-type');
    } else {
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
    }
  }, [user, userProfile, authLoading, navigate, next]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Send a verification email so the account can earn its "Verified" badge.
      // Non-fatal if it fails — the user can resend later.
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // ignore — account is created regardless
      }
      // useEffect above handles navigation once onAuthStateChanged fires
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      setLoading(false);
    }
  };

  // Display any OAuth error stored by AuthCallback after returning from Google.
  useEffect(() => {
    const code = sessionStorage.getItem('authRedirectError');
    if (!code) return;
    sessionStorage.removeItem('authRedirectError');
    const msg = getErrorMessage(code);
    if (msg) setError(msg);
  }, []);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateCodeVerifier();

      sessionStorage.setItem('oauthCodeVerifier', codeVerifier);
      sessionStorage.setItem('oauthState', state);

      if (next) sessionStorage.setItem('oauthNext', next);

      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
        redirect_uri: `${window.location.origin}/auth/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (signupsClosed) {
    return (
      <div className="min-h-screen flex flex-col pt-8 px-8 lg:px-16 items-center">
        <div className="w-full max-w-7xl flex items-center mb-10 lg:mb-16">
          <Logo className="h-6" />
        </div>
        <div className="w-full max-w-md text-center mt-10 space-y-3">
          <h1 className="text-2xl font-bold text-white">Registration is currently closed</h1>
          <p className="text-slate-400 text-sm">New sign-ups are temporarily disabled. Please check back soon.</p>
          <Link to="/signin" className="inline-block text-blue-400 hover:text-blue-300 text-sm transition-colors">Already have an account? Sign in →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pt-8 px-8 lg:px-16 items-center">
      <div className="w-full max-w-7xl flex items-center mb-10 lg:mb-16">
        <Logo className="h-6" />
      </div>

      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-white mb-6">
          Create your Gigspace account
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            {error}
          </div>
        )}

        <form className="space-y-6" autoComplete="off" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface-raised border border-slate-700/50 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface-raised border border-slate-700/50 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || authLoading}
            className="w-full bg-primary hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-8 relative flex items-center">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">or</span>
          <div className="flex-grow border-t border-slate-700"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading || authLoading}
          className="mt-8 w-full flex items-center justify-center bg-surface-raised hover:bg-surface-raised-hover disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700/50 text-white font-medium py-3 px-4 rounded-md transition-colors"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-8 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to={next ? `/signin?next=${encodeURIComponent(next)}` : '/signin'} className="text-primary hover:text-blue-400 font-semibold transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
