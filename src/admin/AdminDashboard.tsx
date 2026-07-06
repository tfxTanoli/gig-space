import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home, Package,
  CreditCard, BadgeDollarSign, Settings, Construction, LogOut, X,
} from 'lucide-react';

const PostsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2.5H4.16667C3.72464 2.5 3.30072 2.67559 2.98816 2.98816C2.67559 3.30072 2.5 3.72464 2.5 4.16667V15.8333C2.5 16.2754 2.67559 16.6993 2.98816 17.0118C3.30072 17.3244 3.72464 17.5 4.16667 17.5H15.8333C16.2754 17.5 16.6993 17.3244 17.0118 17.0118C17.3244 16.6993 17.5 16.2754 17.5 15.8333V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.3125 2.18769C15.644 1.85617 16.0937 1.66992 16.5625 1.66992C17.0313 1.66992 17.481 1.85617 17.8125 2.18769C18.144 2.51921 18.3303 2.96885 18.3303 3.43769C18.3303 3.90653 18.144 4.35617 17.8125 4.68769L10.3017 12.1994C10.1038 12.3971 9.85934 12.5418 9.59083 12.6202L7.19667 13.3202C7.12496 13.3411 7.04895 13.3424 6.97659 13.3238C6.90423 13.3053 6.83819 13.2676 6.78537 13.2148C6.73256 13.162 6.69491 13.096 6.67637 13.0236C6.65783 12.9512 6.65909 12.8752 6.68 12.8035L7.38 10.4094C7.45877 10.1411 7.60378 9.8969 7.80167 9.69936L15.3125 2.18769Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ListingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.5952 9.254C16.6424 8.94932 16.6663 8.64149 16.6668 8.33317C16.6668 6.56506 15.9645 4.86937 14.7142 3.61913C13.464 2.36888 11.7683 1.6665 10.0002 1.6665C8.23205 1.6665 6.53636 2.36888 5.28612 3.61913C4.03588 4.86937 3.3335 6.56506 3.3335 8.33317C3.3335 12.494 7.94933 16.8273 9.49933 18.1657C9.64373 18.2742 9.8195 18.333 10.0002 18.333C10.1808 18.333 10.3566 18.2742 10.501 18.1657C10.7334 17.9646 10.9623 17.7596 11.1877 17.5507" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 10.8335C11.3807 10.8335 12.5 9.71421 12.5 8.3335C12.5 6.95278 11.3807 5.8335 10 5.8335C8.61929 5.8335 7.5 6.95278 7.5 8.3335C7.5 9.71421 8.61929 10.8335 10 10.8335Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.3335 15H18.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.8335 12.5V17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.0002 10.8333C12.3013 10.8333 14.1668 8.96785 14.1668 6.66667C14.1668 4.36548 12.3013 2.5 10.0002 2.5C7.69898 2.5 5.8335 4.36548 5.8335 6.66667C5.8335 8.96785 7.69898 10.8333 10.0002 10.8333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.6668 17.5002C16.6668 15.7321 15.9645 14.0364 14.7142 12.7861C13.464 11.5359 11.7683 10.8335 10.0002 10.8335C8.23205 10.8335 6.53636 11.5359 5.28612 12.7861C4.03588 14.0364 3.3335 15.7321 3.3335 17.5002" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

import { ref as dbRef, get, update } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import Logo from '../Logo';
import AdminTopbar from './components/AdminTopbar';
import AdminStatsCards, { type AdminStats } from './components/AdminStatsCards';
import AdminUsersTable, { type AdminUser } from './components/AdminUsersTable';
import AdminServicesTable, { type AdminService } from './components/AdminServicesTable';
import AdminOrdersTable, { type AdminOrder } from './components/AdminOrdersTable';
import AdminUserDetail from './components/AdminUserDetail';
import AdminUserEditModal from './components/AdminUserEditModal';
import AdminUserDeleteModal from './components/AdminUserDeleteModal';
import AdminSettingsPage from './components/AdminSettingsPage';
import AdminAffiliatesTable, { type AdminAffiliate } from './components/AdminAffiliatesTable';
import AdminOrderViewModal from './components/AdminOrderViewModal';
import AdminOrderEditModal from './components/AdminOrderEditModal';
import AdminAffiliateViewModal from './components/AdminAffiliateViewModal';
import AdminAffiliateEditModal from './components/AdminAffiliateEditModal';
import AdminActivityFeed from './components/AdminActivityFeed';
import AdminCharts from './components/AdminCharts';
import AdminPostEditDrawer from './components/AdminPostEditDrawer';
import AdminPostCreateDrawer from './components/AdminPostCreateDrawer';
import AdminUserCreateModal from './components/AdminUserCreateModal';
import AdminAffiliateCreateModal from './components/AdminAffiliateCreateModal';
import AdminListingsTab from './components/AdminListingsTab';
import AdminSubscriptionsTab from './components/AdminSubscriptionsTab';
import { adminGetSubscriptions } from './adminApi';

type TabName = 'Home' | 'Posts' | 'Listings' | 'Users' | 'Orders' | 'Subscriptions' | 'Affiliates' | 'Settings';

interface NavItem {
  name: TabName;
  Icon: React.ComponentType<{ className?: string }>;
  subtitle: string;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Home',          Icon: Home,             subtitle: 'Overview & metrics' },
  { name: 'Posts',         Icon: PostsIcon,        subtitle: 'Service listings' },
  { name: 'Listings',      Icon: ListingsIcon,     subtitle: 'Google My Business' },
  { name: 'Users',         Icon: UsersIcon,        subtitle: 'Registered accounts' },
  { name: 'Orders',        Icon: Package,          subtitle: 'All transactions' },
  { name: 'Subscriptions', Icon: CreditCard,       subtitle: 'Plans & billing' },
  { name: 'Affiliates',    Icon: BadgeDollarSign,  subtitle: 'Referral program' },
  { name: 'Settings',      Icon: Settings,         subtitle: 'Platform configuration' },
];

// Avatar dropdown shows a shortlist rather than every sidebar section.
const DROPDOWN_TABS: TabName[] = ['Home', 'Users', 'Orders', 'Settings'];
const DROPDOWN_NAV_ITEMS = NAV_ITEMS.filter((item) => DROPDOWN_TABS.includes(item.name));

const SEARCH_PLACEHOLDERS: Partial<Record<TabName, string>> = {
  Home:       'Search users, services, orders…',
  Users:      'Search users by name, email, username…',
  Posts:      'Search posts by title, seller, category…',
  Orders:     'Search orders by ID, buyer, seller…',
  Affiliates: 'Search affiliates by name, email, code…',
};

const ComingSoon = ({ tab, subtitle }: { tab: string; subtitle: string }) => (
  <div className="flex flex-col items-center justify-center py-28 text-center">
    <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center mb-5 border border-slate-700/50">
      <Construction className="w-7 h-7 text-slate-500" />
    </div>
    <p className="text-white font-semibold text-base">{tab}</p>
    <p className="text-slate-500 text-sm mt-1.5">{subtitle} — coming soon.</p>
  </div>
);

const PageHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mb-6">
    <h1 className="text-lg font-semibold text-white">{title}</h1>
    <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>
  </div>
);

// ── Parsers ───────────────────────────────────────────────────────────────────
const parseUsers = (raw: Record<string, Record<string, unknown>>): AdminUser[] =>
  Object.entries(raw)
    .map(([uid, u]) => ({
      uid,
      name:        String(u?.name        ?? ''),
      email:       String(u?.email       ?? ''),
      username:    String(u?.username    ?? ''),
      photoURL:    String(u?.photoURL    ?? ''),
      accountType: String(u?.accountType ?? 'buyer'),
      role:        String(u?.role        ?? 'user'),
      createdAt:   Number(u?.createdAt   ?? 0),
      disabled:    Boolean(u?.disabled),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

const parseServices = (raw: Record<string, Record<string, unknown>>): AdminService[] =>
  Object.entries(raw)
    .map(([id, s]) => {
      const images = Array.isArray(s?.images) ? (s.images as string[]) : [];
      const extraLocations = Array.isArray(s?.extraLocations) ? (s.extraLocations as string[]) : [];
      const languages      = Array.isArray(s?.languages) ? (s.languages as string[]) : [];
      return {
        id,
        title:           String(s?.title          ?? ''),
        sellerName:      String(s?.sellerName      ?? ''),
        sellerId:        String(s?.sellerId        ?? ''),
        price:           Number(s?.priceMin        ?? s?.price ?? 0),
        priceMin:        Number(s?.priceMin        ?? s?.price ?? 0),
        priceMax:        s?.priceMax != null ? Number(s.priceMax) : null,
        priceType:       (s?.priceType as 'per_project' | 'per_hour') ?? 'per_project',
        status:          String(s?.status          ?? 'active'),
        images,
        imageUrl:        images[0] ?? null,
        category:        String(s?.category        ?? ''),
        subcategory:     String(s?.subcategory     ?? ''),
        description:     String(s?.description     ?? ''),
        primaryLocation: String(s?.primaryLocation ?? ''),
        extraLocations,
        offeredRemotely: Boolean(s?.offeredRemotely),
        languages,
        createdAt:       Number(s?.createdAt       ?? 0),
      };
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

const parseOrders = (raw: Record<string, Record<string, unknown>>): AdminOrder[] =>
  Object.entries(raw)
    .map(([id, o]) => ({
      orderId:       id,
      buyerName:     String(o?.buyerName     ?? ''),
      buyerId:       String(o?.buyerId       ?? ''),
      sellerName:    String(o?.sellerName    ?? ''),
      sellerId:      String(o?.sellerId      ?? ''),
      serviceId:     String(o?.serviceId     ?? ''),
      serviceTitle:  String(o?.serviceTitle  ?? ''),
      conversationId: String(o?.conversationId ?? ''),
      status:        String(o?.status        ?? ''),
      paymentStatus: String(o?.paymentStatus ?? ''),
      paymentId:     String(o?.paymentId     ?? ''),
      amount:        Number(o?.price         ?? 0),
      createdAt:     Number(o?.createdAt     ?? 0),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/search', { replace: true });
  };

  const [activeTab,   setActiveTab]   = useState<TabName>('Home');
  const [search,      setSearch]      = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Data state ───────────────────────────────────────────────────────────────
  const [users,      setUsers]      = useState<AdminUser[]      | null>(null);
  const [services,   setServices]   = useState<AdminService[]   | null>(null);
  const [orders,     setOrders]     = useState<AdminOrder[]     | null>(null);
  const [affiliates, setAffiliates] = useState<AdminAffiliate[] | null>(null);

  const [usersLoading,      setUsersLoading]      = useState(false);
  const [servicesLoading,   setServicesLoading]   = useState(false);
  const [ordersLoading,     setOrdersLoading]     = useState(false);
  const [affiliatesLoading, setAffiliatesLoading] = useState(false);

  const [accessChecked, setAccessChecked] = useState(false);
  const [accessDenied,  setAccessDenied]  = useState(false);
  const [fetchError,    setFetchError]    = useState<string | null>(null);

  // ── Modals / Drawers ─────────────────────────────────────────────────────────
  const [viewUser,   setViewUser]   = useState<AdminUser | null>(null);
  const [editUser,   setEditUser]   = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [createUserOpen,      setCreateUserOpen]      = useState(false);
  const [createAffiliateOpen, setCreateAffiliateOpen] = useState(false);
  // Subscription events for the dashboard activity feed (sourced from Stripe via backend).
  const [subEvents, setSubEvents] = useState<{ sellerName: string; amount: number; createdAt: number }[]>([]);
  // Active count + MRR for the stat cards — same active-status definition as AdminSubscriptionsTab.
  const [subSummary, setSubSummary] = useState({ activeCount: 0, mrr: 0 });

  const [editPost,     setEditPost]     = useState<AdminService | null>(null);
  const [createPost,   setCreatePost]   = useState(false);

  const [viewOrder,    setViewOrder]    = useState<AdminOrder | null>(null);
  const [editOrder,    setEditOrder]    = useState<AdminOrder | null>(null);
  const [viewAffiliate,  setViewAffiliate]  = useState<AdminAffiliate | null>(null);
  const [editAffiliate,  setEditAffiliate]  = useState<AdminAffiliate | null>(null);

  // ── Local-state updaters ──────────────────────────────────────────────────────
  const handleEditSuccess   = (updated: AdminUser)   => setUsers((prev) => prev?.map((u) => u.uid === updated.uid ? updated : u) ?? null);
  const handleDeleteSuccess = (uid: string) =>
    setUsers((prev) => prev?.map((u) => u.uid === uid ? { ...u, disabled: !u.disabled } : u) ?? null);

  const handlePostEditSuccess = (updated: AdminService) =>
    setServices((prev) => prev?.map((s) => s.id === updated.id ? updated : s) ?? null);
  const handlePostCreateSuccess = (created: AdminService) =>
    setServices((prev) => prev ? [created, ...prev] : [created]);
  const handlePostDeleteSuccess = (id: string) =>
    setServices((prev) => prev?.filter((s) => s.id !== id) ?? null);

  const handleOrderEditSuccess   = (updated: AdminOrder) => setOrders((prev) => prev?.map((o) => o.orderId === updated.orderId ? updated : o) ?? null);

  const handleAffiliateEditSuccess = (updated: AdminAffiliate) =>
    setAffiliates((prev) => prev?.map((a) => a.uid === updated.uid ? updated : a) ?? null);

  const handleUserCreateSuccess = (created: AdminUser) =>
    setUsers((prev) => prev ? [created, ...prev] : [created]);
  const handleAffiliateCreateSuccess = (created: AdminAffiliate) =>
    setAffiliates((prev) => prev ? [created, ...prev] : [created]);

  // Deactivate/reactivate affiliate
  const handleAffiliateDeactivate = async (a: AdminAffiliate) => {
    try {
      await update(dbRef(database, `users/${a.uid}`), { disabled: !a.disabled });
      setAffiliates((prev) => prev?.map((af) => af.uid === a.uid ? { ...af, disabled: !af.disabled } : af) ?? null);
    } catch { /* non-fatal */ }
  };

  // ── Admin role check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setAccessChecked(false); setAccessDenied(false); setUsers(null); setServices(null); setOrders(null); setAffiliates(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await get(dbRef(database, `users/${user.uid}/role`));
        if (cancelled) return;
        setAccessDenied(snap.val() !== 'admin');
        setAccessChecked(true);
      } catch (err) {
        if (cancelled) return;
        console.error('Admin role check failed:', err);
        setAccessDenied(true);
        setAccessChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Lazy loaders ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    if (users !== null || usersLoading) return;
    setUsersLoading(true);
    try {
      const snap = await get(dbRef(database, 'users'));
      setUsers(parseUsers((snap.val() ?? {}) as Record<string, Record<string, unknown>>));
    } catch { setFetchError('Failed to load users.'); setUsers([]); }
    finally  { setUsersLoading(false); }
  }, [users, usersLoading]);

  const loadServices = useCallback(async () => {
    if (services !== null || servicesLoading) return;
    setServicesLoading(true);
    try {
      const snap = await get(dbRef(database, 'services'));
      setServices(parseServices((snap.val() ?? {}) as Record<string, Record<string, unknown>>));
    } catch { setFetchError('Failed to load posts.'); setServices([]); }
    finally  { setServicesLoading(false); }
  }, [services, servicesLoading]);

  const loadOrders = useCallback(async () => {
    if (orders !== null || ordersLoading) return;
    setOrdersLoading(true);
    try {
      const snap = await get(dbRef(database, 'orders'));
      setOrders(parseOrders((snap.val() ?? {}) as Record<string, Record<string, unknown>>));
    } catch { setFetchError('Failed to load orders.'); setOrders([]); }
    finally  { setOrdersLoading(false); }
  }, [orders, ordersLoading]);

  const loadAffiliates = useCallback(async () => {
    if (affiliates !== null || affiliatesLoading) return;
    setAffiliatesLoading(true);
    try {
      const [usersSnap, affSnap] = await Promise.all([
        get(dbRef(database, 'users')),
        get(dbRef(database, 'affiliates')),
      ]);
      const usersData = (usersSnap.val() ?? {}) as Record<string, Record<string, unknown>>;
      const affData   = (affSnap.val()   ?? {}) as Record<string, Record<string, unknown>>;
      const list: AdminAffiliate[] = Object.entries(affData).map(([uid, aff]) => {
        const u = (usersData[uid] ?? {}) as Record<string, unknown>;
        return {
          uid,
          name:             String(u?.name ?? ''),
          email:            String(u?.email ?? ''),
          username:         String(u?.username ?? ''),
          photoURL:         String(u?.photoURL ?? ''),
          referralCode:     String(aff?.referralCode ?? ''),
          totalReferrals:   Number(aff?.totalReferrals ?? 0),
          lifetimeEarnings: Number(aff?.lifetimeEarnings ?? 0),
          availableBalance: Number(aff?.availableBalance ?? 0),
          pendingBalance:   Number(aff?.pendingBalance ?? 0),
          createdAt:        Number(u?.createdAt ?? aff?.createdAt ?? 0),
          disabled:         Boolean(u?.disabled),
        };
      }).sort((a, b) => b.createdAt - a.createdAt);
      setAffiliates(list);
    } catch { setFetchError('Failed to load affiliates.'); setAffiliates([]); }
    finally  { setAffiliatesLoading(false); }
  }, [affiliates, affiliatesLoading]);

  // ── Fetch by active tab ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !accessChecked || accessDenied) return;
    switch (activeTab) {
      case 'Home':
        loadUsers(); loadServices(); loadOrders(); loadAffiliates();
        adminGetSubscriptions()
          .then(({ subscriptions }) => {
            setSubEvents(subscriptions.map((s) => ({ sellerName: s.sellerName, amount: s.amount, createdAt: s.createdAt })));
            const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due');
            setSubSummary({ activeCount: activeSubs.length, mrr: activeSubs.reduce((sum, s) => sum + s.amount, 0) });
          })
          .catch(() => { /* non-fatal — backend may be unreachable */ });
        break;
      case 'Users':      loadUsers();      break;
      case 'Posts':      loadServices();   break;
      case 'Orders':     loadOrders();     break;
      case 'Affiliates': loadAffiliates(); break;
      // Listings, Subscriptions, Settings: nothing to fetch here.
    }
  }, [user, accessChecked, accessDenied, activeTab, loadUsers, loadServices, loadOrders, loadAffiliates]);

  // ── Reset search on tab change ────────────────────────────────────────────────
  useEffect(() => { setSearch(''); setSidebarOpen(false); setViewUser(null); }, [activeTab]);

  // ── Stats (all 8 fields) ──────────────────────────────────────────────────────
  const stats: AdminStats | null = useMemo(() => {
    if (users === null || services === null || orders === null) return null;
    return {
      totalUsers:           users.filter((u) => u.role !== 'admin').length,
      totalSellers:         users.filter((u) => u.accountType === 'seller').length,
      totalServices:        services.length,
      totalOrders:          orders.length,
      totalRevenue:         orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.amount, 0),
      activeSubscribers:    subSummary.activeCount,
      subscriptionRevenue:  subSummary.mrr,
      totalAffiliates:      affiliates?.length ?? 0,
    };
  }, [users, services, orders, affiliates, subSummary]);

  const statsLoading = stats === null && (usersLoading || servicesLoading || ordersLoading || users === null);

  // ── Filtered data ─────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const base = users.filter((u) => u.role !== 'admin');
    if (!q) return base;
    return base.filter((u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [users, q]);

  const filteredServices = useMemo(() => {
    if (!services) return [];
    if (!q) return services;
    return services.filter((s) =>
      s.title.toLowerCase().includes(q) || s.sellerName.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q)
    );
  }, [services, q]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!q) return orders;
    return orders.filter((o) =>
      o.orderId.toLowerCase().includes(q) || o.buyerName.toLowerCase().includes(q) ||
      o.sellerName.toLowerCase().includes(q) || o.status.toLowerCase().includes(q)
    );
  }, [orders, q]);

  const filteredAffiliates = useMemo(() => {
    if (!affiliates) return [];
    if (!q) return affiliates;
    return affiliates.filter((a) =>
      a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q) || a.referralCode.toLowerCase().includes(q)
    );
  }, [affiliates, q]);

  // ── Access denied ─────────────────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-lg font-semibold">Access Denied</p>
          <p className="text-slate-500 text-sm">You don't have admin privileges.</p>
          <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm inline-block transition-colors">← Go Home</Link>
        </div>
      </div>
    );
  }

  const activeItem = NAV_ITEMS.find((n) => n.name === activeTab) ?? NAV_ITEMS[0];

  const renderContent = () => {
    if (activeItem.comingSoon) {
      return <ComingSoon tab={activeItem.name} subtitle={activeItem.subtitle} />;
    }

    switch (activeTab) {
      case 'Home':
        return (
          <>
            <PageHeader title="Dashboard" subtitle="Platform overview and key metrics" />
            <AdminStatsCards stats={stats} loading={statsLoading} />
            <div className="mt-6 space-y-5">
              <AdminCharts
                users={users ?? []}
                services={services ?? []}
                orders={orders ?? []}
              />
              <AdminActivityFeed
                users={users ?? []}
                services={services ?? []}
                orders={orders ?? []}
                subscriptions={subEvents}
                loading={usersLoading || servicesLoading || ordersLoading}
              />
            </div>
          </>
        );

      case 'Posts':
        return (
          <>
            <PageHeader title="Posts" subtitle="All service posts created by sellers" />
            <AdminServicesTable
              services={filteredServices}
              loading={servicesLoading && services === null}
              onEdit={setEditPost}
              onNew={() => setCreatePost(true)}
            />
          </>
        );

      case 'Users':
        // A selected user opens a full-page detail view (with back arrow) instead of a modal.
        if (viewUser) {
          return (
            <AdminUserDetail
              user={viewUser}
              onBack={() => setViewUser(null)}
              onEdit={(u) => setEditUser(u)}
              onDeactivate={(u) => setDeleteUser(u)}
            />
          );
        }
        return (
          <>
            <PageHeader title="Users" subtitle="All registered buyer and seller accounts" />
            <AdminUsersTable
              users={filteredUsers}
              loading={usersLoading && users === null}
              onView={(u) => setViewUser(u)}
              onEdit={(u) => setEditUser(u)}
              onDelete={(u) => setDeleteUser(u)}
              onNew={() => setCreateUserOpen(true)}
            />
          </>
        );

      case 'Orders':
        return (
          <>
            <PageHeader title="Orders" subtitle="All orders and transactions" />
            <AdminOrdersTable
              orders={filteredOrders}
              loading={ordersLoading && orders === null}
              onView={setViewOrder}
              onEdit={setEditOrder}
            />
          </>
        );

      case 'Affiliates':
        return (
          <>
            <PageHeader title="Affiliates" subtitle="Referral program participants and their earnings" />
            <AdminAffiliatesTable
              affiliates={filteredAffiliates}
              loading={affiliatesLoading && affiliates === null}
              onView={setViewAffiliate}
              onEdit={setEditAffiliate}
              onDeactivate={handleAffiliateDeactivate}
              onNew={() => setCreateAffiliateOpen(true)}
            />
          </>
        );

      case 'Listings':
        return <AdminListingsTab />;

      case 'Subscriptions':
        return <AdminSubscriptionsTab />;

      case 'Settings':
        return <AdminSettingsPage />;

      default:
        return <ComingSoon tab={activeItem.name} subtitle={activeItem.subtitle} />;
    }
  };

  // ── Shell ──────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen overflow-hidden bg-background flex text-white font-sans">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — sticky full height; only the main pane scrolls */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-surface flex flex-col shrink-0
        border-r border-slate-800 h-screen lg:h-full transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div onClick={() => setSidebarOpen(false)}>
            <Logo className="h-6" />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ name, Icon, comingSoon }) => {
            const active = activeTab === name;
            return (
              <button
                key={name}
                onClick={() => setActiveTab(name)}
                className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                <span className="flex-1 text-left">{name}</span>
                {comingSoon && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase tracking-wider">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pb-4 space-y-2">
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 px-4 py-3">
            <p className="text-xs text-slate-500 font-medium">Admin Panel</p>
            <p className="text-xs text-slate-600 mt-0.5">Gigspace v1.0</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={SEARCH_PLACEHOLDERS[activeTab] ?? 'Search…'}
          onMenuClick={() => setSidebarOpen(true)}
          navItems={DROPDOWN_NAV_ITEMS}
          activeTab={activeTab}
          onNavigate={setActiveTab}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div
            className="w-full border border-dashed border-slate-700/60 rounded-xl p-4 sm:p-6"
            style={{ minHeight: 'calc(100vh - 7rem)' }}
          >
            {fetchError && (
              <div className="mb-5 text-sm text-amber-400 bg-amber-500/10 rounded-lg px-4 py-3 border border-amber-500/20">
                {fetchError}
              </div>
            )}
            {renderContent()}
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      {editUser   && <AdminUserEditModal   user={editUser}     onClose={() => setEditUser(null)}   onSuccess={handleEditSuccess} />}
      {deleteUser && <AdminUserDeleteModal user={deleteUser}   onClose={() => setDeleteUser(null)} onSuccess={handleDeleteSuccess} />}
      {createUserOpen      && <AdminUserCreateModal      onClose={() => setCreateUserOpen(false)}      onSuccess={handleUserCreateSuccess} />}
      {createAffiliateOpen && <AdminAffiliateCreateModal onClose={() => setCreateAffiliateOpen(false)} onSuccess={handleAffiliateCreateSuccess} />}

      {/* Edit post: use full drawer instead of modal */}
      {editPost && (
        <AdminPostEditDrawer
          service={editPost}
          onClose={() => setEditPost(null)}
          onSuccess={handlePostEditSuccess}
          onDeleted={handlePostDeleteSuccess}
        />
      )}
      {createPost && (
        <AdminPostCreateDrawer
          onClose={() => setCreatePost(false)}
          onSuccess={handlePostCreateSuccess}
        />
      )}

      {viewOrder   && <AdminOrderViewModal   order={viewOrder}   onClose={() => setViewOrder(null)} />}
      {editOrder   && (
        <AdminOrderEditModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSuccess={handleOrderEditSuccess}
        />
      )}
      {viewAffiliate && <AdminAffiliateViewModal affiliate={viewAffiliate} onClose={() => setViewAffiliate(null)} />}
      {editAffiliate && (
        <AdminAffiliateEditModal
          affiliate={editAffiliate}
          onClose={() => setEditAffiliate(null)}
          onSuccess={handleAffiliateEditSuccess}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
