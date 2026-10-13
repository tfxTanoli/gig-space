import { Moon, Sun } from 'lucide-react';
import { toggleTheme, useTheme } from './theme';

/**
 * Sun/moon switch for the header (GIG-73). Shows a sun in dark mode (click for
 * light) and a moon in light mode (click for dark). The choice is remembered
 * and overrides the device setting from then on.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const toLight = theme === 'dark';
  const label = toLight ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0 ${className}`}
    >
      {toLight ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
