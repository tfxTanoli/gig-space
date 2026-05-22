import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, BadgeDollarSign } from 'lucide-react';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';

const HeaderUserMenu = () => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const dashboardLink = userProfile?.role === 'admin'
    ? '/admin-dashboard'
    : userProfile?.accountType === 'seller'
      ? '/seller-dashboard'
      : '/buyer-dashboard';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/search', { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
        aria-label="Open user menu"
        aria-expanded={open}
      >
        <CurrentUserAvatar size="sm" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-white text-sm font-semibold truncate">{userProfile?.name ?? 'User'}</p>
            <p className="text-slate-500 text-xs truncate mt-0.5">{user?.email ?? ''}</p>
          </div>

          <div className="py-1">
            <Link
              to={dashboardLink}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0 text-slate-500" />
              Dashboard
            </Link>
            <Link
              to="/affiliate"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <BadgeDollarSign className="w-4 h-4 shrink-0 text-slate-500" />
              Affiliate Program
            </Link>
          </div>

          <div className="border-t border-slate-800 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-slate-800/80 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderUserMenu;
