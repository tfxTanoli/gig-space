import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import Logo from './Logo';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';
import { ref, get, query, orderByChild, limitToLast, endBefore } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import { useSavedServices } from './useSavedServices';

const PAGE_SIZE = 50;

const categories: { value: string; label: string }[] = [
  { value: 'digital',            label: 'Digital Work' },
  { value: 'home',               label: 'Home Services' },
  { value: 'Automotive',         label: 'Automotive' },
  { value: 'Business',           label: 'Business' },
  { value: 'Graphics & Design',  label: 'Graphics & Design' },
  { value: 'Home & Garden',      label: 'Home & Garden' },
  { value: 'Labor & Moving',     label: 'Labor & Moving' },
  { value: 'Lessons',            label: 'Lessons' },
  { value: 'Legal',              label: 'Legal' },
  { value: 'Marketing',          label: 'Marketing' },
  { value: 'Programming & Tech', label: 'Programming & Tech' },
  { value: 'Real Estate',        label: 'Real Estate' },
  { value: 'Skilled Trade',      label: 'Skilled Trade' },
];

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc';
type BudgetOption = '' | 'under_25' | '25_100' | '100_250' | '250_plus';
type RemoteOption = '' | 'remote' | 'in_person';

const FilterDropdown = ({
  label, isOpen, active, onToggle, children, align = 'right',
}: {
  label: string; isOpen: boolean; active: boolean; onToggle: () => void; children: React.ReactNode; align?: 'left' | 'right';
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
      <div className={`absolute top-full ${align === 'left' ? 'left-0' : 'right-0'} mt-2 min-w-[170px] bg-[#111827] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50`}>
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

interface ServicePost {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerPhotoURL: string;
  title: string;
  category: string;
  priceMin: number;
  priceMax: number | null;
  priceType: 'per_project' | 'per_hour';
  images: string[];
  primaryLocation: string;
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
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeLocation, setActiveLocation] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [budgetFilter, setBudgetFilter] = useState<BudgetOption>('');
  const [remoteFilter, setRemoteFilter] = useState<RemoteOption>('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollArrows = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
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

  const toggleDropdown = useCallback((name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveSearch('');
    setInputValue('');
    setActiveLocation('');
    setSortBy('newest');
    setBudgetFilter('');
    setRemoteFilter('');
    setOpenDropdown(null);
  }, []);

  const hasActiveFilters = activeSearch !== '' || activeLocation !== '' || sortBy !== 'newest' || budgetFilter !== '' || remoteFilter !== '';

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
    if (!showLocationMenu) return;
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLocationMenu]);

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
    navigate('/', { replace: true });
    await logout();
  }, [logout, navigate]);

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
      // silently ignore load-more failures
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, posts, fetchPage]);

  const handleToggleSave = useCallback((id: string) => toggleSave(id), [toggleSave]);

  const locationOptions: string[] = ['Remote / Online', ...Array.from(
    new Set(posts.filter((p) => !p.offeredRemotely && p.primaryLocation).map((p) => p.primaryLocation))
  ).sort()];

  const q = activeSearch.toLowerCase();
  const displayedPosts = posts
    .filter((p) => {
      const matchesSearch = !q ||
        p.title?.toLowerCase().includes(q) ||
        p.sellerName?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q);
      const matchesCategory = !activeCategory || p.category === activeCategory;
      const matchesLocation =
        !activeLocation ||
        (activeLocation === 'Remote / Online' ? p.offeredRemotely : p.primaryLocation === activeLocation);
      const matchesBudget = (() => {
        const lo = p.priceMin;
        const hi = p.priceMax ?? p.priceMin;
        if (budgetFilter === 'under_25')  return lo < 25;
        if (budgetFilter === '25_100')    return lo <= 100 && hi >= 25;
        if (budgetFilter === '100_250')   return lo <= 250 && hi >= 100;
        if (budgetFilter === '250_plus')  return hi > 250;
        return true;
      })();
      const matchesRemote =
        !remoteFilter ||
        (remoteFilter === 'remote' ? p.offeredRemotely : !p.offeredRemotely);
      return matchesSearch && matchesCategory && matchesLocation && matchesBudget && matchesRemote;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'price_asc') return a.priceMin - b.priceMin;
      if (sortBy === 'price_desc') return b.priceMin - a.priceMin;
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">
      {/* Top Main Navigation */}
      <header className="w-full px-6 py-4 lg:px-12 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center flex-1">
          <Link to="/" className="flex items-center mr-10 shrink-0">
            <Logo className="h-6" />
          </Link>

          <div className="hidden md:flex items-center bg-[#0E1422] border border-slate-700 rounded-lg h-10 w-full max-w-xl relative">
            <div ref={locationRef} className="relative shrink-0 h-full">
              <button
                onClick={() => setShowLocationMenu((v) => !v)}
                className="px-4 border-r border-slate-700 flex items-center cursor-pointer text-slate-300 text-sm h-full bg-[#1A2035] hover:text-white transition-colors whitespace-nowrap rounded-l-lg"
              >
                {activeLocation || 'All locations'}
                <ChevronDown className="w-4 h-4 ml-2 text-slate-500" />
              </button>
              {showLocationMenu && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  <button
                    onClick={() => { setActiveLocation(''); setShowLocationMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${!activeLocation ? 'text-white bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                  >
                    All locations
                  </button>
                  {locationOptions.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => { setActiveLocation(loc); setShowLocationMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeLocation === loc ? 'text-white bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <Link to="/post-service" className="text-sm font-medium hover:text-primary transition-colors text-slate-300 hidden sm:block">
            Create New Post
          </Link>
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
                  <Link
                    to="/buyer-dashboard"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4 shrink-0 text-slate-500" />
                    Dashboard
                  </Link>
                  <Link
                    to="/buyer-dashboard?tab=Messages"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-slate-500" />
                    Messages
                  </Link>
                  <Link
                    to="/buyer-dashboard?tab=Saved"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Bookmark className="w-4 h-4 shrink-0 text-slate-500" />
                    Saved Services
                  </Link>
                  <Link
                    to="/buyer-dashboard?tab=Settings"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
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
        </div>
      </header>

      {/* Category Nav */}
      <nav className="w-full border-b border-slate-800 relative flex items-center">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scrollCategories('left')}
            className="absolute left-0 z-10 h-full px-2 bg-gradient-to-r from-[#0E1422] via-[#0E1422]/90 to-transparent flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Scrollable list */}
        <div
          ref={categoryScrollRef}
          onScroll={updateScrollArrows}
          className="overflow-x-auto px-6 lg:px-12 py-3 flex-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <ul className="flex items-center space-x-8 text-sm text-slate-400 whitespace-nowrap font-medium min-w-max">
            <li>
              <button
                onClick={() => setActiveCategory('')}
                className={`transition-colors ${activeCategory === '' ? 'text-white underline underline-offset-4' : 'hover:text-white'}`}
              >
                All
              </button>
            </li>
            {categories.map((cat) => (
              <li key={cat.value}>
                <button
                  onClick={() => setActiveCategory(cat.value)}
                  className={`transition-colors ${activeCategory === cat.value ? 'text-white underline underline-offset-4' : 'hover:text-white'}`}
                >
                  {cat.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Right arrow */}
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
        <h1 className="text-3xl font-bold mb-8">
          {(() => {
            const catLabel = categories.find(c => c.value === activeCategory)?.label ?? '';
            if (activeSearch)
              return `Results for "${activeSearch}"${catLabel ? ` in ${catLabel}` : ''}${activeLocation ? ` · ${activeLocation}` : ''}`;
            if (catLabel)
              return `${catLabel}${activeLocation ? ` · ${activeLocation}` : ''}`;
            if (activeLocation) return activeLocation;
            return 'All Services';
          })()}
        </h1>

        {/* Filter bar */}
        <div ref={filterBarRef} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
          {/* Sort */}
          <FilterDropdown
            label={sortBy === 'newest' ? 'Sort' : sortBy === 'oldest' ? 'Oldest first' : sortBy === 'price_asc' ? 'Price: Low → High' : 'Price: High → Low'}
            isOpen={openDropdown === 'sort'}
            active={sortBy !== 'newest'}
            onToggle={() => toggleDropdown('sort')}
            align="left"
          >
            <Opt label="Newest first"        selected={sortBy === 'newest'}    onClick={() => { setSortBy('newest');    setOpenDropdown(null); }} />
            <Opt label="Oldest first"        selected={sortBy === 'oldest'}    onClick={() => { setSortBy('oldest');    setOpenDropdown(null); }} />
            <Opt label="Price: Low → High"   selected={sortBy === 'price_asc'} onClick={() => { setSortBy('price_asc'); setOpenDropdown(null); }} />
            <Opt label="Price: High → Low"   selected={sortBy === 'price_desc'} onClick={() => { setSortBy('price_desc'); setOpenDropdown(null); }} />
          </FilterDropdown>

          <div className="flex flex-wrap items-center gap-6">
            {/* Budget */}
            <FilterDropdown
              label={budgetFilter === '' ? 'Budget' : budgetFilter === 'under_25' ? 'Under $25' : budgetFilter === '25_100' ? '$25 – $100' : budgetFilter === '100_250' ? '$100 – $250' : '$250+'}
              isOpen={openDropdown === 'budget'}
              active={budgetFilter !== ''}
              onToggle={() => toggleDropdown('budget')}
            >
              <Opt label="Any budget"    selected={budgetFilter === ''}          onClick={() => { setBudgetFilter('');          setOpenDropdown(null); }} />
              <Opt label="Under $25"     selected={budgetFilter === 'under_25'}  onClick={() => { setBudgetFilter('under_25');  setOpenDropdown(null); }} />
              <Opt label="$25 – $100"    selected={budgetFilter === '25_100'}    onClick={() => { setBudgetFilter('25_100');    setOpenDropdown(null); }} />
              <Opt label="$100 – $250"   selected={budgetFilter === '100_250'}   onClick={() => { setBudgetFilter('100_250');   setOpenDropdown(null); }} />
              <Opt label="$250+"         selected={budgetFilter === '250_plus'}  onClick={() => { setBudgetFilter('250_plus');  setOpenDropdown(null); }} />
            </FilterDropdown>

            {/* Rating - coming soon */}
            <FilterDropdown label="Rating" isOpen={openDropdown === 'rating'} active={false} onToggle={() => toggleDropdown('rating')}>
              <p className="px-4 py-3 text-xs text-slate-500 italic">Coming soon</p>
            </FilterDropdown>

            {/* Verified - coming soon */}
            <FilterDropdown label="Verified" isOpen={openDropdown === 'verified'} active={false} onToggle={() => toggleDropdown('verified')}>
              <p className="px-4 py-3 text-xs text-slate-500 italic">Coming soon</p>
            </FilterDropdown>

            {/* Remote */}
            <FilterDropdown
              label={remoteFilter === 'remote' ? 'Remote only' : remoteFilter === 'in_person' ? 'In-person only' : 'Remote'}
              isOpen={openDropdown === 'remote'}
              active={remoteFilter !== ''}
              onToggle={() => toggleDropdown('remote')}
            >
              <Opt label="All"             selected={remoteFilter === ''}          onClick={() => { setRemoteFilter('');          setOpenDropdown(null); }} />
              <Opt label="Remote only"     selected={remoteFilter === 'remote'}    onClick={() => { setRemoteFilter('remote');    setOpenDropdown(null); }} />
              <Opt label="In-person only"  selected={remoteFilter === 'in_person'} onClick={() => { setRemoteFilter('in_person'); setOpenDropdown(null); }} />
            </FilterDropdown>

            {/* Language - coming soon */}
            <FilterDropdown label="Language" isOpen={openDropdown === 'language'} active={false} onToggle={() => toggleDropdown('language')}>
              <p className="px-4 py-3 text-xs text-slate-500 italic">Coming soon</p>
            </FilterDropdown>

            {/* Online Now - coming soon */}
            <FilterDropdown label="Online Now" isOpen={openDropdown === 'online'} active={false} onToggle={() => toggleDropdown('online')}>
              <p className="px-4 py-3 text-xs text-slate-500 italic">Coming soon</p>
            </FilterDropdown>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-full transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

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
            <p className="text-slate-500 text-sm text-center max-w-xs">
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
