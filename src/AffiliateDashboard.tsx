import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Home, DollarSign, Settings, RefreshCw, Bell, Menu, X } from 'lucide-react';
import LocationIcon from './LocationIcon';
import { CurrentUserAvatar } from './UserAvatar';
import { useAuth } from './AuthContext';
import AffiliateHomeTab from './affiliate/AffiliateHomeTab';
import AffiliatePayoutsTab from './affiliate/AffiliatePayoutsTab';
import AffiliateSettingsTab from './affiliate/AffiliateSettingsTab';

const TABS = [
  { name: 'Home',     Icon: Home,        subtitle: 'Overview & stats'     },
  { name: 'Payouts',  Icon: DollarSign,  subtitle: 'Earnings & payouts'   },
  { name: 'Settings', Icon: Settings,    subtitle: 'Profile & account'    },
] as const;

type TabName = typeof TABS[number]['name'];

const AffiliateDashboard = () => {
  const { userProfile, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Allow ?tab=Payouts etc. from return URLs (e.g. Stripe Connect callback)
  const tabParam = searchParams.get('tab') as TabName | null;
  const validTab = TABS.find(t => t.name === tabParam)?.name ?? 'Home';
  const [activeTab, setActiveTab] = useState<TabName>(validTab);

  useEffect(() => {
    if (tabParam && TABS.find(t => t.name === tabParam)) {
      setActiveTab(tabParam);
      // Clean the tab param from the URL without a page reload
      setSearchParams(prev => { prev.delete('tab'); prev.delete('connect_refresh'); return prev; }, { replace: true });
    }
  }, [tabParam, setSearchParams]);

  const navigate = (tab: TabName) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const renderTab = () => {
    if (activeTab === 'Home')     return <AffiliateHomeTab />;
    if (activeTab === 'Payouts')  return <AffiliatePayoutsTab />;
    if (activeTab === 'Settings') return <AffiliateSettingsTab />;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside className="w-64 bg-[#111827] flex-col shrink-0 border-r border-slate-800 hidden md:flex">

        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/60">
          <Link to="/" className="flex items-center gap-1">
            <LocationIcon className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight text-white">igspace</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {TABS.map(({ name, Icon }) => {
            const active = activeTab === name;
            return (
              <button
                key={name}
                onClick={() => navigate(name)}
                className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600/10 text-primary'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${active ? 'text-primary' : 'text-slate-400'}`} />
                {name}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        {userProfile && (
          <div className="px-4 py-4 border-t border-slate-800 flex items-center gap-3">
            <CurrentUserAvatar size="md" />
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{userProfile.name}</p>
              <p className="text-slate-400 text-xs truncate">@{userProfile.username}</p>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="p-4 border-t border-slate-800 space-y-1">
          <Link
            to="/seller-dashboard"
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5 mr-3" />
            Switch to seller dashboard
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-[#0E1422] border-b border-slate-800 shrink-0">
          <button
            className="md:hidden text-slate-400 hover:text-white mr-3"
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Mobile logo */}
          <Link to="/" className="md:hidden flex items-center gap-1">
            <LocationIcon className="w-5 h-5" />
            <span className="text-base font-bold text-white">igspace</span>
          </Link>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-700" />
            <CurrentUserAvatar size="sm" />
          </div>
        </header>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="md:hidden bg-[#111827] border-b border-slate-800 px-4 py-3 space-y-1 shrink-0">
            {TABS.map(({ name, Icon }) => (
              <button
                key={name}
                onClick={() => navigate(name)}
                className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === name
                    ? 'bg-blue-600/10 text-primary'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {name}
              </button>
            ))}
            <div className="border-t border-slate-800 mt-2 pt-2 space-y-1">
              <Link
                to="/seller-dashboard"
                className="w-full flex items-center px-4 py-3 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5 mr-3" />
                Switch to seller dashboard
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center px-4 py-3 text-sm text-slate-400 hover:text-red-400 transition-colors"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Tab content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderTab()}
        </main>
      </div>
    </div>
  );
};

export default AffiliateDashboard;
