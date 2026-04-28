import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Home,
  Package,
  MessageSquare,
  Bookmark,
  CreditCard,
  Settings,
  RefreshCw,
  Search,
  Bell,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';
import ChatMessages from './ChatMessages';
import { useUnreadMessages } from './useUnreadMessages';
import OrdersTab from './OrdersTab';
import SettingsTab from './SettingsTab';
import SavedTab from './SavedTab';

const BuyerDashboard = () => {
  const { userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadMessages = useUnreadMessages('buyer');

  // Auto-open Messages tab + target conversation from URL params (?tab=Messages&with=userId)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const startChatWith = searchParams.get('with');
  const startChatWithName = searchParams.get('sellerName') || undefined;
  const startChatWithPhoto = searchParams.get('sellerPhoto') || undefined;

  const rawServiceId    = searchParams.get('serviceId');
  const rawServiceTitle = searchParams.get('serviceTitle');
  const rawServiceImage = searchParams.get('serviceImage') || undefined;
  const serviceContext =
    rawServiceId && rawServiceTitle
      ? { serviceId: rawServiceId, serviceTitle: rawServiceTitle, serviceImage: rawServiceImage }
      : undefined;

  const handleStartChatHandled = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('with');
    next.delete('tab');
    next.delete('sellerName');
    next.delete('sellerPhoto');
    setSearchParams(next, { replace: true });
  };

  const handleServiceContextHandled = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('serviceId');
    next.delete('serviceTitle');
    next.delete('serviceImage');
    setSearchParams(next, { replace: true });
  };

  const navItems = [
    { name: 'Home', icon: Home },
    { name: 'Orders', icon: Package },
    { name: 'Messages', icon: MessageSquare },
    { name: 'Saved', icon: Bookmark },
    { name: 'Billing', icon: CreditCard },
    { name: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">

      {/* Sidebar — desktop only */}
      <aside className="w-64 bg-[#111827] flex-col shrink-0 border-r border-slate-800 hidden md:flex">
        <div className="h-16 flex items-center px-6">
          <Link to="/" className="flex items-center">
            <LocationIcon className="w-6 h-6 mr-1" />
            <span className="text-xl font-bold tracking-tight text-white">igspace</span>
          </Link>
        </div>

        {userProfile && (
          <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-3">
            <CurrentUserAvatar size="md" />
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{userProfile.name}</p>
              <p className="text-slate-400 text-xs truncate">@{userProfile.username}</p>
            </div>
          </div>
        )}

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.name;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/10 text-primary'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                {item.name}
                {item.name === 'Messages' && unreadMessages > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-blue-600 text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-1">
          <Link to="/seller-dashboard" className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer">
            <RefreshCw className="w-5 h-5 mr-3" />
            Switch to seller dashboard
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 bg-[#0E1422] border-b border-slate-800">
          {/* Mobile: logo */}
          <Link to="/" className="flex items-center md:hidden mr-3">
            <LocationIcon className="w-5 h-5 mr-1" />
            <span className="text-base font-bold text-white">igspace</span>
          </Link>
          <div className="flex items-center flex-1">
            <Search className="w-4 h-4 md:w-5 md:h-5 text-slate-500 mr-2 md:mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none text-sm text-white focus:outline-none w-full max-w-sm placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button className="text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-700 hidden md:block" />
            <CurrentUserAvatar size="sm" />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 flex flex-col">
          {activeTab === 'Home' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Welcome back{userProfile?.name ? `, ${userProfile.name}` : ''}!
                </h2>
                <p className="text-slate-400 text-sm mt-1">Browse services and manage your orders here.</p>
              </div>
              <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex flex-col items-center justify-center min-h-[300px] gap-4">
                <p className="text-slate-500 text-sm">No orders yet.</p>
                <Link to="/search" className="bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
                  Browse services
                </Link>
              </div>
            </div>
          )}
          {activeTab === 'Messages' && (
            <ChatMessages
              mode="buyer"
              startChatWithUserId={startChatWith}
              startChatWithName={startChatWithName}
              startChatWithPhoto={startChatWithPhoto}
              onStartChatHandled={handleStartChatHandled}
              serviceContext={serviceContext}
              onServiceContextHandled={handleServiceContextHandled}
            />
          )}

          {activeTab === 'Orders' && <OrdersTab mode="buyer" />}
          {activeTab === 'Saved' && <SavedTab />}
          {activeTab === 'Settings' && <SettingsTab mode="buyer" />}

          {activeTab !== 'Home' && activeTab !== 'Messages' && activeTab !== 'Orders' && activeTab !== 'Settings' && (
            <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex items-center justify-center min-h-[400px]">
              <p className="text-slate-500 text-sm">{activeTab} — coming soon</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#111827] border-t border-slate-800 flex items-center z-40">
        {navItems.map((item) => {
          const isActive = activeTab === item.name;
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative transition-colors ${
                isActive ? 'text-primary' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
              {item.name === 'Messages' && unreadMessages > 0 && (
                <span className="absolute top-1.5 right-1/4 translate-x-1/2 text-[9px] font-bold bg-blue-600 text-white min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BuyerDashboard;
