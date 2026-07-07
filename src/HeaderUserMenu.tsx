import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, BadgeDollarSign, Settings, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';

const MessagesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.57641 12.7014C1.69894 13.0105 1.72622 13.3492 1.65474 13.6739L0.767243 16.4156C0.738646 16.5546 0.74604 16.6987 0.788722 16.834C0.831405 16.9694 0.907961 17.0916 1.01113 17.1891C1.1143 17.2866 1.24067 17.3562 1.37824 17.3911C1.51582 17.4261 1.66004 17.4253 1.79724 17.3889L4.64141 16.5572C4.94784 16.4965 5.26518 16.523 5.55724 16.6339C7.33673 17.4649 9.35255 17.6407 11.249 17.1303C13.1455 16.6199 14.8008 15.4561 15.9228 13.8442C17.0448 12.2323 17.5615 10.2759 17.3817 8.3202C17.2018 6.36449 16.337 4.53514 14.9398 3.15491C13.5426 1.77468 11.7028 0.932277 9.74506 0.776325C7.78729 0.620374 5.83735 1.1609 4.23928 2.30253C2.6412 3.44416 1.49769 5.11353 1.01049 7.01611C0.523289 8.91869 0.723717 10.9322 1.57641 12.7014Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const HeaderUserMenu = () => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAdmin     = userProfile?.role === 'admin';
  const isAffiliate = !!user && !userProfile;
  const isSeller    = !isAdmin && !isAffiliate && userProfile?.accountType === 'seller';
  const isBuyer     = !isAdmin && !isAffiliate && userProfile?.accountType === 'buyer';

  const dashboardLink = isAffiliate
    ? '/affiliate-dashboard'
    : isAdmin
      ? '/admin-dashboard'
      : isSeller
        ? '/seller-dashboard'
        : '/buyer-dashboard';

  const messagesLink = isSeller
    ? '/seller-dashboard?tab=Messages'
    : '/buyer-dashboard?tab=Messages';

  const settingsLink = isAffiliate
    ? '/affiliate-dashboard?tab=Settings'
    : isSeller
      ? '/seller-dashboard?tab=Settings'
      : '/buyer-dashboard?tab=Settings';

  const displayName = userProfile?.name
    ?? user?.displayName
    ?? user?.email?.split('@')[0]
    ?? 'User';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
    } catch {
      // sign-out failed but still navigate away
    }
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
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-white text-sm font-semibold truncate">{displayName}</p>
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

            {(isSeller || isBuyer) && (
              <Link
                to={messagesLink}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <MessagesIcon className="w-4 h-4 shrink-0 text-slate-500" />
                Messages
              </Link>
            )}

            {!isAdmin && (
              <Link
                to={settingsLink}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-4 h-4 shrink-0 text-slate-500" />
                Settings
              </Link>
            )}

            {(isSeller || isBuyer) && (
              <Link
                to="/affiliate"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <BadgeDollarSign className="w-4 h-4 shrink-0 text-slate-500" />
                Affiliate Program
              </Link>
            )}

            {isAffiliate && (
              <Link
                to="/seller-dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4 shrink-0 text-slate-500" />
                Switch to seller dashboard
              </Link>
            )}
          </div>

          <div className="border-t border-slate-700 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
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
