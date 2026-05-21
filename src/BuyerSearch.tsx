import { useState, useEffect, useRef, useCallback, memo, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  MessageCircle,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  LayoutDashboard,
  MessageSquare,
  Settings,
  LogOut,
  Loader2,
  Star,
  Check,
  X,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import Logo from './Logo';
import LocationSearch from './LocationSearch';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';
import { ref, get, query, orderByChild, limitToLast, endBefore } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import { useSavedServices } from './useSavedServices';
import { geocodeCache, geocodeLocation, haversineDistanceMiles } from './photon';
import {
  categoryOptions,
  subcategoryMap,
  getCategoryLabel,
  getSubcategoryLabel,
} from './categories';

const PAGE_SIZE = 50;

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc';
type RemoteOption = '' | 'remote' | 'in_person';
type VerifiedOption = '' | 'yes' | 'no';
type OnlineOption = '' | 'online';

interface SellerMeta {
  verified: boolean;
  rating: number;
}

const FilterDropdown = ({
  label, isOpen, active, onToggle, children, align = 'right',
}: {
  label: ReactNode; isOpen: boolean; active: boolean; onToggle: () => void; children: ReactNode; align?: 'left' | 'right';
}) => (
  <div className="relative">
    <button
      onClick={onToggle}
      className={`flex items-center text-sm transition-colors gap-1 ${active ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'}`}
    >
      {label}
      <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && (
      <div className={`absolute top-full ${align === 'left' ? 'left-0' : 'right-0'} mt-2 min-w-[180px] bg-[#111827] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50`}>
        {children}
      </div>
    )}
  </div>
);

const Opt = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selected ? 'text-white bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
  >
    {label}
  </button>
);

const RadioOpt = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-slate-300 hover:text-white hover:bg-slate-800"
  >
    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-blue-400' : 'border-slate-500'}`}>
      {selected && <span className="w-2 h-2 rounded-full bg-blue-400" />}
    </span>
    {label}
  </button>
);

const RadioFooter = ({ onClear, onApply }: { onClear: () => void; onApply: () => void }) => (
  <div className="border-t border-slate-800 flex items-center justify-between px-4 py-3">
    <button type="button" onClick={onClear} className="text-sm text-slate-400 hover:text-white transition-colors">
      Clear all
    </button>
    <button type="button" onClick={onApply} className="bg-primary hover:bg-blue-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
      Apply
    </button>
  </div>
);

interface ServicePost {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerPhotoURL: string;
  title: string;
  category: string;
  subcategory?: string;
  languages?: string[];
  priceMin: number;
  priceMax: number | null;
  priceType: 'per_project' | 'per_hour';
  images: string[];
  primaryLocation: string;
  primaryLocationLat?: number;
  primaryLocationLng?: number;
  offeredRemotely: boolean;
  status: 'active' | 'paused';
  createdAt: number;
}

function formatPrice(post: ServicePost) {
  const suffix = post.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (post.priceMax) return { prefix: '', price: `$${post.priceMin} – $${post.priceMax}`, suffix };
  return { prefix: 'From', price: `$${post.priceMin}`, suffix };
}

interface ServiceCardProps {
  post: ServicePost;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
}

const ServiceCard = memo(({ post, isSaved, onToggleSave }: ServiceCardProps) => {
  const { prefix, price, suffix } = formatPrice(post);
  const location = post.offeredRemotely ? 'Remote / Online' : post.primaryLocation;
  return (
    <div className="group block">
      <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-4 bg-[#1A2035] relative">
        <Link to={`/service-detail?id=${post.id}`} className="block w-full h-full">
          {post.images?.[0] ? (
            <img
              src={post.images[0]}
              alt={post.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out will-change-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-slate-600 text-xs">No image</span>
            </div>
          )}
        </Link>
        <button
          onClick={() => onToggleSave(post.id)}
          className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
          title={isSaved ? 'Remove from saved' : 'Save service'}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-primary text-primary' : 'text-white'}`} />
        </button>
      </div>

      <Link to={`/service-detail?id=${post.id}`} className="block">
        <div className="flex items-center gap-2 mb-2">
          <UserAvatar photoURL={post.sellerPhotoURL} name={post.sellerName} size="sm" />
          <span className="text-sm font-medium truncate">{post.sellerName}</span>
        </div>
        <h3 className="font-medium text-white mb-2 leading-snug line-clamp-2 group-hover:underline">
          {post.title}
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
});

const BuyerSearch = () => {
  const { user, userProfile, logout } = useAuth();
  const { isSaved, toggleSave } = useSavedServices();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [sellerMeta, setSellerMeta] = useState<Record<string, SellerMeta>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [inputValue, setInputValue] = useState(() => searchParams.get('q') ?? '');
  const [activeSearch, setActiveSearch] = useState(() => searchParams.get('q') ?? '');
  const [activeCategory, setActiveCategory] = useState(() => searchParams.get('category') ?? '');
  const [activeSubcategory, setActiveSubcategory] = useState('');
  const [activeLocation, setActiveLocation] = useState(() => searchParams.get('location') ?? '');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationType, setLocationType] = useState<'precise' | 'broad' | ''>('');
  const [searchRadius, setSearchRadius] = useState(0);
  const [pendingRadius, setPendingRadius] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedOption>('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [remoteFilter, setRemoteFilter] = useState<RemoteOption>('');
  const [onlineFilter, setOnlineFilter] = useState<OnlineOption>('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Pending states for radio-group filters (committed on Apply).
  const [pendingVerified, setPendingVerified] = useState<VerifiedOption>('');
  const [pendingRemote, setPendingRemote] = useState<RemoteOption>('');
  const [pendingOnline, setPendingOnline] = useState<OnlineOption>('');

  // Incremented whenever geocoding batch completes to trigger re-render.
  const [geoVersion, setGeoVersion] = useState(0);
  void geoVersion; // consumed via the state setter, suppress lint warning

  const menuRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const urlSyncRef = useRef('');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollArrows = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  const scrollCategories = useCallback((dir: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    updateScrollArrows();
    window.addEventListener('resize', updateScrollArrows);
    return () => window.removeEventListener('resize', updateScrollArrows);
  }, [updateScrollArrows]);

  const toggleDropdown = useCallback(
    (name: string) => {
      setOpenDropdown((prev) => {
        const next = prev === name ? null : name;
        if (next === 'verified') setPendingVerified(verifiedFilter);
        if (next === 'remote') setPendingRemote(remoteFilter);
        if (next === 'online') setPendingOnline(onlineFilter);
        if (next === 'radius') setPendingRadius(searchRadius);
        return next;
      });
    },
    [verifiedFilter, remoteFilter, onlineFilter, searchRadius],
  );

  const selectCategory = useCallback((value: string) => {
    setActiveCategory((prev) => (prev === value ? '' : value));
    setActiveSubcategory('');
  }, []);

  const clearCategory = useCallback(() => {
    setActiveCategory('');
    setActiveSubcategory('');
  }, []);

  const applyBudget = useCallback(() => {
    const v = parseInt(budgetInput, 10);
    setBudgetMax(Number.isFinite(v) && v > 0 ? v : null);
    setOpenDropdown(null);
  }, [budgetInput]);

  const clearBudget = useCallback(() => {
    setBudgetInput('');
    setBudgetMax(null);
    setOpenDropdown(null);
  }, []);

  const toggleLanguage = useCallback((lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }, []);

  const handleLocationChange = useCallback(
    (label: string, coords?: { lat: number; lng: number } | null, lt?: 'precise' | 'broad') => {
      setActiveLocation(label);
      setLocationCoords(coords ?? null);
      setLocationType(lt ?? '');
      if (!label || lt === 'broad') setSearchRadius(0);
    },
    [],
  );

  const clearAllFilters = useCallback(() => {
    setActiveSearch('');
    setInputValue('');
    setActiveLocation('');
    setLocationCoords(null);
    setLocationType('');
    setSearchRadius(0);
    setPendingRadius(0);
    setActiveSubcategory('');
    setSortBy('newest');
    setBudgetMax(null);
    setBudgetInput('');
    setMinRating(0);
    setVerifiedFilter('');
    setSelectedLanguages([]);
    setRemoteFilter('');
    setOnlineFilter('');
    setOpenDropdown(null);
  }, []);

  const hasActiveFilters =
    activeSearch !== '' || activeLocation !== '' || activeSubcategory !== '' ||
    sortBy !== 'newest' || budgetMax !== null || minRating > 0 ||
    verifiedFilter !== '' || selectedLanguages.length > 0 || remoteFilter !== '' ||
    onlineFilter !== '' || searchRadius > 0;

  const commitSearch = useCallback(() => {
    setActiveSearch(inputValue.trim());
  }, [inputValue]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const handleLogout = useCallback(async () => {
    setShowMenu(false);
    await logout();
  }, [logout]);

  // Keep URL in sync with active search/location so browser back restores the correct state.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeSearch) params.set('q', activeSearch);
    if (activeLocation) params.set('location', activeLocation);
    const newSearch = params.toString() ? `?${params.toString()}` : '';
    if (newSearch !== urlSyncRef.current) {
      urlSyncRef.current = newSearch;
      navigate({ pathname: '/search', search: newSearch }, { replace: true });
    }
  }, [activeSearch, activeLocation, navigate]);

  // Geocode the initial location label (seeded from URL param) so radius works on first load.
  useEffect(() => {
    if (!activeLocation || locationCoords) return;
    geocodeLocation(activeLocation).then((result) => {
      if (result) {
        setLocationCoords({ lat: result.lat, lng: result.lng });
        setLocationType(result.locationType);
      }
    });
  }, [activeLocation, locationCoords]);

  // Batch-geocode post locations whenever radius filtering is active.
  useEffect(() => {
    if (!searchRadius || !locationCoords) return;
    const toGeocode = Array.from(
      new Set(
        posts
          .filter((p) => !p.offeredRemotely && p.primaryLocation)
          .map((p) => p.primaryLocation)
          .filter((loc) => !geocodeCache.has(loc)),
      ),
    );
    if (toGeocode.length === 0) return;
    let cancelled = false;
    Promise.all(toGeocode.map((loc) => geocodeLocation(loc))).then(() => {
      if (!cancelled) setGeoVersion((v) => v + 1);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, searchRadius, locationCoords]);

  const fetchPage = useCallback(async (beforeTimestamp?: number) => {
    const q = beforeTimestamp
      ? query(ref(database, 'services'), orderByChild('createdAt'), endBefore(beforeTimestamp), limitToLast(PAGE_SIZE))
      : query(ref(database, 'services'), orderByChild('createdAt'), limitToLast(PAGE_SIZE));

    const snap = await get(q);
    const result: ServicePost[] = [];
    snap.forEach((child) => {
      const val = child.val();
      if (val.status === 'active') result.push({ id: child.key!, ...val });
    });
    result.sort((a, b) => b.createdAt - a.createdAt);
    return result;
  }, []);

  useEffect(() => {
    fetchPage()
      .then((result) => {
        setPosts(result);
        setHasMore(result.length === PAGE_SIZE);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [fetchPage]);

  useEffect(() => {
    const missing = Array.from(new Set(posts.map((p) => p.sellerId))).filter(
      (id) => id && !(id in sellerMeta),
    );
    if (missing.length === 0) return;
    let cancelled = false;

    Promise.all(
      missing.map(async (id) => {
        const [verifiedSnap, ratingSnap] = await Promise.all([
          get(ref(database, `users/${id}/emailVerified`)).catch(() => null),
          get(ref(database, `userRatings/${id}`)).catch(() => null),
        ]);
        const r = ratingSnap?.val();
        const rating = r && r.reviewCount > 0 ? r.totalStars / r.reviewCount : 0;
        return [id, { verified: verifiedSnap?.val() === true, rating }] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setSellerMeta((prev) => {
        const next = { ...prev };
        for (const [id, meta] of entries) next[id] = meta;
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [posts, sellerMeta]);

  const loadMore = useCallback(async () => {
    if (loadingMore || posts.length === 0) return;
    setLoadingMore(true);
    const oldest = posts[posts.length - 1].createdAt;
    try {
      const more = await fetchPage(oldest);
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((p) => !ids.has(p.id))];
      });
      setHasMore(more.length === PAGE_SIZE);
    } catch {
      // silently ignore
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, posts, fetchPage]);

  const handleToggleSave = useCallback((id: string) => toggleSave(id), [toggleSave]);

  const languageOptions: string[] = Array.from(
    new Set(posts.flatMap((p) => p.languages ?? []).filter(Boolean)),
  ).sort();

  const q = activeSearch.toLowerCase();
  const displayedPosts = posts
    .filter((p) => {
      const matchesSearch = !q ||
        p.title?.toLowerCase().includes(q) ||
        p.sellerName?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q);

      const matchesCategory = !activeCategory || p.category === activeCategory;
      const matchesSubcategory = !activeSubcategory || p.subcategory === activeSubcategory;

      const matchesLocation = (() => {
        if (!activeLocation) return true;
        if (!p.primaryLocation) return false;
        const a = activeLocation.toLowerCase();
        const b = p.primaryLocation.toLowerCase();
        if (a.includes(b) || b.includes(a)) return true;
        const cityA = a.split(',')[0].trim();
        const cityB = b.split(',')[0].trim();
        return cityA.length > 0 && cityA === cityB;
      })();

      const matchesBudget = budgetMax == null || p.priceMin <= budgetMax;

      const matchesRemote =
        !remoteFilter ||
        (remoteFilter === 'remote' ? p.offeredRemotely : !p.offeredRemotely);

      const matchesLanguage =
        selectedLanguages.length === 0 ||
        (p.languages ?? []).some((l) => selectedLanguages.includes(l));

      const meta = sellerMeta[p.sellerId];
      const matchesRating = minRating === 0 || !meta || meta.rating >= minRating;
      const matchesVerified =
        !verifiedFilter || !meta ||
        (verifiedFilter === 'yes' ? meta.verified : !meta.verified);

      const matchesRadius = (() => {
        if (!searchRadius || !locationCoords) return true;
        if (p.offeredRemotely) return true;
        // Prefer coordinates stored on the post at creation time.
        if (p.primaryLocationLat != null && p.primaryLocationLng != null) {
          return haversineDistanceMiles(locationCoords.lat, locationCoords.lng, p.primaryLocationLat, p.primaryLocationLng) <= searchRadius;
        }
        // Fall back to client-side geocode cache for older posts.
        const loc = p.primaryLocation;
        if (!loc) return false;
        if (!geocodeCache.has(loc)) return true; // not yet geocoded — pass through
        const coords = geocodeCache.get(loc);
        if (!coords) return true; // geocode failed — pass through
        return (
          haversineDistanceMiles(locationCoords.lat, locationCoords.lng, coords.lat, coords.lng) <=
          searchRadius
        );
      })();

      const matchesOnline = true; // online status not yet tracked per-seller

      return matchesSearch && matchesCategory && matchesSubcategory && matchesLocation &&
        matchesBudget && matchesRemote && matchesLanguage && matchesRating && matchesVerified &&
        matchesRadius && matchesOnline;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'price_asc') return a.priceMin - b.priceMin;
      if (sortBy === 'price_desc') return b.priceMin - a.priceMin;
      return b.createdAt - a.createdAt;
    });

  const filterChips: { key: string; label: ReactNode; onRemove: () => void }[] = [];
  if (activeSearch) filterChips.push({ key: 'search', label: `"${activeSearch}"`, onRemove: () => { setActiveSearch(''); setInputValue(''); } });
  if (activeLocation) filterChips.push({ key: 'location', label: activeLocation, onRemove: () => { setActiveLocation(''); setLocationCoords(null); setSearchRadius(0); } });
  if (searchRadius > 0) filterChips.push({ key: 'radius', label: `Within ${searchRadius} mi`, onRemove: () => setSearchRadius(0) });
  if (activeSubcategory) filterChips.push({ key: 'subcategory', label: getSubcategoryLabel(activeCategory, activeSubcategory), onRemove: () => setActiveSubcategory('') });
  if (budgetMax != null) filterChips.push({ key: 'budget', label: `Up to $${budgetMax.toLocaleString()}`, onRemove: clearBudget });
  if (minRating > 0) filterChips.push({
    key: 'rating',
    label: (
      <span className="flex items-center gap-0.5">
        {minRating}
        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
        {' & up'}
      </span>
    ),
    onRemove: () => setMinRating(0),
  });
  if (verifiedFilter) filterChips.push({ key: 'verified', label: verifiedFilter === 'yes' ? 'Verified' : 'Not verified', onRemove: () => setVerifiedFilter('') });
  if (remoteFilter) filterChips.push({ key: 'remote', label: remoteFilter === 'remote' ? 'Remote only' : 'In-person only', onRemove: () => setRemoteFilter('') });
  if (onlineFilter) filterChips.push({ key: 'online', label: 'Online now', onRemove: () => setOnlineFilter('') });
  selectedLanguages.forEach((lang) =>
    filterChips.push({ key: `lang-${lang}`, label: lang, onRemove: () => setSelectedLanguages((prev) => prev.filter((l) => l !== lang)) }),
  );

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">
      {/* Header — 3-column grid so search bar is centered */}
      <header className="w-full px-6 py-4 lg:px-12 grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-slate-800">
        <Logo className="h-6" />

        <div className="hidden md:flex items-center justify-center">
          <div className="flex items-center bg-[#0E1422] border border-slate-700 rounded-lg h-10 w-full max-w-xl">
            <LocationSearch
              value={activeLocation}
              onChange={handleLocationChange}
              variant="header"
            />
            <input
              type="text"
              placeholder="Search for a service"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
              className="flex-1 bg-transparent px-4 text-sm text-white focus:outline-none placeholder-slate-500"
            />
            <button
              onClick={commitSearch}
              className="bg-primary h-full px-4 flex items-center justify-center hover:bg-blue-600 transition-colors rounded-r-lg"
            >
              <Search className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-6 shrink-0">
          <span className="text-slate-600" aria-hidden="true">
            <MessageCircle className="w-5 h-5" />
          </span>
          <span className="text-slate-600" aria-hidden="true" title="Notifications coming soon">
            <Bell className="w-5 h-5" />
          </span>
          {user && (
            <Link to="/post-service" className="text-sm font-medium hover:text-primary transition-colors text-slate-300 hidden sm:block">
              Create New Post
            </Link>
          )}
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
                aria-label="Open user menu"
                aria-expanded={showMenu}
              >
                <CurrentUserAvatar size="sm" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-800">
                    <p className="text-white text-sm font-semibold truncate">
                      {userProfile?.name ?? 'User'}
                    </p>
                    <p className="text-slate-500 text-xs truncate mt-0.5">
                      {user?.email ?? ''}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link to="/buyer-dashboard" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                      <LayoutDashboard className="w-4 h-4 shrink-0 text-slate-500" />
                      Dashboard
                    </Link>
                    <Link to="/buyer-dashboard?tab=Messages" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                      <MessageSquare className="w-4 h-4 shrink-0 text-slate-500" />
                      Messages
                    </Link>
                    <Link to="/buyer-dashboard?tab=Saved" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                      <Bookmark className="w-4 h-4 shrink-0 text-slate-500" />
                      Saved Services
                    </Link>
                    <Link to="/buyer-dashboard?tab=Settings" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                      <Settings className="w-4 h-4 shrink-0 text-slate-500" />
                      Settings
                    </Link>
                  </div>

                  <div className="border-t border-slate-800 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-slate-800/80 transition-colors"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/signin" className="text-sm font-medium text-white px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors">
              Log in
            </Link>
          )}
        </div>
      </header>

      {/* Category Nav */}
      <nav className="w-full border-b border-slate-800 relative flex items-center">
        {canScrollLeft && (
          <button
            onClick={() => scrollCategories('left')}
            className="absolute left-0 z-10 h-full px-2 bg-gradient-to-r from-[#0E1422] via-[#0E1422]/90 to-transparent flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          ref={categoryScrollRef}
          onScroll={updateScrollArrows}
          className="overflow-x-auto px-6 lg:px-12 py-3 flex-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <ul className="flex items-center text-sm text-slate-400 whitespace-nowrap font-medium min-w-max w-full justify-between">
            {categoryOptions.map((cat) => (
              <li key={cat.value}>
                <button
                  onClick={() => selectCategory(cat.value)}
                  className={`transition-colors ${activeCategory === cat.value ? 'text-white' : 'hover:text-white'}`}
                >
                  {cat.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {canScrollRight && (
          <button
            onClick={() => scrollCategories('right')}
            className="absolute right-0 z-10 h-full px-2 bg-gradient-to-l from-[#0E1422] via-[#0E1422]/90 to-transparent flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 px-6 lg:px-12 py-10">
        {activeCategory && (
          <nav className="text-sm font-medium mb-3">
            <button onClick={clearCategory} className="text-slate-400 hover:text-white transition-colors">
              All Services
            </button>
            <span className="text-slate-600 mx-2">/</span>
            <span className="text-white">{getCategoryLabel(activeCategory)}</span>
          </nav>
        )}

        <h1 className="text-3xl font-bold mb-8">
          {(() => {
            const catLabel = activeCategory ? getCategoryLabel(activeCategory) : '';
            const subLabel = activeSubcategory ? getSubcategoryLabel(activeCategory, activeSubcategory) : '';
            if (activeSearch) return `Results for "${activeSearch}"${catLabel ? ` in ${catLabel}` : ''}`;
            if (subLabel) return subLabel;
            if (catLabel) return catLabel;
            return 'All Services';
          })()}
        </h1>

        {/* Filter bar */}
        <div ref={filterBarRef} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-800 pb-6">
          {/* Sort */}
          <FilterDropdown
            label={sortBy === 'newest' ? 'Sort' : sortBy === 'oldest' ? 'Oldest first' : sortBy === 'price_asc' ? 'Price: Low → High' : 'Price: High → Low'}
            isOpen={openDropdown === 'sort'}
            active={sortBy !== 'newest'}
            onToggle={() => toggleDropdown('sort')}
            align="left"
          >
            <Opt label="Newest first"       selected={sortBy === 'newest'}     onClick={() => { setSortBy('newest');     setOpenDropdown(null); }} />
            <Opt label="Oldest first"       selected={sortBy === 'oldest'}     onClick={() => { setSortBy('oldest');     setOpenDropdown(null); }} />
            <Opt label="Price: Low → High"  selected={sortBy === 'price_asc'}  onClick={() => { setSortBy('price_asc'); setOpenDropdown(null); }} />
            <Opt label="Price: High → Low"  selected={sortBy === 'price_desc'} onClick={() => { setSortBy('price_desc'); setOpenDropdown(null); }} />
          </FilterDropdown>

          <div className="flex flex-wrap items-center gap-6">
            {/* Subcategory */}
            {activeCategory && subcategoryMap[activeCategory] && (
              <FilterDropdown
                label={activeSubcategory ? getSubcategoryLabel(activeCategory, activeSubcategory) : 'Subcategory'}
                isOpen={openDropdown === 'subcategory'}
                active={activeSubcategory !== ''}
                onToggle={() => toggleDropdown('subcategory')}
              >
                <Opt label="All subcategories" selected={activeSubcategory === ''} onClick={() => { setActiveSubcategory(''); setOpenDropdown(null); }} />
                {subcategoryMap[activeCategory].map((s) => (
                  <Opt key={s.value} label={s.label} selected={activeSubcategory === s.value} onClick={() => { setActiveSubcategory(s.value); setOpenDropdown(null); }} />
                ))}
              </FilterDropdown>
            )}

            {/* Radius — only shown for city/ZIP/address-level locations */}
            {locationType === 'precise' && (
              <FilterDropdown
                label={searchRadius > 0 ? `Within ${searchRadius} mi` : 'Radius'}
                isOpen={openDropdown === 'radius'}
                active={searchRadius > 0}
                onToggle={() => toggleDropdown('radius')}
              >
                <div className="py-1">
                  <RadioOpt label="Any distance"  selected={pendingRadius === 0}   onClick={() => setPendingRadius(0)} />
                  <RadioOpt label="Within 1 mi"   selected={pendingRadius === 1}   onClick={() => setPendingRadius(1)} />
                  <RadioOpt label="Within 5 mi"   selected={pendingRadius === 5}   onClick={() => setPendingRadius(5)} />
                  <RadioOpt label="Within 10 mi"  selected={pendingRadius === 10}  onClick={() => setPendingRadius(10)} />
                  <RadioOpt label="Within 25 mi"  selected={pendingRadius === 25}  onClick={() => setPendingRadius(25)} />
                  <RadioOpt label="Within 50 mi"  selected={pendingRadius === 50}  onClick={() => setPendingRadius(50)} />
                  <RadioOpt label="Within 100 mi" selected={pendingRadius === 100} onClick={() => setPendingRadius(100)} />
                </div>
                <RadioFooter
                  onClear={() => { setSearchRadius(0); setPendingRadius(0); setOpenDropdown(null); }}
                  onApply={() => { setSearchRadius(pendingRadius); setOpenDropdown(null); }}
                />
              </FilterDropdown>
            )}

            {/* Budget */}
            <FilterDropdown
              label={budgetMax != null ? `Up to $${budgetMax.toLocaleString()}` : 'Budget'}
              isOpen={openDropdown === 'budget'}
              active={budgetMax != null}
              onToggle={() => toggleDropdown('budget')}
            >
              <div className="p-4 w-56">
                <label className="block text-xs text-slate-400 mb-2">Up to</label>
                <div className="flex items-center bg-[#0E1422] border border-slate-700 rounded-lg px-3 h-10">
                  <span className="text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyBudget()}
                    placeholder="Any"
                    className="flex-1 bg-transparent px-2 text-sm text-white focus:outline-none placeholder-slate-500"
                  />
                </div>
                <div className="flex items-center justify-between mt-4">
                  <button onClick={clearBudget} className="text-xs text-slate-400 hover:text-white transition-colors">
                    Clear all
                  </button>
                  <button onClick={applyBudget} className="bg-primary hover:bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                    Apply
                  </button>
                </div>
              </div>
            </FilterDropdown>

            {/* Rating */}
            <FilterDropdown
              label={
                minRating > 0 ? (
                  <span className="flex items-center gap-0.5">
                    {minRating}
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    {' & up'}
                  </span>
                ) : 'Rating'
              }
              isOpen={openDropdown === 'rating'}
              active={minRating > 0}
              onToggle={() => toggleDropdown('rating')}
            >
              <Opt label="Any rating" selected={minRating === 0} onClick={() => { setMinRating(0); setOpenDropdown(null); }} />
              {[5, 4, 3, 2, 1].map((n) => (
                <button
                  key={n}
                  onClick={() => { setMinRating(n); setOpenDropdown(null); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${minRating === n ? 'text-white bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                >
                  <span className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < n ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}`} />
                    ))}
                  </span>
                  <span className="text-xs">&amp; up</span>
                </button>
              ))}
            </FilterDropdown>

            {/* Verified — radio group */}
            <FilterDropdown
              label={verifiedFilter === 'yes' ? 'Verified only' : verifiedFilter === 'no' ? 'Not verified' : 'Verified'}
              isOpen={openDropdown === 'verified'}
              active={verifiedFilter !== ''}
              onToggle={() => toggleDropdown('verified')}
            >
              <div className="py-1">
                <RadioOpt label="Any"          selected={pendingVerified === ''} onClick={() => setPendingVerified('')} />
                <RadioOpt label="Verified only" selected={pendingVerified === 'yes'} onClick={() => setPendingVerified('yes')} />
                <RadioOpt label="Not verified"  selected={pendingVerified === 'no'}  onClick={() => setPendingVerified('no')} />
              </div>
              <RadioFooter
                onClear={() => { setVerifiedFilter(''); setPendingVerified(''); setOpenDropdown(null); }}
                onApply={() => { setVerifiedFilter(pendingVerified); setOpenDropdown(null); }}
              />
            </FilterDropdown>

            {/* Remote — radio group */}
            <FilterDropdown
              label={remoteFilter === 'remote' ? 'Remote only' : remoteFilter === 'in_person' ? 'In-person only' : 'Remote'}
              isOpen={openDropdown === 'remote'}
              active={remoteFilter !== ''}
              onToggle={() => toggleDropdown('remote')}
            >
              <div className="py-1">
                <RadioOpt label="All"            selected={pendingRemote === ''}          onClick={() => setPendingRemote('')} />
                <RadioOpt label="Remote only"    selected={pendingRemote === 'remote'}    onClick={() => setPendingRemote('remote')} />
                <RadioOpt label="In-person only" selected={pendingRemote === 'in_person'} onClick={() => setPendingRemote('in_person')} />
              </div>
              <RadioFooter
                onClear={() => { setRemoteFilter(''); setPendingRemote(''); setOpenDropdown(null); }}
                onApply={() => { setRemoteFilter(pendingRemote); setOpenDropdown(null); }}
              />
            </FilterDropdown>

            {/* Language */}
            <FilterDropdown
              label={selectedLanguages.length > 0 ? `Language (${selectedLanguages.length})` : 'Language'}
              isOpen={openDropdown === 'language'}
              active={selectedLanguages.length > 0}
              onToggle={() => toggleDropdown('language')}
            >
              <div className="max-h-64 overflow-y-auto py-1">
                {languageOptions.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-500 italic">No languages listed</p>
                ) : (
                  languageOptions.map((lang) => {
                    const checked = selectedLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        onClick={() => toggleLanguage(lang)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-slate-600'}`}>
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </span>
                        {lang}
                      </button>
                    );
                  })
                )}
              </div>
            </FilterDropdown>

            {/* Online Now — radio group */}
            <FilterDropdown
              label={onlineFilter === 'online' ? 'Online now' : 'Online Now'}
              isOpen={openDropdown === 'online'}
              active={onlineFilter !== ''}
              onToggle={() => toggleDropdown('online')}
            >
              <div className="py-1">
                <RadioOpt label="Any"        selected={pendingOnline === ''}       onClick={() => setPendingOnline('')} />
                <RadioOpt label="Online now" selected={pendingOnline === 'online'} onClick={() => setPendingOnline('online')} />
              </div>
              <RadioFooter
                onClear={() => { setOnlineFilter(''); setPendingOnline(''); setOpenDropdown(null); }}
                onApply={() => { setOnlineFilter(pendingOnline); setOpenDropdown(null); }}
              />
            </FilterDropdown>
          </div>
        </div>

        {/* Applied filter chips */}
        {filterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8 bg-[#111827] border border-slate-800 rounded-xl px-4 py-3">
            <span className="text-sm text-slate-400 mr-1">Filters</span>
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.onRemove}
                className="flex items-center gap-1.5 bg-[#1A2035] border border-slate-700 hover:border-slate-500 text-slate-200 text-xs px-3 py-1.5 rounded-full transition-colors"
              >
                {chip.label}
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            ))}
            <button
              onClick={clearAllFilters}
              className="ml-auto text-xs text-slate-400 hover:text-white transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-slate-500 text-sm">Loading services…</p>
          </div>
        ) : displayedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-slate-400 text-lg font-medium">
              {posts.length === 0 ? 'No services listed yet.' : 'No services match your filters.'}
            </p>
            <p className="text-slate-500 text-sm text-center whitespace-nowrap">
              {posts.length === 0
                ? 'Be the first to post a service!'
                : 'Try removing a filter or selecting a different category.'}
            </p>
            {posts.length > 0 && hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-1 text-sm text-primary hover:text-blue-400 underline underline-offset-4 transition-colors"
              >
                Clear all filters
              </button>
            )}
            {posts.length === 0 && (
              <Link to="/post-service" className="mt-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
                Post a Service
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {displayedPosts.map((post) => (
                <ServiceCard
                  key={post.id}
                  post={post}
                  isSaved={isSaved(post.id)}
                  onToggleSave={handleToggleSave}
                />
              ))}
            </div>

            <div className="flex flex-col items-center gap-4 py-6 border-t border-slate-800 mb-16">
              <p className="text-slate-400 text-sm">{displayedPosts.length} service{displayedPosts.length !== 1 ? 's' : ''} shown</p>
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 bg-[#111827] hover:bg-slate-800 disabled:opacity-50 border border-slate-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
                >
                  {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : 'Load more'}
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-10 flex flex-col items-center">
        <div className="flex flex-wrap justify-center gap-8 mb-8 text-sm text-slate-300">
          <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
          <Link to="/for-sellers" className="hover:text-white transition-colors">For Sellers</Link>
          <Link to="/" className="hover:text-white transition-colors">For Buyers</Link>
          <Link to="/affiliate" className="hover:text-white transition-colors">Affiliate Program</Link>
          <button className="hover:text-white transition-colors">Terms &amp; Conditions</button>
          <button className="hover:text-white transition-colors">Privacy Policy</button>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Gigspace, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default BuyerSearch;
