import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Home, Edit3, Tag, Users, Package,
  CreditCard, Link2, Settings, Construction,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import LocationIcon from '../LocationIcon';
import AdminTopbar from './components/AdminTopbar';
import AdminStatsCards, { type AdminStats } from './components/AdminStatsCards';
import AdminUsersTable, { type AdminUser } from './components/AdminUsersTable';
import AdminServicesTable, { type AdminService } from './components/AdminServicesTable';
import AdminOrdersTable, { type AdminOrder } from './components/AdminOrdersTable';
import AdminUserViewModal from './components/AdminUserViewModal';
import AdminUserEditModal from './components/AdminUserEditModal';
import AdminUserDeleteModal from './components/AdminUserDeleteModal';

const NAV_ITEMS = [
  { name: 'Home',          Icon: Home,       subtitle: 'Overview & metrics' },
  { name: 'Posts',         Icon: Edit3,      subtitle: 'Platform announcements' },
  { name: 'Listings',      Icon: Tag,        subtitle: 'Service listings' },
  { name: 'Users',         Icon: Users,      subtitle: 'Registered accounts' },
  { name: 'Orders',        Icon: Package,    subtitle: 'All transactions' },
  { name: 'Subscriptions', Icon: CreditCard, subtitle: 'Plans & billing' },
  { name: 'Affiliates',    Icon: Link2,      subtitle: 'Referral program' },
  { name: 'Settings',      Icon: Settings,   subtitle: 'Platform configuration' },
];

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

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');

  const [stats,    setStats]    = useState<AdminStats | null>(null);
  const [users,    setUsers]    = useState<AdminUser[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [orders,   setOrders]   = useState<AdminOrder[]>([]);

  const [statsLoading,    setStatsLoading]    = useState(true);
  const [usersLoading,    setUsersLoading]    = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [ordersLoading,   setOrdersLoading]   = useState(true);

  const [accessDenied, setAccessDenied] = useState(false);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [viewUser,   setViewUser]   = useState<AdminUser | null>(null);
  const [editUser,   setEditUser]   = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  // ── Local state updaters (avoid full re-fetch) ───────────────────────────────
  const handleEditSuccess = (updated: AdminUser) => {
    setUsers((prev) => prev.map((u) => (u.uid === updated.uid ? updated : u)));
  };
  const handleDeleteSuccess = (uid: string) => {
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
  };

  // ── Data fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const token = await user.getIdToken();
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };

      const fetchJson = async (url: string) => {
        const res = await fetch(url, { headers });
        if (res.status === 401 || res.status === 403) {
          const err = new Error('forbidden') as Error & { status: number };
          err.status = res.status;
          throw err;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      };

      const [s, u, sv, o] = await Promise.allSettled([
        fetchJson('/api/admin/stats'),
        fetchJson('/api/admin/users?limit=20'),
        fetchJson('/api/admin/services?limit=20'),
        fetchJson('/api/admin/orders?limit=20'),
      ]);

      if (cancelled) return;

      const denied = [s, u, sv, o].some(
        (r) => r.status === 'rejected' && (r.reason as { status?: number })?.status === 403,
      );
      if (denied) { setAccessDenied(true); return; }

      const unauthorized = [s, u, sv, o].some(
        (r) => r.status === 'rejected' && (r.reason as { status?: number })?.status === 401,
      );
      if (unauthorized) setFetchError('Authentication failed. Please sign in again.');

      if (s.status  === 'fulfilled') setStats(s.value);
      if (u.status  === 'fulfilled') setUsers(u.value.users ?? []);
      if (sv.status === 'fulfilled') setServices(sv.value.services ?? []);
      if (o.status  === 'fulfilled') setOrders(o.value.orders ?? []);

      if ([s, u, sv, o].some((r) => r.status === 'rejected' && !denied && !unauthorized)) {
        setFetchError('Some data failed to load.');
      }

      setStatsLoading(false);
      setUsersLoading(false);
      setServicesLoading(false);
      setOrdersLoading(false);
    };

    load().catch((err) => {
      if (!cancelled) {
        console.error('Admin dashboard load error:', err);
        setStatsLoading(false);
        setUsersLoading(false);
        setServicesLoading(false);
        setOrdersLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [user]);

  // ── Access denied screen ─────────────────────────────────────────────────────
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

  // ── Per-tab content ──────────────────────────────────────────────────────────
  const activeItem = NAV_ITEMS.find((n) => n.name === activeTab) ?? NAV_ITEMS[0];

  const usersTableProps = {
    users,
    loading: usersLoading,
    onView:   (u: AdminUser) => setViewUser(u),
    onEdit:   (u: AdminUser) => setEditUser(u),
    onDelete: (u: AdminUser) => setDeleteUser(u),
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Home':
        return (
          <>
            <PageHeader title="Dashboard" subtitle="Platform overview and key metrics" />
            <AdminStatsCards stats={stats} loading={statsLoading} />
            <div className="mt-6 space-y-5">
              <AdminUsersTable    {...usersTableProps} />
              <AdminServicesTable services={services} loading={servicesLoading} />
              <AdminOrdersTable   orders={orders}     loading={ordersLoading} />
            </div>
          </>
        );

      case 'Listings':
        return (
          <>
            <PageHeader title="Service Listings" subtitle="All services posted on the platform" />
            <AdminServicesTable services={services} loading={servicesLoading} />
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
            <AdminOrdersTable orders={orders} loading={ordersLoading} />
          </>
        );

      default:
        return <ComingSoon tab={activeItem.name} subtitle={activeItem.subtitle} />;
    }
  };

  // ── Shell ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">

      {/* Sidebar */}
      <aside className="w-64 bg-[#111827] flex flex-col shrink-0 border-r border-slate-800 min-h-screen">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-0.5">
            <LocationIcon className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight text-white">igspace</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ name, Icon }) => {
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
                {name}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pb-4">
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 px-4 py-3">
            <p className="text-xs text-slate-500 font-medium">Admin Panel</p>
            <p className="text-xs text-slate-600 mt-0.5">Gigspace v1.0</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar />

        <main className="flex-1 p-6 overflow-auto">
          <div
            className="w-full border border-dashed border-slate-700/60 rounded-xl p-6"
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
        <AdminUserViewModal
          user={viewUser}
          onClose={() => setViewUser(null)}
        />
      )}
      {editUser && (
        <AdminUserEditModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={handleEditSuccess}
        />
      )}
      {deleteUser && (
        <AdminUserDeleteModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
