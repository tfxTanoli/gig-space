import { useState, useEffect, type FormEvent } from 'react';
import Logo from './Logo';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from './firebase';

const ConfirmPasswordReset = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get('oobCode') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!oobCode) {
      setCodeValid(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(() => setCodeValid(true))
      .catch(() => setCodeValid(false));
  }, [oobCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
      setTimeout(() => navigate('/signin'), 3000);
    } catch (err: any) {
      if (err.code === 'auth/expired-action-code') {
        setError('This reset link has expired. Please request a new one.');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('This reset link is invalid. Please request a new one.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pt-8 px-8 lg:px-16 items-center">
      <div className="w-full max-w-7xl flex items-center mb-16 lg:mb-32">
        <Logo className="h-6" />
      </div>

      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-4">
          Set new password
        </h1>
        <p className="text-slate-300 text-sm mb-8 leading-relaxed">
          Enter a new password for your account.
        </p>

        {codeValid === false && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            This password reset link is invalid or has expired.{' '}
            <Link to="/reset-password" className="underline font-semibold">
              Request a new one.
            </Link>
          </div>
        )}

        {codeValid === true && !success && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
                {error}
              </div>
            )}
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-[#1A2035] border border-slate-700/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="confirm">
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-[#1A2035] border border-slate-700/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors"
              >
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </>
        )}

        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-md text-green-400 text-sm">
            Password updated successfully! Redirecting to sign in...
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-400">
          Remember your password?{' '}
          <Link to="/signin" className="text-primary hover:text-blue-400 font-semibold transition-colors">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ConfirmPasswordReset;
