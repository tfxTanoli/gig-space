import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { normalizeUsername } from './username';
import type { UsernameStatus } from './useUsernameAvailability';

interface UsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Live availability status — usually from useUsernameAvailability(). */
  status: UsernameStatus;
  /** Error text shown under the field for taken/invalid states. */
  message: string;
  label?: string;
}

/** Presentational username input with live availability feedback. */
const UsernameField = ({ value, onChange, status, message, label = 'Username' }: UsernameFieldProps) => {
  const borderColor =
    status === 'available'
      ? 'border-green-500/60'
      : status === 'taken' || status === 'invalid'
        ? 'border-red-500/60'
        : 'border-slate-700/50';

  return (
    <div className="w-full">
      <label className="block text-white text-sm font-medium mb-2">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(normalizeUsername(e.target.value))}
          autoComplete="off"
          className={`w-full bg-surface-raised border ${borderColor} rounded-lg px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === 'checking' && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
          {status === 'available' && <CheckCircle className="w-5 h-5 text-green-500" />}
          {(status === 'taken' || status === 'invalid') && <AlertCircle className="w-5 h-5 text-red-500" />}
        </span>
      </div>
      {(status === 'taken' || status === 'invalid') && message && (
        <p className="text-red-400 text-sm mt-1.5">{message}</p>
      )}
      {status === 'available' && (
        <p className="text-green-500 text-sm mt-1.5">Username is available.</p>
      )}
    </div>
  );
};

export default UsernameField;
