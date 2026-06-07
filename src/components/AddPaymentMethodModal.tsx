import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { createSetupIntent } from '../stripe/paymentHelpers';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

// Inter must be explicitly passed into stripe.elements() — the iframe can't inherit from the parent page.
const STRIPE_FONTS = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
];

const APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#3b82f6',
    colorBackground: '#1e293b',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    borderRadius: '8px',
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    fontSizeBase: '14px',
  },
  rules: {
    '.Input': { border: '1px solid #334155', backgroundColor: '#1e293b', padding: '8px 12px' },
    '.Input:focus': { border: '1px solid #3b82f6', boxShadow: 'none', outline: 'none' },
    '.Label': { color: '#94a3b8', fontSize: '12px' },
    '.Tab': { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif', backgroundColor: '#1e293b', border: '1px solid #334155' },
    '.Tab--selected': { backgroundColor: '#1e293b', border: '1px solid #3b82f6', boxShadow: 'none' },
    '.Tab:focus': { boxShadow: 'none' },
  },
};

interface AddPaymentMethodModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPaymentMethodModal({ onClose, onSuccess }: AddPaymentMethodModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const [stripe, { clientSecret }] = await Promise.all([stripePromise, createSetupIntent()]);
        if (!stripe || !active) return;

        stripeRef.current = stripe;
        const elements = stripe.elements({
          clientSecret,
          appearance: APPEARANCE,
          fonts: STRIPE_FONTS,
        });
        elementsRef.current = elements;
        const paymentElement = elements.create('payment', {
          layout: 'tabs',
          wallets: { link: 'never', applePay: 'never', googlePay: 'never' },
          paymentMethodOrder: ['card', 'us_bank_account'],
        });
        paymentElement.mount('#add-payment-element');
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load payment form');
        setLoading(false);
      }
    };

    init();
    return () => { active = false; };
  }, []);

  const handleSave = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setSaving(true);
    setError(null);

    const result = await stripeRef.current.confirmSetup({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? 'Something went wrong. Please try again.');
      setSaving(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 bg-surface border border-slate-700 sm:rounded-2xl rounded-t-2xl w-full sm:max-w-md shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h3 className="font-semibold text-white text-base">Add payment method</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          )}
          <div id="add-payment-element" />
          {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
        </div>

        {!loading && (
          <div className="px-5 py-4 border-t border-slate-800 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save payment method'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
