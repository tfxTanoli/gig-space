import { Users, Store, Package, ShoppingCart, DollarSign } from 'lucide-react';

export interface AdminStats {
  totalUsers: number;
  totalSellers: number;
  totalServices: number;
  totalOrders: number;
  totalRevenue: number;
}

interface Props {
  stats: AdminStats | null;
  loading: boolean;
}

const CARDS = [
  { key: 'totalUsers',    label: 'Total Users',    Icon: Users,         color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  { key: 'totalSellers',  label: 'Total Sellers',  Icon: Store,         color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'totalServices', label: 'Total Services', Icon: Package,       color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { key: 'totalOrders',   label: 'Total Orders',   Icon: ShoppingCart,  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { key: 'totalRevenue',  label: 'Total Revenue',  Icon: DollarSign,    color: 'text-green-400',  bg: 'bg-green-500/10',  isCurrency: true },
] as const;

const AdminStatsCards = ({ stats, loading }: Props) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
    {CARDS.map(({ key, label, Icon, color, bg, isCurrency }) => (
      <div
        key={key}
        className="bg-[#111827] rounded-xl p-4 border border-slate-800 hover:border-slate-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
          <div className={`${bg} rounded-lg p-1.5`}>
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
        </div>

        {loading ? (
          <div className="h-7 bg-slate-800 rounded animate-pulse w-16" />
        ) : (
          <p className="text-2xl font-bold text-white">
            {isCurrency
              ? `$${((stats?.[key] as number) ?? 0).toFixed(2)}`
              : ((stats?.[key] as number) ?? 0).toLocaleString()}
          </p>
        )}
      </div>
    ))}
  </div>
);

export default AdminStatsCards;
