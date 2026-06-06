import { useEffect } from 'react';
import { X, Tag, User, DollarSign, Calendar, Hash, FileText, Layers } from 'lucide-react';
import { type AdminService } from './AdminServicesTable';

interface Props {
  service: AdminService;
  onClose: () => void;
}

const Field = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-white break-all">{value || 'â€”'}</p>
    </div>
  </div>
);

const AdminServiceViewModal = ({ service, onClose }: Props) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Service Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image + title */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-800">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt={service.title}
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-slate-700/60"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center flex-shrink-0">
              <Tag className="w-6 h-6 text-slate-500" />
            </div>
          )}
          <div>
            <p className="text-white font-semibold line-clamp-2">{service.title || 'â€”'}</p>
            <span
              className={`mt-1.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                service.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {service.status || 'active'}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-4">
          <Field icon={User}      label="Seller"      value={service.sellerName} />
          <Field icon={DollarSign} label="Starting Price" value={`$${service.price.toFixed(2)}`} />
          <Field icon={Layers}    label="Category"    value={service.category ?? ''} />
          <Field icon={FileText}  label="Description" value={service.description ?? ''} />
          <Field icon={Calendar}  label="Posted"      value={service.createdAt ? new Date(service.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''} />
          <Field icon={Hash}      label="Service ID"  value={service.id} />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminServiceViewModal;
