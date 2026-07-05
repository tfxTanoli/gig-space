import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Home, Settings, RefreshCw, FileText } from 'lucide-react';

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
import { useAuth } from './AuthContext';
import { useAppHeight } from './useAppHeight';
import NotificationBell from './notifications/NotificationBell';
import HeaderUserMenu from './HeaderUserMenu';
import AffiliateHomeTab from './affiliate/AffiliateHomeTab';
import AffiliatePayoutsTab from './affiliate/AffiliatePayoutsTab';
import AffiliateSettingsTab from './affiliate/AffiliateSettingsTab';
import StatementsTab from './components/StatementsTab';

type TabName = 'Home' | 'Payouts' | 'Statements' | 'Settings';

const TABS: Array<{ name: TabName; Icon: React.ComponentType<{ className?: string }>; subtitle: string }> = [
  { name: 'Home',       Icon: Home,        subtitle: 'Overview & stats'      },
  { name: 'Payouts',    Icon: PayoutsIcon, subtitle: 'Earnings & payouts'    },
  { name: 'Statements', Icon: FileText,    subtitle: 'Transaction history'   },
  { name: 'Settings',   Icon: Settings,    subtitle: 'Profile & account'     },
];

const AffiliateDashboard = () => {
  const { logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const shellRef = useRef<HTMLDivElement>(null);
  useAppHeight(shellRef);

  const tabParam = searchParams.get('tab') as TabName | null;
  const validTab = TABS.find(t => t.name === tabParam)?.name ?? 'Home';
  const [activeTab, setActiveTab] = useState<TabName>(validTab);

  useEffect(() => {
    if (tabParam && TABS.find(t => t.name === tabParam)) {
      setActiveTab(tabParam);
      setSearchParams(prev => { prev.delete('tab'); prev.delete('connect_refresh'); return prev; }, { replace: true });
    }
  }, [tabParam, setSearchParams]);

  const navigateTab = (tab: TabName) => {
    setActiveTab(tab);
  };

  const renderTab = () => {
    if (activeTab === 'Home')       return <AffiliateHomeTab />;
    if (activeTab === 'Payouts')    return <AffiliatePayoutsTab />;
    if (activeTab === 'Statements') return <StatementsTab />;
    if (activeTab === 'Settings')   return <AffiliateSettingsTab />;
    return null;
  };

  return (
    <div ref={shellRef} className="h-screen supports-[height:100dvh]:h-dvh overflow-hidden bg-background flex text-white font-sans">

      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside className="w-72 bg-surface flex-col shrink-0 border-r border-slate-800 hidden md:flex">

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
                onClick={() => navigateTab(name)}
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
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-500 transition-colors"
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
        <header className="sticky top-0 z-30 shrink-0 h-16 flex items-center justify-between px-4 md:px-6 bg-background border-b border-slate-800">
          {/* Mobile logo */}
          <span className="md:hidden mr-3 flex items-center">
            <Logo className="h-6" />
          </span>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <NotificationBell
              onNavigate={(tab) => {
                const t = TABS.find(t => t.name === tab);
                if (t) navigateTab(t.name);
              }}
              filterTypes={['referral_order']}
              emptyStateText="You'll be notified about new orders from people you referred."
            />
            <div className="w-px h-6 bg-slate-700" />
            <HeaderUserMenu />
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto overflow-x-hidden overscroll-contain">
          {renderTab()}
        </main>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-slate-800 flex items-center z-40">
        {TABS.map(({ name, Icon }) => {
          const active = activeTab === name;
          return (
            <button
              key={name}
              onClick={() => navigateTab(name)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 transition-colors ${
                active ? 'text-primary' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-medium leading-tight w-full text-center truncate">{name}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default AffiliateDashboard;
