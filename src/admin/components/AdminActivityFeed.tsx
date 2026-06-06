import type { AdminUser } from './AdminUsersTable';
import type { AdminService } from './AdminServicesTable';
import type { AdminOrder } from './AdminOrdersTable';

interface Props {
  users: AdminUser[];
  services: AdminService[];
  orders: AdminOrder[];
  loading: boolean;
}

type ActivityItem =
  | { kind: 'signup';  name: string; ts: number }
  | { kind: 'post';    title: string; seller: string; ts: number }
  | { kind: 'order';   buyer: string; seller: string; amount: number; ts: number };

const WINDOW_MS = 24 * 60 * 60 * 1000;

const dot: Record<ActivityItem['kind'], string> = {
  signup: 'bg-blue-500',
  post:   'bg-purple-500',
  order:  'bg-emerald-500',
};

const label: Record<ActivityItem['kind'], string> = {
  signup: 'New signup',
  post:   'New post',
  order:  'New order',
};

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
};

export default function AdminActivityFeed({ users, services, orders, loading }: Props) {
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

  const cutoff = Date.now() - WINDOW_MS;

  const items: ActivityItem[] = [
    ...users
      .filter((u) => u.createdAt > cutoff)
      .map((u): ActivityItem => ({ kind: 'signup', name: u.name || u.email, ts: u.createdAt })),
    ...services
      .filter((s) => (s.createdAt ?? 0) > cutoff)
      .map((s): ActivityItem => ({ kind: 'post', title: s.title, seller: s.sellerName, ts: s.createdAt ?? 0 })),
    ...orders
      .filter((o) => o.createdAt > cutoff)
      .map((o): ActivityItem => ({ kind: 'order', buyer: o.buyerName, seller: o.sellerName, amount: o.amount, ts: o.createdAt })),
  ].sort((a, b) => b.ts - a.ts);

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Activity â€” Last 24 Hours</h3>
        <span className="text-xs text-slate-500">{items.length} event{items.length !== 1 ? 's' : ''}</span>
      </div>

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-500 text-sm">No activity in the last 24 hours</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800/60 max-h-[420px] overflow-y-auto">
          {items.map((item, i) => (
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
                    <span className="text-slate-400">{item.seller} Â· </span>{item.title}
                  </p>
                )}
                {item.kind === 'order' && (
                  <p className="text-sm text-white truncate">
                    {item.buyer} â†’ {item.seller}
                    <span className="text-emerald-400 ml-1.5 font-semibold">
                      ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      )}
    </div>
  );
}
