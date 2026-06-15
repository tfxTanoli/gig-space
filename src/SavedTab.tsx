import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Package } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import { useSavedServices } from './useSavedServices';
import { UserAvatar } from './UserAvatar';
import LocationIcon from './LocationIcon';

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
  const suffix = svc.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (svc.priceMax) return { prefix: '', price: `$${svc.priceMin} – $${svc.priceMax}`, suffix };
  return { prefix: 'From', price: `$${svc.priceMin}`, suffix };
}

const SavedTab = ({ searchQuery = '' }: { searchQuery?: string }) => {
  const { user } = useAuth();
  const { toggleSave, isSaved } = useSavedServices();
  const [services, setServices] = useState<SavedService[]>([]);
  const [loading, setLoading] = useState(true);

  const serviceUnsubs = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!user) return;

    const savedUnsub = onValue(ref(database, `savedServices/${user.uid}`), (snap) => {
      const ids: string[] = [];
      snap.forEach((child) => { ids.push(child.key!); });

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

      ids.forEach((id) => {
        if (serviceUnsubs.current[id]) return;

        serviceUnsubs.current[id] = onValue(ref(database, `services/${id}`), (svcSnap) => {
          if (!svcSnap.exists()) {
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
        <div className="border border-dashed border-slate-800 rounded-xl bg-background flex flex-col items-center justify-center min-h-[300px] gap-4">
          <Bookmark className="w-10 h-10 text-slate-500" />
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
              className="bg-primary hover:bg-blue-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
            >
              Browse services
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayed.map((svc) => {
            const { prefix, price, suffix } = formatPrice(svc);
            const location = svc.offeredRemotely
              ? (svc.primaryLocation ? `Remote (${svc.primaryLocation})` : 'Remote')
              : svc.primaryLocation;
            return (
              <div key={svc.id} className="group block">
                {/* Image */}
                <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-4 bg-surface-raised relative">
                  <Link to={`/service-detail?id=${svc.id}`} className="block w-full h-full">
                    {svc.images?.[0] ? (
                      <img
                        src={svc.images[0]}
                        alt={svc.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out will-change-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-slate-600" />
                      </div>
                    )}
                  </Link>
                  {/* Unsave button */}
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSave(svc.id); }}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                    title="Remove from saved"
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved(svc.id) ? 'fill-primary text-primary' : 'text-white'}`} />
                  </button>
                </div>

                {/* Info */}
                <Link to={`/service-detail?id=${svc.id}`} className="block">
                  <div className="flex items-center gap-2 mb-2">
                    <UserAvatar photoURL={svc.sellerPhotoURL} name={svc.sellerName} size="sm" />
                    <span className="text-sm font-medium truncate">{svc.sellerName}</span>
                  </div>
                  <h3 className="font-medium text-white mb-2 leading-snug line-clamp-2 group-hover:underline">
                    {svc.title}
                  </h3>
                  {location && (
                    <div className="flex items-center text-slate-400 text-xs mb-3">
                      <LocationIcon className="w-3 h-3 mr-1.5 shrink-0" />
                      {location}
                    </div>
                  )}
                  <div className="text-sm">
                    {prefix && <span className="text-slate-400">{prefix} </span>}
                    <span className="font-bold text-lg">{price}</span>
                    <span className="text-slate-400 text-xs ml-1">{suffix}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedTab;
