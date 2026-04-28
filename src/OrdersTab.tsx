import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import OrderDetail, { type Order } from './OrderDetail';

type OrderFilter = 'all' | 'pending' | 'in_progress' | 'delivered' | 'completed' | 'cancelled';

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:     { label: 'Pending',     className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'  },
  in_progress: { label: 'In Progress', className: 'bg-blue-500/20   text-blue-400   border border-blue-500/30'    },
  delivered:   { label: 'Delivered',   className: 'bg-purple-500/20 text-purple-400 border border-purple-500/30'  },
  completed:   { label: 'Completed',   className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  cancelled:   { label: 'Cancelled',   className: 'bg-slate-700/80  text-slate-400  border border-slate-600'      },
};

const filterOptions: Array<{ value: OrderFilter; label: string }> = [
  { value: 'all',         label: 'All'         },
  { value: 'pending',     label: 'Pending'     },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered',   label: 'Delivered'   },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
];

const OrdersTab = ({ mode }: { mode: 'buyer' | 'seller' }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const field = mode === 'buyer' ? 'buyerId' : 'sellerId';
    const q = query(
      ref(database, 'orders'),
      orderByChild(field),
      equalTo(user.uid)
    );
    const unsub = onValue(q, (snap) => {
      const result: Order[] = [];
      snap.forEach((child) => {
        result.push({ id: child.key!, ...child.val() });
      });
      setOrders(result.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return () => unsub();
  }, [user, mode]);

  // Derive selected order live from the real-time orders array
  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  // If an order is selected, show its detail view
  if (selectedOrder) {
    return (
      <OrderDetail
        order={selectedOrder}
        mode={mode}
        onBack={() => setSelectedOrderId(null)}
      />
    );
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const countByFilter = (f: OrderFilter) =>
    f === 'all' ? orders.length : orders.filter((o) => o.status === f).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Orders</h2>
        <p className="text-slate-400 text-sm mt-1">
          {mode === 'buyer' ? 'Track your service orders' : 'Manage orders from buyers'}
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => {
          const count = countByFilter(f.value);
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors ${
                filter === f.value
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className={`ml-1.5 text-[10px] ${filter === f.value ? 'opacity-80' : 'opacity-60'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="border border-slate-800 rounded-xl p-8 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading orders…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex flex-col items-center justify-center min-h-[300px] gap-4">
          <Package className="w-10 h-10 text-slate-600" />
          <div className="text-center">
            <p className="text-slate-300 font-medium text-sm">
              {orders.length === 0 ? 'No orders yet' : 'No orders match this filter'}
            </p>
            <p className="text-slate-500 text-xs mt-1">
              {orders.length === 0 && mode === 'buyer'
                ? 'Your orders will appear here once you book a service.'
                : orders.length === 0 && mode === 'seller'
                ? 'Incoming orders from buyers will appear here.'
                : 'Try selecting a different filter.'}
            </p>
          </div>
          {orders.length === 0 && mode === 'buyer' && (
            <Link
              to="/search"
              className="bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              Browse services
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const config = statusConfig[order.status];
            const counterparty =
              mode === 'buyer'
                ? { name: order.sellerName, photo: order.sellerPhoto, label: 'Seller' }
                : { name: order.buyerName,  photo: order.buyerPhoto,  label: 'Buyer'  };

            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className="w-full bg-[#111827] border border-slate-800 hover:border-slate-600 rounded-xl p-5 flex flex-col sm:flex-row gap-4 transition-colors text-left group"
              >
                {/* Thumbnail */}
                <div className="w-full sm:w-20 shrink-0 h-20 rounded-lg bg-[#0E1422] overflow-hidden">
                  {order.serviceImage ? (
                    <img
                      src={order.serviceImage}
                      alt={order.serviceTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-7 h-7 text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <h3 className="text-white font-semibold text-sm leading-snug line-clamp-1 flex-1">
                      {order.serviceTitle}
                    </h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${config.className}`}>
                      {config.label}
                    </span>
                  </div>

                  {order.message && (
                    <p className="text-slate-400 text-xs line-clamp-1 mb-2 italic">
                      "{order.message}"
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      {counterparty.photo ? (
                        <img
                          src={counterparty.photo}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[8px] text-white font-bold">
                          {counterparty.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      {counterparty.label}: {counterparty.name}
                    </span>
                    <span className="font-semibold text-white">
                      ${order.price}{order.priceType === 'per_hour' ? '/hr' : ''}
                    </span>
                    <span>
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden sm:flex items-center shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
