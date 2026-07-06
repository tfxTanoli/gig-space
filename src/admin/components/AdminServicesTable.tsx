import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus } from 'lucide-react';
import { useCategories } from '../../CategoriesContext';
import AdminPagination from './AdminPagination';

const SELECT_CLASS =
  'bg-surface-raised border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors';

const PRICE_BANDS: Record<string, (p: number) => boolean> = {
  all:       () => true,
  lt50:      (p) => p < 50,
  '50-200':  (p) => p >= 50 && p < 200,
  '200-500': (p) => p >= 200 && p < 500,
  gt500:     (p) => p >= 500,
};
const PRICE_LABELS: Record<string, string> = {
  all: 'All prices', lt50: 'Under $50', '50-200': '$50–$200', '200-500': '$200–$500', gt500: '$500+',
};

export interface AdminService {
  id: string;
  title: string;
  sellerName: string;
  sellerId?: string;
  price: number;
  priceMin?: number;
  priceMax?: number | null;
  priceType?: 'per_project' | 'per_hour';
  status: string;
  imageUrl?: string | null;
  images?: string[];
  category?: string;
  subcategory?: string;
  description?: string;
  primaryLocation?: string;
  extraLocations?: string[];
  offeredRemotely?: boolean;
  languages?: string[];
  createdAt?: number;
}

interface Props {
  services: AdminService[];
  loading: boolean;
  pageSize?: number;
  onEdit?:   (s: AdminService) => void;
  onDelete?: (s: AdminService) => void;
  onNew?:    () => void;
}

const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="border-b border-slate-800/50">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-5 py-3">
        <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}px` }} />
      </td>
    ))}
  </tr>
);

const AdminServicesTable = ({ services, loading, pageSize = 100, onEdit, onNew }: Props) => {
  // Filter lists the platform's real categories (Settings-managed), not whatever
  // stale values happen to exist on old posts.
  const { categoryOptions, getCategoryLabel } = useCategories();
  const [page, setPage] = useState(0);
  const [catFilter,    setCatFilter]    = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priceFilter,  setPriceFilter]  = useState('all');
  useEffect(() => { setPage(0); }, [services.length, catFilter, statusFilter, priceFilter]);
  const statuses = useMemo(
    () => Array.from(new Set(services.map((s) => s.status || 'active'))).sort(),
    [services],
  );

  const filtered = useMemo(() => services.filter((s) => {
    if (catFilter !== 'all' && s.category !== catFilter) return false;
    if (statusFilter !== 'all' && (s.status || 'active') !== statusFilter) return false;
    if (!PRICE_BANDS[priceFilter](s.priceMin ?? s.price ?? 0)) return false;
    return true;
  }), [services, catFilter, statusFilter, priceFilter]);

  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Posts</h3>
          {!loading && (
            <span className="text-xs text-slate-500">{filtered.length.toLocaleString()} total</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={SELECT_CLASS} aria-label="Filter by category">
            <option value="all">All categories</option>
            {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} className={SELECT_CLASS} aria-label="Filter by price">
            {Object.keys(PRICE_BANDS).map((k) => <option key={k} value={k}>{PRICE_LABELS[k]}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={SELECT_CLASS} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {statuses.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          {onNew && (
            <button
              onClick={onNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Post
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['Image', 'Title', 'Seller', 'Price', 'Category', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              : visible.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    {/* Image */}
                    <td className="px-5 py-3">
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt={s.title} className="w-10 h-10 rounded-lg object-cover border border-slate-700/60" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center">
                          <span className="text-slate-600 text-xs font-bold">{s.title?.charAt(0)?.toUpperCase() ?? '?'}</span>
                        </div>
                      )}
                    </td>

                    {/* Title */}
                    <td className="px-5 py-3 text-white font-medium max-w-[200px] truncate">{s.title || '—'}</td>

                    {/* Seller */}
                    <td className="px-5 py-3 text-slate-400">{s.sellerName || '—'}</td>

                    {/* Price */}
                    <td className="px-5 py-3 text-slate-300 whitespace-nowrap">
                      ${(s.priceMin ?? s.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {s.priceMax ? ` – $${s.priceMax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3 text-slate-500 text-xs">{s.category ? getCategoryLabel(s.category) : '—'}</td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        s.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : s.status === 'paused'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {s.status || 'active'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => window.open(`/service-detail?id=${s.id}`, '_blank', 'noopener,noreferrer')}
                          title="Open live post in new tab"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onEdit && (
                          <button onClick={() => onEdit(s)} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-slate-500 text-sm">No posts found</p>
            {onNew && services.length === 0 && (
              <button onClick={onNew} className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors">
                + Create the first post
              </button>
            )}
          </div>
        )}
      </div>

      {!loading && (
        <AdminPagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      )}
    </div>
  );
};

export default AdminServicesTable;
