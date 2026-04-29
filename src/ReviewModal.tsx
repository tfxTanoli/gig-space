import { useState, useEffect } from 'react';
import { Star, X, Loader2, CheckCircle } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, text: string) => Promise<void>;
  targetName: string;
  title: string;
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'] as const;
const MAX_CHARS = 500;

export default function ReviewModal({
  isOpen,
  onClose,
  onSubmit,
  targetName,
  title,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const resetAndClose = () => {
    setRating(0);
    setHovered(0);
    setText('');
    setSuccess(false);
    setSubmitting(false);
    setSubmitError('');
    onClose();
  };

  const handleClose = () => {
    if (submitting && !success) return;
    resetAndClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, submitting, success]);

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await onSubmit(rating, text.trim());
      setSuccess(true);
      setTimeout(resetAndClose, 1600);
    } catch (err) {
      setSubmitting(false);
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit review. Please try again.'
      );
    }
  };

  if (!isOpen) return null;

  const displayRating = hovered || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="relative z-10 bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-white font-semibold text-sm">{title}</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Share your experience with {targetName}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting && !success}
            aria-label="Close"
            className="text-slate-400 hover:text-white disabled:opacity-40 transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {success ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-white font-semibold text-sm">Review submitted!</p>
              <p className="text-slate-500 text-xs text-center">
                Thank you for your feedback. It helps the community.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Star rating */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-slate-400 text-sm">How would you rate this experience?</p>
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-label="Star rating"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setRating(star)}
                      disabled={submitting}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400/50 rounded disabled:cursor-not-allowed"
                    >
                      <Star
                        className={`w-9 h-9 transition-colors ${
                          star <= displayRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-700 text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span
                  className={`text-sm font-medium h-5 transition-opacity ${
                    displayRating > 0 ? 'text-amber-400 opacity-100' : 'opacity-0'
                  }`}
                >
                  {LABELS[displayRating]}
                </span>
              </div>

              {/* Text feedback */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 text-sm font-medium">
                    Review{' '}
                    <span className="text-slate-600 font-normal text-xs">(optional)</span>
                  </label>
                  <span
                    className={`text-xs tabular-nums ${
                      text.length > MAX_CHARS * 0.85 ? 'text-amber-400' : 'text-slate-600'
                    }`}
                  >
                    {text.length}/{MAX_CHARS}
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="Share details about your experience…"
                  rows={4}
                  disabled={submitting}
                  className="w-full bg-[#0E1422] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none transition-colors disabled:opacity-50 leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-5 pb-5 space-y-3">
            {submitError && (
              <p className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className="flex-1 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit review'
              )}
            </button>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
