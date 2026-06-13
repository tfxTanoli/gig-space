import { useState } from 'react';
import { X, Loader2, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { STRIPE_APPEARANCE, STRIPE_FONTS } from '../stripe/stripeAppearance';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

interface CheckoutFormProps {
  offerAmount: number;
  onSuccess: (paymentIntentId: string) => void;
  onClose: () => void;
}

function CheckoutForm({ offerAmount, onSuccess, onClose }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/buyer-dashboard?tab=Orders&payment_intent_redirect=true`,
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? 'Payment failed. Please try again.');
      setPaying(false);
    } else {
      onSuccess(result.paymentIntent?.id ?? '');
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-5 min-h-0">
        {!ready && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: 'tabs',
            wallets: { link: 'never', applePay: 'never', googlePay: 'never' },
            paymentMethodOrder: ['card', 'us_bank_account'],
          }}
        />
        {error && (
          <p className="mt-3 text-red-400 text-sm">{error}</p>
        )}
      </div>

      {ready && (
        <div className="px-5 py-4 border-t border-slate-800 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={paying}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={paying}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-blue-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            {paying ? 'Processing…' : `Pay $${offerAmount}`}
          </button>
        </div>
      )}
    </>
  );
}

interface PaymentModalProps {
  clientSecret: string;
  offerAmount: number;
  serviceTitle: string;
  onClose: () => void;
  onSuccess: (paymentIntentId: string) => void;
}

export default function PaymentModal({
  clientSecret,
  offerAmount,
  serviceTitle,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 bg-surface border border-slate-700 sm:rounded-2xl rounded-t-2xl w-full sm:max-w-md shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="font-semibold text-white text-base">Complete payment</h3>
            <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[280px]">
              {serviceTitle} — ${offerAmount}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-4 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE, fonts: STRIPE_FONTS }}>
          <CheckoutForm offerAmount={offerAmount} onSuccess={onSuccess} onClose={onClose} />
        </Elements>
      </div>
    </div>
  );
}
