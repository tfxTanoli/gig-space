import { useState } from 'react';
import { X, DollarSign, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { requestWithdrawal } from '../stripe/paymentHelpers';

interface WithdrawModalProps {
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

const MINIMUM = 10;

export default function WithdrawModal({ availableBalance, onClose, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const parsed = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed >= MINIMUM && parsed <= availableBalance;

  const handleWithdraw = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      await requestWithdrawal(parsed);
      setDone(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold">Withdraw funds</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
              <p className="text-white font-semibold">Withdrawal initiated!</p>
              <p className="text-slate-400 text-sm text-center">
                ${parsed.toFixed(2)} is on its way to your Stripe account.
                It may take 1–3 business days.
              </p>
            </div>
          ) : (
            <>
              {/* Balance display */}
              <div className="bg-[#0E1422] border border-slate-800 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">Available to withdraw</p>
                <p className="text-2xl font-bold text-white">${availableBalance.toFixed(2)}</p>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Amount (USD)
                </label>
                <div className="flex items-center bg-[#0E1422] border border-slate-700 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors">
                  <DollarSign className="w-4 h-4 text-slate-500 ml-3 mr-1 shrink-0" />
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min={MINIMUM}
                    max={availableBalance}
                    step="0.01"
                    className="flex-1 bg-transparent text-white text-sm py-3 pr-4 focus:outline-none"
                  />
                </div>
                <p className="text-slate-600 text-xs mt-1.5">Minimum withdrawal: ${MINIMUM}.00</p>
              </div>

              {/* Quick select buttons */}
              <div className="flex gap-2 flex-wrap">
                {[25, 50, 100].map((preset) => (
                  preset <= availableBalance && (
                    <button
                      key={preset}
                      onClick={() => setAmount(String(preset))}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ${preset}
                    </button>
                  )
                ))}
                {availableBalance >= MINIMUM && (
                  <button
                    onClick={() => setAmount(String(availableBalance))}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Max
                  </button>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Validation hint */}
              {amount && !isNaN(parsed) && !isValid && (
                <p className="text-yellow-400 text-xs">
                  {parsed < MINIMUM
                    ? `Minimum withdrawal is $${MINIMUM}.`
                    : `Amount exceeds your available balance ($${availableBalance.toFixed(2)}).`}
                </p>
              )}

              {/* Submit */}
              <button
                onClick={handleWithdraw}
                disabled={!isValid || loading}
                className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  `Withdraw $${isValid ? parsed.toFixed(2) : '—'}`
                )}
              </button>

              <p className="text-slate-600 text-xs text-center">
                Funds will be transferred to your connected Stripe account within 1–3 business days.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
