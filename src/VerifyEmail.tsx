import { useState, useRef, useEffect, type FormEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import Logo from './Logo';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from './firebase';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const { user, loading: authLoading } = useAuth();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Opened without a signed-in user (e.g. direct navigation) → back to sign in.
  useEffect(() => {
    if (!authLoading && !user) navigate('/signin');
  }, [authLoading, user, navigate]);

  const code = digits.join('');

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '');
    setError('');
    setDigits((prev) => {
      const next = [...prev];
      if (v.length > 1) {
        // Multiple characters (fast typing / autofill) — spread across the boxes
        for (let i = 0; i < v.length && index + i < 6; i++) next[index + i] = v[i];
      } else {
        next[index] = v;
      }
      return next;
    });
    if (v) inputsRef.current[Math.min(index + v.length, 5)]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    setError('');
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    inputsRef.current[Math.min(text.length, 5)]?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (code.length !== 6) { setError('Please enter the full 6-digit code.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.verified) {
        setError(data.error || 'Invalid verification code. Please try again.');
        setSubmitting(false);
        return;
      }
      // Refresh so the account's new verified state (and the Verified badge) is reflected.
      await auth.currentUser?.reload().catch(() => {});
      sessionStorage.removeItem('otpPending');
      navigate(next ? `/account-type?next=${encodeURIComponent(next)}` : '/account-type');
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError('');
    setResent(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${API_URL}/api/auth/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      setResent(true);
    } catch {
      setError('Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pt-8 px-8 lg:px-16 items-center">
      <div className="w-full max-w-7xl flex items-center mb-16 lg:mb-32">
        <Logo className="h-6" />
      </div>

      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-4">
          Verify your email
        </h1>
        <p className="text-slate-300 text-sm mb-8 leading-relaxed">
          To continue, please enter the 6-digit verification code sent to your email address.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            {error}
          </div>
        )}
        {resent && !error && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-md text-green-400 text-sm">
            A new code has been sent to your email.
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <label className="text-sm font-medium text-white" htmlFor="code-0">
              Verification Code
            </label>
            <div className="flex gap-3 justify-between">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  ref={(el) => { inputsRef.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={index === 0 ? 6 : 1}
                  value={digit}
                  onChange={(e) => setDigit(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  autoFocus={index === 0}
                  className={`w-12 h-14 text-center text-xl font-semibold bg-surface-raised rounded-md text-white focus:outline-none transition-colors ${
                    digit ? 'border border-primary/50 ring-1 ring-primary/20' : 'border border-slate-700/50'
                  }`}
                />
              ))}
            </div>

            <p className="text-sm text-slate-400">
              Didn't receive a code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="underline hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend'}
              </button>
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full bg-primary hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors"
          >
            {submitting ? 'Verifying…' : 'Submit'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-400">
          Wrong email?{' '}
          <Link to="/signin" className="text-primary hover:text-blue-400 font-semibold transition-colors">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
