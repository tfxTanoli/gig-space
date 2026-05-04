import { Eye, Pencil, Trash2 } from 'lucide-react';

export interface AdminService {
  id: string;
  title: string;
  sellerName: string;
  price: number;
  status: string;
  imageUrl?: string | null;
  category?: string;
  description?: string;
  createdAt?: number;
}

interface Props {
  services: AdminService[];
  loading: boolean;
  onView?:   (s: AdminService) => void;
  onEdit?:   (s: AdminService) => void;
  onDelete?: (s: AdminService) => void;
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

const AdminServicesTable = ({ services, loading, onView, onEdit, onDelete }: Props) => (
  <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-white">Recent Services</h3>
      {!loading && (
        <span className="text-xs text-slate-500">{services.length} shown</span>
      )}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {['Image', 'Title', 'Seller', 'Price', 'Status', 'Actions'].map((h) => (
              <th
                key={h}
                className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
            : services.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  {/* Image */}
                  <td className="px-5 py-3">
                    {s.imageUrl ? (
                      <img
                        src={s.imageUrl}
                        alt={s.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-700/60"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center flex-shrink-0">
                        <span className="text-slate-600 text-xs font-bold">
                          {s.title?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Title */}
                  <td className="px-5 py-3 text-white font-medium max-w-[200px] truncate">
                    {s.title || '—'}
                  </td>

                  {/* Seller */}
                  <td className="px-5 py-3 text-slate-400">{s.sellerName || '—'}</td>

                  {/* Price */}
                  <td className="px-5 py-3 text-slate-300">${s.price.toFixed(2)}</td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        s.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {s.status || 'active'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {onView && (
                        <button
                          onClick={() => onView(s)}
                          title="View"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(s)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(s)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>

      {!loading && services.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-8">No services found</p>
      )}
    </div>
  </div>
);

export default AdminServicesTable;
