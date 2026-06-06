import type { ComponentType } from 'react';
import { ShoppingCart, DollarSign, TrendingUp, Users, Store, CreditCard } from 'lucide-react';

const PostsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2.5H4.16667C3.72464 2.5 3.30072 2.67559 2.98816 2.98816C2.67559 3.30072 2.5 3.72464 2.5 4.16667V15.8333C2.5 16.2754 2.67559 16.6993 2.98816 17.0118C3.30072 17.3244 3.72464 17.5 4.16667 17.5H15.8333C16.2754 17.5 16.6993 17.3244 17.0118 17.0118C17.3244 16.6993 17.5 16.2754 17.5 15.8333V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.3125 2.18769C15.644 1.85617 16.0937 1.66992 16.5625 1.66992C17.0313 1.66992 17.481 1.85617 17.8125 2.18769C18.144 2.51921 18.3303 2.96885 18.3303 3.43769C18.3303 3.90653 18.144 4.35617 17.8125 4.68769L10.3017 12.1994C10.1038 12.3971 9.85934 12.5418 9.59083 12.6202L7.19667 13.3202C7.12496 13.3411 7.04895 13.3424 6.97659 13.3238C6.90423 13.3053 6.83819 13.2676 6.78537 13.2148C6.73256 13.162 6.69491 13.096 6.67637 13.0236C6.65783 12.9512 6.65909 12.8752 6.68 12.8035L7.38 10.4094C7.45877 10.1411 7.60378 9.8969 7.80167 9.69936L15.3125 2.18769Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AffiliateIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="4" cy="14" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="16" cy="14" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10 8.5V11M10 11L4 12.5M10 11L16 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export interface AdminStats {
  totalUsers: number;
  totalSellers: number;
  totalServices: number;
  totalOrders: number;
  totalRevenue: number;
  activeSubscribers: number;
  subscriptionRevenue: number;
  totalAffiliates: number;
}

interface Props {
  stats: AdminStats | null;
  loading: boolean;
}

interface CardDef {
  key: keyof AdminStats;
  label: string;
  hint?: (s: AdminStats) => string;
  Icon: ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  isCurrency?: boolean;
}

const CARDS: CardDef[] = [
  {
    key: 'totalUsers',
    label: 'Total Users',
    Icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    key: 'totalSellers',
    label: 'Sellers',
    Icon: Store,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    hint: (s) => s.totalUsers > 0 ? `of ${s.totalUsers.toLocaleString()} users` : '',
  },
  {
    key: 'totalServices',
    label: 'Total Posts',
    Icon: PostsIcon,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    key: 'totalOrders',
    label: 'Total Orders',
    Icon: ShoppingCart,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    key: 'totalRevenue',
    label: 'Total Revenue',
    Icon: DollarSign,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    isCurrency: true,
  },
  {
    key: 'activeSubscribers',
    label: 'Active Subscribers',
    Icon: CreditCard,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
  },
  {
    key: 'subscriptionRevenue',
    label: 'Subscription Revenue',
    Icon: TrendingUp,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    isCurrency: true,
  },
  {
    key: 'totalAffiliates',
    label: 'Total Affiliates',
    Icon: AffiliateIcon,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
];

const fmt = (n: number, isCurrency?: boolean) => {
  if (isCurrency) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n.toLocaleString('en-US');
};

const AdminStatsCards = ({ stats, loading }: Props) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    {CARDS.map(({ key, label, hint, Icon, color, bg, isCurrency }) => {
      const hintText = !loading && stats && hint ? hint(stats) : '';
      return (
        <div
          key={key}
          className="bg-surface rounded-xl p-4 border border-slate-800 hover:border-slate-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide leading-tight">{label}</span>
            <div className={`${bg} rounded-lg p-1.5 flex-shrink-0`}>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
            </div>
          </div>

          {loading ? (
            <div className="h-7 bg-slate-800 rounded animate-pulse w-16" />
          ) : (
            <>
              <p className="text-2xl font-bold text-white">
                {fmt((stats?.[key] as number) ?? 0, isCurrency)}
              </p>
              {hintText && <p className="text-xs text-slate-500 mt-1">{hintText}</p>}
            </>
          )}
        </div>
      );
    })}
  </div>
);

export default AdminStatsCards;
