import { useEffect, useMemo, useState } from 'react';
import type { AdminUser } from './AdminUsersTable';
import type { AdminService } from './AdminServicesTable';
import type { AdminOrder } from './AdminOrdersTable';
import AdminPagination from './AdminPagination';

interface SubscriptionEvent { sellerName: string; amount: number; createdAt: number }

interface Props {
  users: AdminUser[];
  services: AdminService[];
  orders: AdminOrder[];
  subscriptions?: SubscriptionEvent[];
  loading: boolean;
}

type ActivityItem =
  | { kind: 'signup';       name: string; ts: number }
  | { kind: 'post';         id: string; title: string; seller: string; ts: number }
  | { kind: 'order';        buyer: string; seller: string; amount: number; ts: number }
  | { kind: 'subscription'; seller: string; amount: number; ts: number };

const PAGE_SIZE = 20;

const dot: Record<ActivityItem['kind'], string> = {
  signup:       'bg-blue-500',
  post:         'bg-purple-500',
  order:        'bg-emerald-500',
  subscription: 'bg-cyan-500',
};

const label: Record<ActivityItem['kind'], string> = {
  signup:       'New signup',
  post:         'New post',
  order:        'New order',
  subscription: 'New subscription',
};

const timeAgo = (ts: number) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
};

export default function AdminActivityFeed({ users, services, orders, subscriptions = [], loading }: Props) {
  const [page, setPage] = useState(0);

  const items: ActivityItem[] = useMemo(() => [
    ...users
      .filter((u) => u.createdAt > 0)
      .map((u): ActivityItem => ({ kind: 'signup', name: u.name || u.email, ts: u.createdAt })),
    ...services
      .filter((s) => (s.createdAt ?? 0) > 0)
      .map((s): ActivityItem => ({ kind: 'post', id: s.id, title: s.title, seller: s.sellerName, ts: s.createdAt ?? 0 })),
    ...orders
      .filter((o) => o.createdAt > 0)
      .map((o): ActivityItem => ({ kind: 'order', buyer: o.buyerName, seller: o.sellerName, amount: o.amount, ts: o.createdAt })),
    ...subscriptions
      .filter((s) => s.createdAt > 0)
      .map((s): ActivityItem => ({ kind: 'subscription', seller: s.sellerName, amount: s.amount, ts: s.createdAt })),
  ].sort((a, b) => b.ts - a.ts), [users, services, orders, subscriptions]);

  useEffect(() => { setPage(0); }, [items.length]);

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-slate-800 p-5">
        <div className="h-4 w-32 bg-slate-800 rounded animate-pulse mb-5" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-slate-800 animate-pulse mt-1.5 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-800 rounded animate-pulse w-48" />
              <div className="h-3 bg-slate-800 rounded animate-pulse w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const visible = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
        <span className="text-xs text-slate-500">{items.length.toLocaleString()} event{items.length !== 1 ? 's' : ''}</span>
      </div>

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-500 text-sm">No activity yet</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-800/60">
            {visible.map((item, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-800/20 transition-colors">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot[item.kind]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
                    {label[item.kind]}
                  </p>
                  {item.kind === 'signup' && (
                    <p className="text-sm text-white truncate">{item.name}</p>
                  )}
                  {item.kind === 'post' && (
                    <p className="text-sm text-white truncate">
                      <span className="text-slate-400">{item.seller} · </span>
                      <a
                        href={`/service-detail?id=${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-400 hover:underline transition-colors"
                        title="Open post in a new tab"
                      >
                        {item.title}
                      </a>
                    </p>
                  )}
                  {item.kind === 'order' && (
                    <p className="text-sm text-white truncate">
                      {item.buyer} → {item.seller}
                      <span className="text-emerald-400 ml-1.5 font-semibold">
                        ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </p>
                  )}
                  {item.kind === 'subscription' && (
                    <p className="text-sm text-white truncate">
                      {item.seller || 'Seller'}
                      <span className="text-cyan-400 ml-1.5 font-semibold">
                        ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                      </span>
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0 mt-0.5">
                  {timeAgo(item.ts)}
                </span>
              </li>
            ))}
          </ul>
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
