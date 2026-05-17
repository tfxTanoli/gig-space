import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Package } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import { useSavedServices } from './useSavedServices';
import { UserAvatar } from './UserAvatar';

interface SavedService {
  id: string;
  title: string;
  sellerName: string;
  sellerPhotoURL: string;
  priceMin: number;
  priceMax: number | null;
  priceType: 'per_project' | 'per_hour';
  images: string[];
  primaryLocation: string;
  offeredRemotely: boolean;
}

function formatPrice(svc: SavedService) {
  const suffix = svc.priceType === 'per_hour' ? '/hr' : '/project';
  if (svc.priceMax) return `$${svc.priceMin} – $${svc.priceMax}${suffix}`;
  return `$${svc.priceMin}${suffix}`;
}

const SavedTab = ({ searchQuery = '' }: { searchQuery?: string }) => {
  const { user } = useAuth();
  const { toggleSave, isSaved } = useSavedServices();
  const [services, setServices] = useState<SavedService[]>([]);
  const [loading, setLoading] = useState(true);

  // Track per-service onValue unsubscribers so we can tear down when a service
  // is removed from the saved list without remounting the whole component.
  const serviceUnsubs = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!user) return;

    // Listen to the saved-IDs list first
    const savedUnsub = onValue(ref(database, `savedServices/${user.uid}`), (snap) => {
      const ids: string[] = [];
      snap.forEach((child) => { ids.push(child.key!); });

      // Tear down listeners for IDs no longer saved
      Object.keys(serviceUnsubs.current).forEach((id) => {
        if (!ids.includes(id)) {
          serviceUnsubs.current[id]();
          delete serviceUnsubs.current[id];
          setServices((prev) => prev.filter((s) => s.id !== id));
        }
      });

      if (ids.length === 0) {
        setServices([]);
        setLoading(false);
        return;
      }

      // Subscribe to each service node that isn't already subscribed
      ids.forEach((id) => {
        if (serviceUnsubs.current[id]) return; // already listening

        serviceUnsubs.current[id] = onValue(ref(database, `services/${id}`), (svcSnap) => {
          if (!svcSnap.exists()) {
            // Service deleted — remove from list and clean up listener
            setServices((prev) => prev.filter((s) => s.id !== id));
            serviceUnsubs.current[id]?.();
            delete serviceUnsubs.current[id];
            return;
          }
          const data: SavedService = { id, ...svcSnap.val() };
          setServices((prev) => {
            const idx = prev.findIndex((s) => s.id === id);
            if (idx === -1) return [...prev, data];
            const next = [...prev];
            next[idx] = data;
            return next;
          });
          setLoading(false);
        });
      });

      setLoading(false);
    });

    return () => {
      savedUnsub();
      Object.values(serviceUnsubs.current).forEach((fn) => fn());
      serviceUnsubs.current = {};
    };
  }, [user]);

  const q = searchQuery.toLowerCase().trim();
  const displayed = q
    ? services.filter((s) => s.title?.toLowerCase().includes(q) || s.sellerName?.toLowerCase().includes(q))
    : services;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Saved Services</h2>
        <p className="text-slate-400 text-sm mt-1">Services you've bookmarked</p>
      </div>

      {loading ? (
        <div className="border border-slate-800 rounded-xl p-8 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading saved services…</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex flex-col items-center justify-center min-h-[300px] gap-4">
          <Bookmark className="w-10 h-10 text-slate-600" />
          <div className="text-center">
            <p className="text-slate-300 font-medium text-sm">
              {services.length === 0 ? 'No saved services yet' : 'No saved services match'}
            </p>
            <p className="text-slate-500 text-xs mt-1">
              {services.length === 0
                ? 'Tap the bookmark icon on any service to save it here.'
                : 'Try a different search term.'}
            </p>
          </div>
          {services.length === 0 && (
            <Link
              to="/search"
              className="bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              Browse services
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map((svc) => (
            <div key={svc.id} className="bg-[#111827] border border-slate-800 hover:border-slate-600 rounded-xl overflow-hidden transition-colors group flex flex-col">
              {/* Image */}
              <Link to={`/service-detail?id=${svc.id}`} className="block relative aspect-[4/3] bg-[#1A2035] overflow-hidden">
                {svc.images?.[0] ? (
                  <img
                    src={svc.images[0]}
                    alt={svc.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-slate-600" />
                  </div>
                )}
                {/* Unsave button overlay */}
                <button
                  onClick={(e) => { e.preventDefault(); toggleSave(svc.id); }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                  title="Remove from saved"
                >
                  <Bookmark className={`w-4 h-4 ${isSaved(svc.id) ? 'fill-primary text-primary' : 'text-white'}`} />
                </button>
              </Link>

              {/* Body */}
              <div className="p-3.5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <UserAvatar photoURL={svc.sellerPhotoURL} name={svc.sellerName} size="sm" />
                  <span className="text-slate-400 text-xs truncate">{svc.sellerName}</span>
                </div>

                <Link to={`/service-detail?id=${svc.id}`}>
                  <h3 className="text-white text-sm font-semibold line-clamp-2 leading-snug mb-2 hover:text-blue-400 transition-colors">
                    {svc.title}
                  </h3>
                </Link>

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800">
                  <span className="text-white text-sm font-bold">{formatPrice(svc)}</span>
                  <span className="text-slate-500 text-xs">
                    {svc.offeredRemotely ? 'Remote' : svc.primaryLocation}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedTab;
