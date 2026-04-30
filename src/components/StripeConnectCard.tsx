import { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, Loader2, Link } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import { getStripeConnectLink, checkConnectStatus } from '../stripe/paymentHelpers';
import type { StripeConnectStatus } from '../stripe/types';

export default function StripeConnectCard() {
  const { user } = useAuth();
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load wallet to get connected account ID
  useEffect(() => {
    if (!user) return;
    const walletRef = ref(database, `wallets/${user.uid}`);
    return onValue(walletRef, (snap) => {
      const wallet = snap.val() as { stripeConnectedAccountId?: string } | null;
      const accountId = wallet?.stripeConnectedAccountId ?? null;
      setStripeAccountId(accountId);

      if (accountId) {
        checkConnectStatus(accountId)
          .then(setStatus)
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, [user]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const url = await getStripeConnectLink();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Stripe. Try again.');
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 flex items-center justify-center min-h-[100px]">
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
      </div>
    );
  }

  const isFullyEnabled = status?.payoutsEnabled && status?.chargesEnabled;

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#635bff]/10 border border-[#635bff]/20 flex items-center justify-center shrink-0">
          <Link className="w-5 h-5 text-[#635bff]" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">Stripe Payout Account</h3>
          <p className="text-slate-500 text-xs mt-0.5">Connect your bank account to receive withdrawals</p>
        </div>
      </div>

      {!stripeAccountId ? (
        /* Not connected */
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">
            Connect a Stripe account to withdraw your available balance directly to your bank.
          </p>
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 text-xs font-semibold mb-0.5">Connection failed</p>
                <p className="text-red-300 text-xs leading-relaxed">
                  {error.includes('dashboard.stripe.com/connect') ? (
                    <>
                      Your Stripe account is not signed up for Connect.{' '}
                      <a
                        href="https://dashboard.stripe.com/connect"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-red-200 hover:text-white"
                      >
                        Click here to enable it
                      </a>
                      , then try again.
                    </>
                  ) : error}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center justify-center gap-2 w-full bg-[#635bff] hover:bg-[#5147e6] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Connect Stripe Account
              </>
            )}
          </button>
        </div>
      ) : isFullyEnabled ? (
        /* Connected and enabled */
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-400 text-sm font-medium">Payouts enabled</span>
        </div>
      ) : (
        /* Connected but onboarding incomplete */
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-yellow-400 text-sm">
              {status?.detailsSubmitted
                ? 'Stripe is reviewing your account'
                : 'Complete your Stripe onboarding to enable payouts'}
            </span>
          </div>
          {!status?.detailsSubmitted && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center justify-center gap-2 w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 disabled:opacity-60 text-yellow-300 text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Complete Onboarding
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
