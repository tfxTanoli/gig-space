import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Home,
  Package,
  Bookmark,
  CreditCard,
  Settings,
  RefreshCw,
  CheckCircle,
  LayoutDashboard,
  BadgeDollarSign,
  LogOut,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import { verifyCheckoutSession, verifyPaymentIntent } from './stripe/paymentHelpers';
import { CurrentUserAvatar } from './UserAvatar';
import NotificationBell from './notifications/NotificationBell';
import { sendNotification } from './notifications/notificationHelpers';
import ChatMessages from './ChatMessages';
import { useUnreadMessages } from './useUnreadMessages';
import OrdersTab from './OrdersTab';
import SettingsTab from './SettingsTab';
import SavedTab from './SavedTab';
import BillingTab from './components/BillingTab';
import { useSavedServices } from './useSavedServices';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { database } from './firebase';

const MessagesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.57641 12.7014C1.69894 13.0105 1.72622 13.3492 1.65474 13.6739L0.767243 16.4156C0.738646 16.5546 0.74604 16.6987 0.788722 16.834C0.831405 16.9694 0.907961 17.0916 1.01113 17.1891C1.1143 17.2866 1.24067 17.3562 1.37824 17.3911C1.51582 17.4261 1.66004 17.4253 1.79724 17.3889L4.64141 16.5572C4.94784 16.4965 5.26518 16.523 5.55724 16.6339C7.33673 17.4649 9.35255 17.6407 11.249 17.1303C13.1455 16.6199 14.8008 15.4561 15.9228 13.8442C17.0448 12.2323 17.5615 10.2759 17.3817 8.3202C17.2018 6.36449 16.337 4.53514 14.9398 3.15491C13.5426 1.77468 11.7028 0.932277 9.74506 0.776325C7.78729 0.620374 5.83735 1.1609 4.23928 2.30253C2.6412 3.44416 1.49769 5.11353 1.01049 7.01611C0.523289 8.91869 0.723717 10.9322 1.57641 12.7014Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const buyerNavItems = [
  { name: 'Home', icon: Home },
  { name: 'Orders', icon: Package },
  { name: 'Messages', icon: MessagesIcon },
  { name: 'Saved', icon: Bookmark },
  { name: 'Billing', icon: CreditCard },
  { name: 'Settings', icon: Settings },
];

const BuyerDashboard = () => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Home');
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentSuccessToast, setPaymentSuccessToast] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unreadMessages = useUnreadMessages('buyer');
  const { savedIds } = useSavedServices();
  const savedCount = savedIds.size;

  // Active orders count (pending + in_progress)
  const [activeOrderCount, setActiveOrderCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(ref(database, 'orders'), orderByChild('buyerId'), equalTo(user.uid));
    return onValue(q, (snap) => {
      let count = 0;
      snap.forEach((child) => {
        const status = child.val()?.status;
        if (status === 'pending' || status === 'in_progress') count++;
      });
      setActiveOrderCount(count);
    });
  }, [user]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  const handleLogout = useCallback(async () => {
    setShowUserMenu(false);
    await logout();
    navigate('/search', { replace: true });
  }, [logout, navigate]);

  // Auto-open the correct tab from URL params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);

    if (searchParams.get('payment_success') === 'true') {
      const sessionId = searchParams.get('session_id');
      if (sessionId) {
        verifyCheckoutSession(sessionId).catch(console.error);
      }
      setPaymentSuccessToast(true);
      setTimeout(() => setPaymentSuccessToast(false), 5000);

      if (user) {
        sendNotification(user.uid, {
          type: 'offer_accepted',
          title: 'Payment successful',
          body: 'Your payment was processed. Your order is now in progress.',
          senderId: user.uid,
          senderName: userProfile?.name || '',
          senderPhotoURL: userProfile?.photoURL || '',
          dashboardType: 'buyer',
        }).catch(console.error);

        try {
          const raw = sessionStorage.getItem('pendingOfferNotif');
          if (raw) {
            const pending = JSON.parse(raw) as {
              sellerId: string;
              sellerName: string;
              sellerPhotoURL: string;
              conversationId: string;
              price: number;
              serviceTitle: string;
            };
            sendNotification(pending.sellerId, {
              type: 'offer_accepted',
              title: 'Your offer was accepted',
              body: `${userProfile?.name || 'A buyer'} accepted your $${pending.price} offer for "${pending.serviceTitle}"`,
              senderId: user.uid,
              senderName: userProfile?.name || '',
              senderPhotoURL: userProfile?.photoURL || '',
              conversationId: pending.conversationId,
              dashboardType: 'seller',
            }).catch(console.error);
            sessionStorage.removeItem('pendingOfferNotif');
          }
        } catch {
          sessionStorage.removeItem('pendingOfferNotif');
        }
      }

      const next = new URLSearchParams(searchParams);
      next.delete('payment_success');
      next.delete('session_id');
      setSearchParams(next, { replace: true });
    }

    // Fallback for redirect-based payment methods (e.g. iDEAL) that return
    // from the Elements confirmPayment redirect flow.
    const paymentIntentRedirect = searchParams.get('payment_intent_redirect');
    if (paymentIntentRedirect === 'true') {
      const piId = searchParams.get('payment_intent');
      if (piId) {
        verifyPaymentIntent(piId).catch(console.error);
      }
      setPaymentSuccessToast(true);
      setTimeout(() => setPaymentSuccessToast(false), 5000);

      if (user) {
        sendNotification(user.uid, {
          type: 'offer_accepted',
          title: 'Payment successful',
          body: 'Your payment was processed. Your order is now in progress.',
          senderId: user.uid,
          senderName: userProfile?.name || '',
          senderPhotoURL: userProfile?.photoURL || '',
          dashboardType: 'buyer',
        }).catch(console.error);

        try {
          const raw = sessionStorage.getItem('pendingOfferNotif');
          if (raw) {
            const pending = JSON.parse(raw) as {
              sellerId: string; sellerName: string; sellerPhotoURL: string;
              conversationId: string; price: number; serviceTitle: string;
            };
            sendNotification(pending.sellerId, {
              type: 'offer_accepted',
              title: 'Your offer was accepted',
              body: `${userProfile?.name || 'A buyer'} accepted your $${pending.price} offer for "${pending.serviceTitle}"`,
              senderId: user.uid,
              senderName: userProfile?.name || '',
              senderPhotoURL: userProfile?.photoURL || '',
              conversationId: pending.conversationId,
              dashboardType: 'seller',
            }).catch(console.error);
            sessionStorage.removeItem('pendingOfferNotif');
          }
        } catch {
          sessionStorage.removeItem('pendingOfferNotif');
        }
      }

      const next2 = new URLSearchParams(searchParams);
      next2.delete('payment_intent_redirect');
      next2.delete('payment_intent');
      next2.delete('payment_intent_client_secret');
      next2.delete('redirect_status');
      setSearchParams(next2, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleStartChatHandled = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('with');
    next.delete('tab');
    next.delete('sellerName');
    next.delete('sellerPhoto');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleServiceContextHandled = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('serviceId');
    next.delete('serviceTitle');
    next.delete('serviceImage');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const isMessagesTab = activeTab === 'Messages';

  return (
    <div className="h-screen overflow-hidden bg-background flex text-white font-sans">

      {/* Payment success toast */}
      {paymentSuccessToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-emerald-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 pointer-events-none whitespace-nowrap">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Payment successful! Your order is now in progress.
        </div>
      )}

      {/* Sidebar — desktop only */}
      <aside className="w-72 bg-surface flex-col shrink-0 border-r border-slate-800 hidden md:flex">
        <div className="h-16 flex items-center px-6">
          <Logo className="h-6" />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-hidden">
          {buyerNavItems.map((item) => {
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
                  <span className="ml-auto text-[10px] font-bold bg-amber-950 text-amber-500 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
                {item.name === 'Orders' && activeOrderCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-emerald-950 text-emerald-500 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {activeOrderCount > 9 ? '9+' : activeOrderCount}
                  </span>
                )}
                {item.name === 'Saved' && savedCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-blue-950 text-blue-500 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {savedCount > 9 ? '9+' : savedCount}
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
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-500 transition-colors"
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
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 bg-background border-b border-slate-800 shrink-0">
          {/* Mobile: logo */}
          <span className="md:hidden mr-3">
            <Logo className="h-6" />
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-2 md:gap-4">
            <NotificationBell onNavigate={setActiveTab} dashboardType="buyer" />
            <div className="w-px h-6 bg-slate-700 hidden md:block" />

            {/* Avatar with dropdown */}
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full cursor-pointer"
                aria-label="Open user menu"
                aria-expanded={showUserMenu}
              >
                <CurrentUserAvatar size="sm" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-800">
                    <p className="text-white text-sm font-semibold truncate">
                      {userProfile?.name ?? 'User'}
                    </p>
                    <p className="text-slate-500 text-xs truncate mt-0.5">
                      {user?.email ?? ''}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setActiveTab('Home'); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4 shrink-0 text-slate-500" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => { setActiveTab('Messages'); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <MessagesIcon className="w-4 h-4 shrink-0 text-slate-500" />
                      Messages
                    </button>
                    <button
                      onClick={() => { setActiveTab('Saved'); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Bookmark className="w-4 h-4 shrink-0 text-slate-500" />
                      Saved Services
                    </button>
                    <Link
                      to="/affiliate"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <BadgeDollarSign className="w-4 h-4 shrink-0 text-slate-500" />
                      Affiliate Program
                    </Link>
                    <button
                      onClick={() => { setActiveTab('Settings'); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Settings className="w-4 h-4 shrink-0 text-slate-500" />
                      Settings
                    </button>
                  </div>

                  <div className="border-t border-slate-800 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-500 hover:bg-slate-800/80 transition-colors"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Messages tab gets no outer padding/scroll so its internal layout works */}
        <main
          className={`flex-1 flex flex-col min-h-0 ${
            isMessagesTab
              ? 'overflow-hidden'
              : 'p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto overflow-x-hidden'
          }`}
        >
          {activeTab === 'Home' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Welcome back{userProfile?.name ? `, ${userProfile.name}` : ''}!
                </h2>
                <p className="text-slate-400 text-sm mt-1">Browse services and manage your orders here.</p>
              </div>
              <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-background flex flex-col items-center justify-center min-h-[300px] gap-4">
                <p className="text-slate-500 text-sm">No orders yet.</p>
                <Link to="/search" className="bg-primary hover:bg-blue-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors">
                  Browse services
                </Link>
              </div>
            </div>
          )}

          {activeTab === 'Messages' && (
            <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 pb-20 md:pb-6 overflow-hidden">
              <ChatMessages
                mode="buyer"
                startChatWithUserId={startChatWith}
                startChatWithName={startChatWithName}
                startChatWithPhoto={startChatWithPhoto}
                onStartChatHandled={handleStartChatHandled}
                serviceContext={serviceContext}
                onServiceContextHandled={handleServiceContextHandled}
              />
            </div>
          )}

          {activeTab === 'Orders' && <OrdersTab mode="buyer" searchQuery="" />}
          {activeTab === 'Saved' && <SavedTab searchQuery="" />}
          {activeTab === 'Settings' && <SettingsTab mode="buyer" />}
          {activeTab === 'Billing' && <BillingTab />}

          {activeTab !== 'Home' && activeTab !== 'Messages' && activeTab !== 'Orders' && activeTab !== 'Settings' && activeTab !== 'Saved' && activeTab !== 'Billing' && (
            <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-background flex items-center justify-center min-h-[400px]">
              <p className="text-slate-500 text-sm">{activeTab} — coming soon</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-slate-800 flex items-center z-40">
        {buyerNavItems.map((item) => {
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
                <span className="absolute top-1.5 right-1/4 translate-x-1/2 text-[9px] font-bold bg-amber-950 text-amber-500 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
              {item.name === 'Orders' && activeOrderCount > 0 && (
                <span className="absolute top-1.5 right-1/4 translate-x-1/2 text-[9px] font-bold bg-emerald-950 text-emerald-500 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center">
                  {activeOrderCount > 9 ? '9+' : activeOrderCount}
                </span>
              )}
              {item.name === 'Saved' && savedCount > 0 && (
                <span className="absolute top-1.5 right-1/4 translate-x-1/2 text-[9px] font-bold bg-blue-950 text-blue-500 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center">
                  {savedCount > 9 ? '9+' : savedCount}
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
