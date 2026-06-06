import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus } from 'lucide-react';
import AdminPagination from './AdminPagination';

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
  onView?:   (s: AdminService) => void;
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

const AdminServicesTable = ({ services, loading, pageSize = 100, onView, onEdit, onNew }: Props) => {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [services.length]);
  const visible = services.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Posts</h3>
          {!loading && (
            <span className="text-xs text-slate-500">{services.length.toLocaleString()} total</span>
          )}
        </div>
        {onNew && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Post
          </button>
        )}
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
                    <td className="px-5 py-3 text-slate-500 text-xs capitalize">{s.category || '—'}</td>

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
                        {onView && (
                          <button onClick={() => onView(s)} title="View" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
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

        {!loading && services.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-slate-500 text-sm">No posts found</p>
            {onNew && (
              <button onClick={onNew} className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors">
                + Create the first post
              </button>
            )}
          </div>
        )}
      </div>

      {!loading && (
        <AdminPagination page={page} pageSize={pageSize} total={services.length} onPageChange={setPage} />
      )}
    </div>
  );
};

export default AdminServicesTable;
