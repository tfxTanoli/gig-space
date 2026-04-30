import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

interface EmbeddedCheckout {
  mount: (selector: string) => void;
  destroy: () => void;
}

interface StripeWithEmbedded {
  createEmbeddedCheckoutPage: (opts: { clientSecret: string }) => Promise<EmbeddedCheckout>;
}

interface PaymentModalProps {
  clientSecret: string;
  offerAmount: number;
  serviceTitle: string;
  onClose: () => void;
}

export default function PaymentModal({ clientSecret, offerAmount, serviceTitle, onClose }: PaymentModalProps) {
  const [loading, setLoading] = useState(true);
  const checkoutRef = useRef<EmbeddedCheckout | null>(null);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const stripe = await stripePromise;
      if (!stripe || !active) return;

      const checkout = await (stripe as unknown as StripeWithEmbedded).createEmbeddedCheckoutPage({ clientSecret });
      if (!active) {
        checkout.destroy();
        return;
      }

      checkoutRef.current = checkout;
      checkout.mount('#stripe-embedded-checkout');
      setLoading(false);
    };

    init().catch(console.error);

    return () => {
      active = false;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
  }, [clientSecret]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">Complete payment</h3>
            <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[280px]">
              {serviceTitle} — ${offerAmount}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-4 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Checkout body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}
          <div id="stripe-embedded-checkout" />
        </div>
      </div>
    </div>
  );
}
