import { useState, useRef, useEffect } from 'react';
import { Search, Menu, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CurrentUserAvatar } from '../../UserAvatar';
import { useAuth } from '../../AuthContext';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  onMenuClick?: () => void;
}

const AdminTopbar = ({ search, onSearchChange, searchPlaceholder = 'Searchâ€¦', onMenuClick }: Props) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleLogout = async () => {
    setShowMenu(false);
    await logout();
    navigate('/signin', { replace: true });
  };

  return (
    <header className="h-16 flex items-center justify-between gap-3 px-4 sm:px-6 bg-background border-b border-slate-800 sticky top-0 z-10">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-center gap-2 bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2 flex-1 max-w-xs sm:max-w-sm focus-within:border-slate-600 transition-colors">
        <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none w-full"
        />
      </div>

      <div className="relative flex items-center gap-3" ref={menuRef}>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="rounded-full ring-2 ring-transparent hover:ring-slate-600 transition-all focus:outline-none focus-visible:ring-blue-500"
          aria-label="Account menu"
        >
          <CurrentUserAvatar size="sm" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-11 w-44 bg-surface border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default AdminTopbar;
