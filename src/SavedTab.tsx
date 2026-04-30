import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Package } from 'lucide-react';
import { ref, onValue, get } from 'firebase/database';
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

const SavedTab = () => {
  const { user } = useAuth();
  const { toggleSave, isSaved } = useSavedServices();
  const [services, setServices] = useState<SavedService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(database, `savedServices/${user.uid}`), async (snap) => {
      const ids: string[] = [];
      snap.forEach((child) => { ids.push(child.key!); });

      if (ids.length === 0) {
        setServices([]);
        setLoading(false);
        return;
      }

      const results: SavedService[] = [];
      await Promise.all(
        ids.map(async (id) => {
          const svc = await get(ref(database, `services/${id}`));
          if (svc.exists()) results.push({ id, ...svc.val() });
        })
      );
      setServices(results);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

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
      ) : services.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex flex-col items-center justify-center min-h-[300px] gap-4">
          <Bookmark className="w-10 h-10 text-slate-600" />
          <div className="text-center">
            <p className="text-slate-300 font-medium text-sm">No saved services yet</p>
            <p className="text-slate-500 text-xs mt-1">Tap the bookmark icon on any service to save it here.</p>
          </div>
          <Link
            to="/search"
            className="bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Browse services
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {services.map((svc) => (
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
