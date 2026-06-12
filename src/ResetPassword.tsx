import { useState, type FormEvent } from 'react';
import Logo from './Logo';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/auth/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always show success to avoid leaking whether an account exists
      setSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
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
          Reset your password
        </h1>
        <p className="text-slate-300 text-sm mb-8 leading-relaxed">
          Enter the email address associated with your account and we'll send you a link to reset your password.
        </p>

        {success ? (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-md text-green-400 text-sm">
            Password reset email sent! Check your inbox and follow the instructions.
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
                {error}
              </div>
            )}
            <form className="space-y-6" onSubmit={handleSubmit}>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors"
              >
                {loading ? 'Sending...' : 'Continue'}
              </button>
            </form>
          </>
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

export default ResetPassword;
