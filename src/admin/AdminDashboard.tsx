import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home, Edit3, Tag, Users, Package,
  CreditCard, Link2, Settings, Construction, LogOut, X,
} from 'lucide-react';
import { ref as dbRef, get } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../AuthContext';
import Logo from '../Logo';
import AdminTopbar from './components/AdminTopbar';
import AdminStatsCards, { type AdminStats } from './components/AdminStatsCards';
import AdminUsersTable, { type AdminUser } from './components/AdminUsersTable';
import AdminServicesTable, { type AdminService } from './components/AdminServicesTable';
import AdminOrdersTable, { type AdminOrder } from './components/AdminOrdersTable';
import AdminUserViewModal from './components/AdminUserViewModal';
import AdminUserEditModal from './components/AdminUserEditModal';
import AdminUserDeleteModal from './components/AdminUserDeleteModal';
import AdminSettingsPage from './components/AdminSettingsPage';
import AdminServiceViewModal from './components/AdminServiceViewModal';
import AdminServiceEditModal from './components/AdminServiceEditModal';
import AdminServiceDeleteModal from './components/AdminServiceDeleteModal';
import AdminAffiliatesTable, { type AdminAffiliate } from './components/AdminAffiliatesTable';
import AdminOrderViewModal from './components/AdminOrderViewModal';
import AdminAffiliateViewModal from './components/AdminAffiliateViewModal';

type TabName = 'Home' | 'Posts' | 'Listings' | 'Users' | 'Orders' | 'Subscriptions' | 'Affiliates' | 'Settings';

interface NavItem {
  name: TabName;
  Icon: typeof Home;
  subtitle: string;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Home',          Icon: Home,       subtitle: 'Overview & metrics' },
  { name: 'Posts',         Icon: Edit3,      subtitle: 'Platform announcements', comingSoon: true },
  { name: 'Listings',      Icon: Tag,        subtitle: 'Service listings' },
  { name: 'Users',         Icon: Users,      subtitle: 'Registered accounts' },
  { name: 'Orders',        Icon: Package,    subtitle: 'All transactions' },
  { name: 'Subscriptions', Icon: CreditCard, subtitle: 'Plans & billing', comingSoon: true },
  { name: 'Affiliates',    Icon: Link2,      subtitle: 'Referral program' },
  { name: 'Settings',      Icon: Settings,   subtitle: 'Platform configuration' },
];

const SEARCH_PLACEHOLDERS: Partial<Record<TabName, string>> = {
  Home:       'Search users, services, orders…',
  Users:      'Search users by name, email, username…',
  Listings:   'Search services by title, seller, category…',
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

// ── Parsers (kept tiny so each loader is self-contained) ──────────────────────
const parseUsers = (raw: Record<string, Record<string, unknown>>): AdminUser[] =>
  Object.entries(raw)
    .map(([uid, u]) => ({
      uid,
      name: String(u?.name ?? ''),
      email: String(u?.email ?? ''),
      username: String(u?.username ?? ''),
      photoURL: String(u?.photoURL ?? ''),
      accountType: String(u?.accountType ?? 'buyer'),
      role: String(u?.role ?? 'user'),
      createdAt: Number(u?.createdAt ?? 0),
      disabled: Boolean(u?.disabled),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

const parseServices = (raw: Record<string, Record<string, unknown>>): AdminService[] =>
  Object.entries(raw)
    .map(([id, s]) => {
      const images = Array.isArray(s?.images) ? (s.images as string[]) : [];
      return {
        id,
        title: String(s?.title ?? ''),
        sellerName: String(s?.sellerName ?? ''),
        price: Number(s?.priceMin ?? s?.price ?? 0),
        status: String(s?.status ?? 'active'),
        imageUrl: images[0] ?? null,
        category: String(s?.category ?? ''),
        description: String(s?.description ?? ''),
        createdAt: Number(s?.createdAt ?? 0),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

const parseOrders = (raw: Record<string, Record<string, unknown>>): AdminOrder[] =>
  Object.entries(raw)
    .map(([id, o]) => ({
      orderId: id,
      buyerName: String(o?.buyerName ?? ''),
      sellerName: String(o?.sellerName ?? ''),
      status: String(o?.status ?? ''),
      amount: Number(o?.price ?? 0),
      createdAt: Number(o?.createdAt ?? 0),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/signin');
  };

  const [activeTab, setActiveTab]   = useState<TabName>('Home');
  const [search, setSearch]         = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Data state. `null` means "not yet loaded" ──────────────────────────────
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

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [viewUser,   setViewUser]   = useState<AdminUser | null>(null);
  const [editUser,   setEditUser]   = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const [viewService,   setViewService]   = useState<AdminService | null>(null);
  const [editService,   setEditService]   = useState<AdminService | null>(null);
  const [deleteService, setDeleteService] = useState<AdminService | null>(null);

  const [viewOrder,     setViewOrder]     = useState<AdminOrder | null>(null);
  const [viewAffiliate, setViewAffiliate] = useState<AdminAffiliate | null>(null);

  // ── Local-state updaters (avoid full re-fetch on edit/delete) ──────────────
  const handleEditSuccess   = (updated: AdminUser) => setUsers((prev) => prev?.map((u) => u.uid === updated.uid ? updated : u) ?? null);
  const handleDeleteSuccess = (uid: string) => setUsers((prev) => prev?.map((u) => u.uid === uid ? { ...u, disabled: true, role: 'user' } : u) ?? null);

  const handleServiceEditSuccess   = (updated: AdminService) => setServices((prev) => prev?.map((s) => s.id === updated.id ? updated : s) ?? null);
  const handleServiceDeleteSuccess = (id: string) => setServices((prev) => prev?.filter((s) => s.id !== id) ?? null);

  // ── Verify admin role on user change ───────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setAccessChecked(false);
      setAccessDenied(false);
      // Reset cached data so a different login doesn't see stale rows
      setUsers(null); setServices(null); setOrders(null); setAffiliates(null);
      return;
    }

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

  // ── Lazy loaders. Each is idempotent (no-op if already loaded/loading) ────
  const loadUsers = useCallback(async () => {
    if (users !== null || usersLoading) return;
    setUsersLoading(true);
    try {
      const snap = await get(dbRef(database, 'users'));
      setUsers(parseUsers((snap.val() ?? {}) as Record<string, Record<string, unknown>>));
    } catch (err) {
      console.error('Failed to load users:', err);
      setFetchError('Failed to load users.');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [users, usersLoading]);

  const loadServices = useCallback(async () => {
    if (services !== null || servicesLoading) return;
    setServicesLoading(true);
    try {
      const snap = await get(dbRef(database, 'services'));
      setServices(parseServices((snap.val() ?? {}) as Record<string, Record<string, unknown>>));
    } catch (err) {
      console.error('Failed to load services:', err);
      setFetchError('Failed to load services.');
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }, [services, servicesLoading]);

  const loadOrders = useCallback(async () => {
    if (orders !== null || ordersLoading) return;
    setOrdersLoading(true);
    try {
      const snap = await get(dbRef(database, 'orders'));
      setOrders(parseOrders((snap.val() ?? {}) as Record<string, Record<string, unknown>>));
    } catch (err) {
      console.error('Failed to load orders:', err);
      setFetchError('Failed to load orders.');
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
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
      const affData   = (affSnap.val() ?? {}) as Record<string, Record<string, unknown>>;

      // Build the list from `affiliates/` (keyed by uid) — independent of accountType,
      // so users with affiliate records are surfaced even if their account type changed.
      const list: AdminAffiliate[] = Object.entries(affData)
        .map(([uid, aff]) => {
          const u = (usersData[uid] ?? {}) as Record<string, unknown>;
          return {
            uid,
            name: String(u?.name ?? ''),
            email: String(u?.email ?? ''),
            username: String(u?.username ?? ''),
            photoURL: String(u?.photoURL ?? ''),
            referralCode: String(aff?.referralCode ?? ''),
            totalReferrals: Number(aff?.totalReferrals ?? 0),
            lifetimeEarnings: Number(aff?.lifetimeEarnings ?? 0),
            availableBalance: Number(aff?.availableBalance ?? 0),
            pendingBalance: Number(aff?.pendingBalance ?? 0),
            createdAt: Number(u?.createdAt ?? aff?.createdAt ?? 0),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      setAffiliates(list);
    } catch (err) {
      console.error('Failed to load affiliates:', err);
      setFetchError('Failed to load affiliates.');
      setAffiliates([]);
    } finally {
      setAffiliatesLoading(false);
    }
  }, [affiliates, affiliatesLoading]);

  // ── Fetch only what the active tab needs ───────────────────────────────────
  useEffect(() => {
    if (!user || !accessChecked || accessDenied) return;

    switch (activeTab) {
      case 'Home':
        loadUsers(); loadServices(); loadOrders();
        break;
      case 'Users':      loadUsers();      break;
      case 'Listings':   loadServices();   break;
      case 'Orders':     loadOrders();     break;
      case 'Affiliates': loadAffiliates(); break;
      // Posts, Subscriptions, Settings: nothing to fetch here.
    }
  }, [user, accessChecked, accessDenied, activeTab, loadUsers, loadServices, loadOrders, loadAffiliates]);

  // ── Reset search & close drawer when switching tabs ────────────────────────
  useEffect(() => {
    setSearch('');
    setSidebarOpen(false);
  }, [activeTab]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const stats: AdminStats | null = useMemo(() => {
    if (users === null || services === null || orders === null) return null;
    return {
      totalUsers: users.length,
      totalSellers: users.filter((u) => u.accountType === 'seller').length,
      totalServices: services.length,
      totalOrders: orders.length,
      totalRevenue: orders
        .filter((o) => o.status === 'completed')
        .reduce((sum, o) => sum + o.amount, 0),
    };
  }, [users, services, orders]);

  const statsLoading = stats === null && (usersLoading || servicesLoading || ordersLoading || users === null);

  const q = search.trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!q) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q),
    );
  }, [users, q]);

  const filteredServices = useMemo(() => {
    if (!services) return [];
    if (!q) return services;
    return services.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.sellerName.toLowerCase().includes(q) ||
      (s.category ?? '').toLowerCase().includes(q),
    );
  }, [services, q]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!q) return orders;
    return orders.filter((o) =>
      o.orderId.toLowerCase().includes(q) ||
      o.buyerName.toLowerCase().includes(q) ||
      o.sellerName.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q),
    );
  }, [orders, q]);

  const filteredAffiliates = useMemo(() => {
    if (!affiliates) return [];
    if (!q) return affiliates;
    return affiliates.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q) ||
      a.referralCode.toLowerCase().includes(q),
    );
  }, [affiliates, q]);

  // ── Access denied screen ───────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#0E1422] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-lg font-semibold">Access Denied</p>
          <p className="text-slate-500 text-sm">You don't have admin privileges.</p>
          <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm inline-block transition-colors">
            ← Go Home
          </Link>
        </div>
      </div>
    );
  }

  const activeItem = NAV_ITEMS.find((n) => n.name === activeTab) ?? NAV_ITEMS[0];

  const usersTableProps = {
    users: filteredUsers,
    loading: usersLoading && users === null,
    onView:   (u: AdminUser) => setViewUser(u),
    onEdit:   (u: AdminUser) => setEditUser(u),
    onDelete: (u: AdminUser) => setDeleteUser(u),
  };

  const servicesTableProps = {
    services: filteredServices,
    loading: servicesLoading && services === null,
    onView:   (s: AdminService) => setViewService(s),
    onEdit:   (s: AdminService) => setEditService(s),
    onDelete: (s: AdminService) => setDeleteService(s),
  };

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
              <AdminUsersTable    {...usersTableProps}    pageSize={5} />
              <AdminServicesTable {...servicesTableProps} pageSize={5} />
              <AdminOrdersTable
                orders={filteredOrders}
                loading={ordersLoading && orders === null}
                pageSize={5}
                onView={setViewOrder}
              />
            </div>
          </>
        );

      case 'Listings':
        return (
          <>
            <PageHeader title="Service Listings" subtitle="All services posted on the platform" />
            <AdminServicesTable {...servicesTableProps} />
          </>
        );

      case 'Users':
        return (
          <>
            <PageHeader title="Users" subtitle="All registered buyer and seller accounts" />
            <AdminUsersTable {...usersTableProps} />
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
            />
          </>
        );

      case 'Settings':
        return <AdminSettingsPage />;

      default:
        return <ComingSoon tab={activeItem.name} subtitle={activeItem.subtitle} />;
    }
  };

  // ── Shell ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#111827] flex flex-col shrink-0
          border-r border-slate-800 min-h-screen transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <Link to="/" onClick={() => setSidebarOpen(false)}>
            <Logo className="h-6" />
          </Link>
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
                  active
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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

      {/* Modals */}
      {viewUser && (
        <AdminUserViewModal user={viewUser} onClose={() => setViewUser(null)} />
      )}
      {editUser && (
        <AdminUserEditModal user={editUser} onClose={() => setEditUser(null)} onSuccess={handleEditSuccess} />
      )}
      {deleteUser && (
        <AdminUserDeleteModal user={deleteUser} onClose={() => setDeleteUser(null)} onSuccess={handleDeleteSuccess} />
      )}

      {viewService && (
        <AdminServiceViewModal service={viewService} onClose={() => setViewService(null)} />
      )}
      {editService && (
        <AdminServiceEditModal service={editService} onClose={() => setEditService(null)} onSuccess={handleServiceEditSuccess} />
      )}
      {deleteService && (
        <AdminServiceDeleteModal service={deleteService} onClose={() => setDeleteService(null)} onSuccess={handleServiceDeleteSuccess} />
      )}

      {viewOrder && (
        <AdminOrderViewModal order={viewOrder} onClose={() => setViewOrder(null)} />
      )}
      {viewAffiliate && (
        <AdminAffiliateViewModal affiliate={viewAffiliate} onClose={() => setViewAffiliate(null)} />
      )}
    </div>
  );
};

export default AdminDashboard;
