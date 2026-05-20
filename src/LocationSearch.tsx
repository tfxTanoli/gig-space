import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Search, Loader2, MapPin } from 'lucide-react';
import { searchLocations, type LocationResult } from './photon';

interface LocationSearchProps {
  value: string;
  onChange: (label: string, coords?: { lat: number; lng: number } | null) => void;
  /** Miles radius for distance filtering. 0 = any distance (no filter). */
  radius?: number;
  onRadiusChange?: (miles: number) => void;
  variant?: 'header' | 'hero';
}

const MAX_DISPLAY_CHARS = 22;

function truncateLabel(label: string): string {
  if (label.length <= MAX_DISPLAY_CHARS) return label;
  return label.slice(0, MAX_DISPLAY_CHARS - 1) + '…';
}

const LocationSearch = ({
  value,
  onChange,
  radius = 0,
  onRadiusChange,
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
        onChange(r.label, coords);
      } else {
        onChange('', null);
        onRadiusChange?.(0);
      }
      setOpen(false);
      setQuery('');
      setResults([]);
    },
    [onChange, onRadiusChange],
  );

  const displayLabel = value ? truncateLabel(value) : 'All locations';

  const triggerClass =
    variant === 'hero'
      ? 'flex items-center w-full md:w-auto px-4 py-2 text-slate-300 hover:text-white transition-colors whitespace-nowrap'
      : 'px-4 border-r border-slate-700 flex items-center cursor-pointer text-slate-300 text-sm h-full bg-[#1A2035] hover:text-white transition-colors whitespace-nowrap rounded-l-lg';

  return (
    <div
      ref={containerRef}
      className={variant === 'hero' ? 'relative w-full md:w-auto' : 'relative shrink-0 h-full'}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerClass}>
        <span className={`${variant === 'hero' ? 'text-sm mr-2' : 'mr-2'} max-w-[120px] truncate`}>
          {displayLabel}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 ${variant === 'hero' ? '' : 'ml-auto'}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Search input */}
          <div className="p-2 border-b border-slate-800">
            <div className="flex items-center bg-[#0E1422] border border-slate-700 rounded-lg px-3 h-9">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a city, state, or country"
                className="flex-1 bg-transparent px-2 text-sm text-white focus:outline-none placeholder-slate-500"
              />
              {loading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" />}
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

          {/* Radius slider — header mode only, when a location is selected */}
          {variant === 'header' && value && (
            <div className="border-t border-slate-800 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">Distance</span>
                <span className="text-xs text-slate-400">
                  {radius === 0 ? 'Any distance' : `Within ${radius} mi`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={radius}
                onChange={(e) => onRadiusChange?.(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Any</span>
                <span>100 mi</span>
              </div>
              {radius > 0 && (
                <button
                  type="button"
                  onClick={() => onRadiusChange?.(0)}
                  className="mt-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Clear distance
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
