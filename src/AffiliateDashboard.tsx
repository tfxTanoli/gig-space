import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Home, Settings, RefreshCw, Bell, Menu, X } from 'lucide-react';

const PayoutsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 15H3.33333C2.89131 15 2.46738 14.8244 2.15482 14.5118C1.84226 14.1993 1.66667 13.7754 1.66667 13.3333V6.66667C1.66667 6.22464 1.84226 5.80072 2.15482 5.48816C2.46738 5.17559 2.89131 5 3.33333 5H16.6667C17.1087 5 17.5326 5.17559 17.8452 5.48816C18.1577 5.80072 18.3333 6.22464 18.3333 6.66667V10.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.3333 15.8335L15.8333 18.3335L18.3333 15.8335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 10H15.0083" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.8333 13.3335V18.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 10H5.00833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 11.6668C10.9205 11.6668 11.6667 10.9206 11.6667 10.0002C11.6667 9.07969 10.9205 8.3335 10 8.3335C9.07952 8.3335 8.33333 9.07969 8.33333 10.0002C8.33333 10.9206 9.07952 11.6668 10 11.6668Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
import Logo from './Logo';
import { CurrentUserAvatar } from './UserAvatar';
import { useAuth } from './AuthContext';
import AffiliateHomeTab from './affiliate/AffiliateHomeTab';
import AffiliatePayoutsTab from './affiliate/AffiliatePayoutsTab';
import AffiliateSettingsTab from './affiliate/AffiliateSettingsTab';

type TabName = 'Home' | 'Payouts' | 'Settings';

const TABS: Array<{ name: TabName; Icon: React.ComponentType<{ className?: string }>; subtitle: string }> = [
  { name: 'Home',     Icon: Home,        subtitle: 'Overview & stats'     },
  { name: 'Payouts',  Icon: PayoutsIcon, subtitle: 'Earnings & payouts'   },
  { name: 'Settings', Icon: Settings,    subtitle: 'Profile & account'    },
];

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
      <aside className="w-72 bg-[#111827] flex-col shrink-0 border-r border-slate-800 hidden md:flex">

        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/60">
          <Logo className="h-6" />
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
          <span className="md:hidden">
            <Logo className="h-5" />
          </span>

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
