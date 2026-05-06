import { Search, Menu } from 'lucide-react';
import { CurrentUserAvatar } from '../../UserAvatar';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  onMenuClick?: () => void;
}

const AdminTopbar = ({ search, onSearchChange, searchPlaceholder = 'Search…', onMenuClick }: Props) => (
  <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 bg-[#0E1422] border-b border-slate-800 sticky top-0 z-10">
    {onMenuClick && (
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>
    )}

    <div className="flex items-center gap-2 bg-[#1A2035] border border-slate-700/50 rounded-lg px-3 py-2 flex-1 max-w-xs sm:max-w-sm focus-within:border-slate-600 transition-colors">
      <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none w-full"
      />
    </div>

    <div className="flex items-center gap-3">
      <CurrentUserAvatar size="sm" />
    </div>
  </header>
);

export default AdminTopbar;
