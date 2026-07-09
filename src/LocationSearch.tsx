import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Search, Loader2, MapPin } from 'lucide-react';
import { searchLocations, type LocationResult } from './photon';

interface LocationSearchProps {
  value: string;
  onChange: (label: string, coords?: { lat: number; lng: number } | null, locationType?: 'precise' | 'broad') => void;
  variant?: 'header' | 'hero';
}

const MAX_DISPLAY_CHARS = 32;

function truncateLabel(label: string): string {
  if (label.length <= MAX_DISPLAY_CHARS) return label;
  return label.slice(0, MAX_DISPLAY_CHARS - 1) + '…';
}

const LocationSearch = ({
  value,
  onChange,
  variant = 'header',
}: LocationSearchProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await searchLocations(q, controller.signal);
      if (!controller.signal.aborted) {
        setResults(found);
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const select = useCallback(
    (r: LocationResult | null) => {
      if (r) {
        const coords =
          r.lat !== undefined && r.lng !== undefined ? { lat: r.lat, lng: r.lng } : null;
        onChange(r.label, coords, r.locationType);
      } else {
        onChange('', null);
      }
      setOpen(false);
      setQuery('');
      setResults([]);
    },
    [onChange],
  );

  const displayLabel = value ? truncateLabel(value) : 'All locations';

  const triggerClass =
    variant === 'hero'
      ? 'flex items-center justify-between w-full px-4 py-2.5 md:py-2 text-slate-300 hover:text-white transition-colors whitespace-nowrap'
      // text-base on mobile so this trigger matches the sibling search input,
      // which index.css floors at 16px to stop iOS zoom-on-focus. It's a button,
      // not an input, so that rule can't reach it. Desktop keeps text-sm.
      : 'px-4 flex items-center cursor-pointer text-slate-300 text-base md:text-sm h-full bg-surface-raised hover:text-white transition-colors whitespace-nowrap rounded-l-lg';

  return (
    <div
      ref={containerRef}
      className={variant === 'hero' ? 'relative w-full md:w-auto' : 'relative shrink-0 h-full'}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerClass}>
        <span className={`${variant === 'hero' ? 'text-base md:text-sm mr-2 max-w-[200px]' : 'mr-2 max-w-[120px] md:max-w-[200px]'} truncate`}>
          {displayLabel}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-auto" />
      </button>

      {/* Separates the location field from the search input, matching the hero
          bar on the landing page. A full-height `border-r border-slate-700` used
          to sit on the trigger, but slate-700 (#334155) is all but identical to
          the bar's own surface-raised (#314158) background, so it never read as
          a divider. Short, centred and one step lighter, like the hero's. */}
      {variant === 'header' && (
        <span aria-hidden className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-px h-5 bg-slate-600" />
      )}

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-surface border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Search input */}
          <div className="p-2 border-b border-slate-800">
            <div className="flex items-center bg-slate-700 border border-slate-700 rounded-lg px-3 h-9">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a city, state, or country"
                className="flex-1 bg-transparent px-2 text-sm text-slate-200 focus:outline-none placeholder-slate-400"
              />
              {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => select(null)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                !value
                  ? 'text-white bg-slate-800'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              All locations
            </button>

            {query.trim().length >= 2 && !loading && results.length === 0 && (
              <p className="px-4 py-3 text-xs text-slate-500 italic">No matches found</p>
            )}

            {results.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => select(r)}
                className="w-full flex items-start gap-2 text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <span>{r.label}</span>
              </button>
            ))}
          </div>

        </div>
      )}
    </div>
  );
};

export default LocationSearch;
