import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  LayoutDashboard,
  BadgeDollarSign,
  Settings,
  LogOut,
  Loader2,
  Star,
  Check,
  X,
  ArrowRight,
  MapPin,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import Logo from './Logo';
import VerifiedBadgeIcon from './VerifiedBadgeIcon';
import LocationSearch from './LocationSearch';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';
import { ref, get, query, orderByChild, limitToLast, endBefore } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import { useSavedServices } from './useSavedServices';
import { geocodeCache, geocodeLocation, haversineDistanceMiles } from './photon';
import { useCategories } from './CategoriesContext';

const MessagesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.57641 12.7014C1.69894 13.0105 1.72622 13.3492 1.65474 13.6739L0.767243 16.4156C0.738646 16.5546 0.74604 16.6987 0.788722 16.834C0.831405 16.9694 0.907961 17.0916 1.01113 17.1891C1.1143 17.2866 1.24067 17.3562 1.37824 17.3911C1.51582 17.4261 1.66004 17.4253 1.79724 17.3889L4.64141 16.5572C4.94784 16.4965 5.26518 16.523 5.55724 16.6339C7.33673 17.4649 9.35255 17.6407 11.249 17.1303C13.1455 16.6199 14.8008 15.4561 15.9228 13.8442C17.0448 12.2323 17.5615 10.2759 17.3817 8.3202C17.2018 6.36449 16.337 4.53514 14.9398 3.15491C13.5426 1.77468 11.7028 0.932277 9.74506 0.776325C7.78729 0.620374 5.83735 1.1609 4.23928 2.30253C2.6412 3.44416 1.49769 5.11353 1.01049 7.01611C0.523289 8.91869 0.723717 10.9322 1.57641 12.7014Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PAGE_SIZE = 50;
const ITEMS_PER_PAGE = 20;

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc';
type RemoteOption = '' | 'remote' | 'in_person';
type VerifiedOption = '' | 'yes' | 'no';
type OnlineOption = '' | 'online';

interface SellerMeta {
  verified: boolean;
  lastSeen?: number | null;
}

const FilterDropdown = ({
  label, isOpen, active, onToggle, children, align = 'right',
}: {
  label: ReactNode; isOpen: boolean; active: boolean; onToggle: () => void; children: ReactNode; align?: 'left' | 'right';
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Position via fixed coords (computed from the trigger's rect) so the panel escapes
  // clipping from the horizontally-scrollable filter bar on mobile.
  useLayoutEffect(() => {
    if (!isOpen || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth ?? 180;
    const margin = 8;
    let left = align === 'left' ? rect.left : rect.right - panelWidth;
    left = Math.max(Math.min(left, window.innerWidth - panelWidth - margin), margin);
    setCoords({ top: rect.bottom + 8, left });
  }, [isOpen, align]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={onToggle}
        className={`flex items-center text-sm transition-colors gap-1 ${active ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'}`}
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          style={coords ?? undefined}
          className={`fixed flex flex-col ${coords ? '' : (align === 'left' ? 'left-0 top-full mt-2' : 'right-0 top-full mt-2')} min-w-[180px] bg-surface border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

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
    <button type="button" onClick={onClear} className="text-xs text-slate-400 hover:text-white transition-colors">
      Clear all
    </button>
    <button type="button" onClick={onApply} className="bg-primary hover:bg-blue-400 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
      Apply
    </button>
  </div>
);

// One labelled block inside the mobile filter drawer. The drawer applies every
// choice immediately (no pending/Apply step) so results update behind the sheet,
// which is why it reuses Opt/RadioOpt but never RadioFooter.
const DrawerSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="py-5 border-b border-slate-800 last:border-b-0">
    <h3 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
    {children}
  </section>
);

// A DrawerSection whose options stay collapsed behind a trigger showing the
// current value. Used for the two filters whose options are long enough that an
// inline list made it hard to see what was actually selected.
const DrawerAccordion = ({
  title, summary, open, onToggle, children,
}: {
  title: string; summary: ReactNode; open: boolean; onToggle: () => void; children: ReactNode;
}) => (
  <section className="py-5 border-b border-slate-800 last:border-b-0">
    <h3 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
    <div className="px-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full h-10 flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 hover:border-slate-600 transition-colors"
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">{summary}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
    {open && <div className="mt-2">{children}</div>}
  </section>
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
  priceType: 'per_project' | 'per_hour' | 'contact_for_pricing';
  images: string[];
  primaryLocation: string;
  primaryLocationLat?: number;
  primaryLocationLng?: number;
  extraLocations?: string[];
  offeredRemotely: boolean;
  status: 'active' | 'paused';
  createdAt: number;
  reviewCount?: number;
  totalStars?: number;
}

function fmt(n: number) { return n.toLocaleString('en-US'); }
function formatPrice(post: ServicePost) {
  const suffix = post.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (post.priceMax) return { prefix: 'From', price: `$${fmt(post.priceMin)} – $${fmt(post.priceMax)}`, suffix };
  return { prefix: 'From', price: `$${fmt(post.priceMin)}`, suffix };
}

interface ServiceCardProps {
  post: ServicePost;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  meta?: SellerMeta;
}

const ServiceCard = memo(({ post, isSaved, onToggleSave, meta }: ServiceCardProps) => {
  const { prefix, price, suffix } = formatPrice(post);
  const serviceReviewCount = post.reviewCount ?? 0;
  const serviceAvgRating = serviceReviewCount > 0 ? (post.totalStars ?? 0) / serviceReviewCount : 0;
  const hasReviews = serviceReviewCount > 0;
  const isVerified = meta?.verified ?? false;

  const allLocations = post.offeredRemotely
    ? []
    : [
        ...(post.primaryLocation ? [post.primaryLocation] : []),
        ...(post.extraLocations ?? []),
      ];

  const locationPrimary = post.offeredRemotely
    ? (post.primaryLocation ? `Remote (${post.primaryLocation})` : 'Remote')
    : (allLocations[0] ?? '');
  const extraCount = post.offeredRemotely ? 0 : Math.max(0, allLocations.length - 1);
  const extraLocationNames = allLocations.slice(1);

  return (
    <div className="group block">
      <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-3 bg-surface-raised relative">
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
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(post.id); }}
          className="absolute top-2 right-2 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
          title={isSaved ? 'Remove from saved' : 'Save service'}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-primary text-primary' : 'text-white'}`} />
        </button>
      </div>

      <Link to={`/service-detail?id=${post.id}`} className="block">
        {/* Avatar & Name */}
        <div className="flex items-center gap-2 mb-2.5">
          <UserAvatar photoURL={post.sellerPhotoURL} name={post.sellerName} size="sm" />
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-sm text-slate-300 truncate min-w-0">{post.sellerName}</span>
            {isVerified && <VerifiedBadgeIcon />}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-white mb-2 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:underline">
          {post.title}
        </h3>

        {/* Location — always reserves height so the badge/price row aligns across cards */}
        <div className="relative flex items-center text-slate-400 text-[13px] mb-2 min-h-[18px] group/loc">
          {locationPrimary && (
            <>
              <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0 text-slate-400" />
              <span className="truncate">
                {locationPrimary}
                {extraCount > 0 && (
                  <> <span className="underline underline-offset-2">+{extraCount} more</span></>
                )}
              </span>
              {extraCount > 0 && (
                <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-20 hidden group-hover/loc:block bg-surface border border-slate-700 rounded-lg px-3 py-2 shadow-xl w-max">
                  {extraLocationNames.map((loc) => (
                    <p key={loc} className="text-[13px] text-slate-300 py-0.5">{loc}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Reviews / New Seller badge */}
        {hasReviews ? (
          <div className="flex items-center gap-1.5 mb-2 h-[26px]">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
            <span className="text-[13px] text-slate-400">
              {serviceAvgRating.toFixed(1)} ({serviceReviewCount})
            </span>
          </div>
        ) : (
          <div className="mb-2 h-[26px] flex items-center">
            <span className="text-[11px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
              New seller
            </span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-1">
          {post.priceType === 'contact_for_pricing' ? (
            /* Matches "per project" font; leading-6 keeps the row the same height as priced cards */
            <span className="text-[13px] text-slate-100 leading-6">Contact for pricing</span>
          ) : (
            <>
              {prefix && <span className="text-[13px] text-slate-100">{prefix}</span>}
              <span className="font-bold text-white">{price}</span>
              <span className="text-[13px] text-slate-100">{suffix}</span>
            </>
          )}
        </div>
      </Link>
    </div>
  );
});

const PaginationBar = ({
  currentPage,
  totalPages,
  hasMore,
  loadingMore,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  loadingMore: boolean;
  onPageChange: (page: number) => void;
}) => {
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const pages: (number | '...')[] = [0];
    if (currentPage > 3) pages.push('...');
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages - 2, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 4) pages.push('...');
    if (totalPages > 1) pages.push(totalPages - 1);
    return pages;
  };

  const canPrev = currentPage > 0;
  const canNext = hasMore || currentPage < totalPages - 1;

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canPrev}
        className="flex items-center gap-1 px-3 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-slate-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Prev
      </button>

      {getPageNumbers().map((page, idx) =>
        page === '...' ? (
          <span key={`e-${idx}`} className="px-2 py-2 text-slate-500 text-sm select-none">…</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
              page === currentPage
                ? 'bg-primary text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {(page as number) + 1}
          </button>
        ),
      )}

      {hasMore && (
        <span className="px-1 py-2 text-slate-500 text-sm select-none">…</span>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canNext}
        className="flex items-center gap-1 px-3 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-slate-800"
      >
        {loadingMore && currentPage >= totalPages - 1 ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>Next <ChevronRight className="w-4 h-4" /></>
        )}
      </button>
    </div>
  );
};

const BuyerSearch = () => {
  const { user, userProfile, logout } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const isSeller = userProfile?.accountType === 'seller';
  const dashboardPath = isAdmin ? '/admin-dashboard' : isSeller ? '/seller-dashboard' : '/buyer-dashboard';
  const messagesPath = isSeller ? '/seller-dashboard?tab=Messages' : '/buyer-dashboard?tab=Messages';
  const settingsPath = isSeller ? '/seller-dashboard?tab=Settings' : '/buyer-dashboard?tab=Settings';
  const { categoryOptions, subcategoryMap, getCategoryLabel, getSubcategoryLabel } = useCategories();
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
  const [activeSubcategory, setActiveSubcategory] = useState(() => searchParams.get('subcategory') ?? '');
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Which collapsible section inside the filter drawer is expanded (one at a time).
  const [drawerSection, setDrawerSection] = useState<'rating' | 'language' | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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
  const categoryNavRef = useRef<HTMLElement>(null);
  const urlSyncRef = useRef('');
  const flyoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPagesRef = useRef(1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Hover-capable (desktop) vs touch. On touch we ignore the phantom
  // mouseenter/leave events so a tap doesn't open-then-instantly-close the flyout.
  const canHover = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches,
    [],
  );

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

  const showFlyout = useCallback((cat: string) => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
    setHoveredCategory(cat);
  }, []);

  const hideFlyout = useCallback(() => {
    flyoutTimeoutRef.current = setTimeout(() => setHoveredCategory(null), 150);
  }, []);

  const keepFlyout = useCallback(() => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
  }, []);

  useEffect(() => {
    updateScrollArrows();
    window.addEventListener('resize', updateScrollArrows);
    return () => window.removeEventListener('resize', updateScrollArrows);
  }, [updateScrollArrows]);

  // While the filter drawer is up: lock the page behind it, close on Escape, and
  // close if the viewport crosses into md — the sheet is md:hidden, so leaving it
  // "open" there would strand the scroll lock with nothing visible to dismiss.
  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false); };
    const onResize = () => { if (window.innerWidth >= 768) setFiltersOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [filtersOpen]);

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
    setHoveredCategory(null);
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
  }, []);

  const clearCategory = useCallback(() => {
    setActiveCategory('');
    setActiveSubcategory('');
  }, []);

  // Tapping a category opens its subcategory flyout (touch has no hover).
  // Categories without subcategories select the whole category directly.
  const handleCategoryClick = useCallback((cat: string) => {
    if (subcategoryMap[cat]?.length) {
      // On touch, tapping the already-open category again closes its flyout.
      // (On hover devices the flyout is driven by mouseenter/leave, so a click
      // here must never toggle it closed — that caused an instant open→close.)
      if (!canHover && hoveredCategory === cat) {
        setHoveredCategory(null);
        if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
      } else {
        showFlyout(cat);
      }
    } else {
      selectCategory(cat);
    }
  }, [subcategoryMap, selectCategory, showFlyout, hoveredCategory, canHover]);

  // Select the whole category (used by the flyout's "All …" row). Unlike
  // selectCategory this never toggles off, so it always applies the category.
  const selectWholeCategory = useCallback((cat: string) => {
    setActiveCategory(cat);
    setActiveSubcategory('');
    setHoveredCategory(null);
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
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
    setActiveCategory('');
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

  // Clears only what the drawer exposes. Deliberately narrower than
  // clearAllFilters, which also drops the search term, location and category —
  // wiping those from a sheet titled "Filters" would be a surprise.
  const clearDrawerFilters = useCallback(() => {
    setSearchRadius(0);
    setPendingRadius(0);
    setBudgetMax(null);
    setBudgetInput('');
    setMinRating(0);
    setVerifiedFilter('');
    setPendingVerified('');
    setSelectedLanguages([]);
    setRemoteFilter('');
    setPendingRemote('');
    setOnlineFilter('');
    setPendingOnline('');
  }, []);

  const activeFilterCount =
    (searchRadius > 0 ? 1 : 0) +
    (budgetMax != null ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (verifiedFilter !== '' ? 1 : 0) +
    (remoteFilter !== '' ? 1 : 0) +
    (onlineFilter !== '' ? 1 : 0) +
    selectedLanguages.length;

  const hasActiveFilters =
    activeSearch !== '' || activeLocation !== '' || activeSubcategory !== '' ||
    sortBy !== 'newest' || budgetMax !== null || minRating > 0 ||
    verifiedFilter !== '' || selectedLanguages.length > 0 || remoteFilter !== '' ||
    onlineFilter !== '' || searchRadius > 0;

  const languageKey = useMemo(() => selectedLanguages.slice().sort().join(','), [selectedLanguages]);

  // Reset to first page whenever any filter changes.
  useEffect(() => {
    setCurrentPage(0);
  }, [activeSearch, activeCategory, activeSubcategory, activeLocation, budgetMax, minRating, verifiedFilter, languageKey, remoteFilter, onlineFilter, searchRadius, sortBy]);

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

  // Close the subcategory flyout when tapping outside the category nav.
  useEffect(() => {
    if (!hoveredCategory) return;
    const handler = (e: MouseEvent) => {
      if (categoryNavRef.current && !categoryNavRef.current.contains(e.target as Node)) {
        setHoveredCategory(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [hoveredCategory]);

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
        const [verifiedSnap, lastSeenSnap] = await Promise.all([
          get(ref(database, `users/${id}/emailVerified`)).catch(() => null),
          get(ref(database, `users/${id}/lastSeen`)).catch(() => null),
        ]);
        const lastSeen: number | null = typeof lastSeenSnap?.val() === 'number' ? lastSeenSnap.val() : null;
        return [id, { verified: verifiedSnap?.val() === true, lastSeen }] as const;
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

  const handlePageSelect = useCallback((page: number) => {
    setCurrentPage(page);
    // Jump instantly rather than smooth-scroll: paging to Next can trigger
    // loadMore(), and the new cards' images shift the document height as they
    // lazy-load. That height change makes the browser's scroll-anchoring cancel
    // an in-flight smooth animation, so it never reaches the top (Previous never
    // loads more, which is why only Next was affected). An instant jump lands at
    // 0 before any of that and has nothing above it to anchor against.
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (hasMore && page >= totalPagesRef.current - 1) void loadMore();
  }, [hasMore, loadMore]);

  const handleToggleSave = useCallback((id: string) => {
    // Saving requires an account; send guests to sign in and bring them back.
    if (!user) {
      navigate(`/signin?next=${encodeURIComponent(`/service-detail?id=${id}`)}`);
      return;
    }
    toggleSave(id);
  }, [user, navigate, toggleSave]);

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
      const svcReviewCount = p.reviewCount ?? 0;
      const svcAvgRating = svcReviewCount > 0 ? (p.totalStars ?? 0) / svcReviewCount : 0;
      const matchesRating = minRating === 0 || svcAvgRating >= minRating;
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

      const matchesOnline = (() => {
        if (!onlineFilter) return true;
        const m = sellerMeta[p.sellerId];
        if (!m) return true; // meta not yet loaded — pass through
        if (m.lastSeen == null) return false; // never set — not online
        return Date.now() - m.lastSeen < 5 * 60_000; // within 5 minutes
      })();

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
  selectedLanguages.forEach((lang) =>
    filterChips.push({ key: `lang-${lang}`, label: lang, onRemove: () => setSelectedLanguages((prev) => prev.filter((l) => l !== lang)) }),
  );
  if (onlineFilter) filterChips.push({ key: 'online', label: 'Online now', onRemove: () => setOnlineFilter('') });

  const totalPages = Math.max(1, Math.ceil(displayedPosts.length / ITEMS_PER_PAGE));
  totalPagesRef.current = totalPages;
  const paginatedPosts = displayedPosts.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  );

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">
      {/* Header */}
      <header className="w-full px-4 md:px-6 lg:px-12 border-b border-slate-800">
        {/* Top row: logo + right actions */}
        <div className="h-16 flex items-center gap-3">
          <Logo className="h-6 shrink-0" onClick={(e) => { e.preventDefault(); window.location.href = '/search'; }} />

          {/* Desktop search — centered */}
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="flex items-center bg-background border border-slate-700 rounded-lg h-10 w-full max-w-xl">
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
                className="flex-1 bg-transparent px-4 text-sm text-white focus:outline-none placeholder-slate-400"
              />
              <button
                onClick={commitSearch}
                className="group flex items-center justify-center shrink-0"
              >
                <svg width="36" height="40" viewBox="0 0 36 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect y="6" width="30" height="28" rx="4" className="fill-[#2B7FFF] group-hover:fill-blue-400 transition-colors"/>
                  <path d="M14.1667 25.3333C17.8486 25.3333 20.8333 22.3486 20.8333 18.6667C20.8333 14.9848 17.8486 12 14.1667 12C10.4848 12 7.5 14.9848 7.5 18.6667C7.5 22.3486 10.4848 25.3333 14.1667 25.3333Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22.5003 27.0003L18.917 23.417" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6 ml-auto shrink-0">
            {user && !isAdmin && (
              <>
                <Link to="/post-service" className="text-sm font-medium hover:text-primary transition-colors text-slate-300 whitespace-nowrap">
                  Create New Post
                </Link>
              </>
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
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <p className="text-white text-sm font-semibold truncate">
                        {userProfile?.name ?? 'User'}
                      </p>
                      <p className="text-slate-500 text-xs truncate mt-0.5">
                        {user?.email ?? ''}
                      </p>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-semibold uppercase tracking-wide">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      )}
                    </div>

                    <div className="py-1">
                      <Link to={dashboardPath} onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                        {isAdmin
                          ? <Shield className="w-4 h-4 shrink-0 text-slate-500" />
                          : <LayoutDashboard className="w-4 h-4 shrink-0 text-slate-500" />}
                        {isAdmin ? 'Admin Panel' : 'Dashboard'}
                      </Link>
                      {/* Buyer/seller items — admins get their own panel, not these. */}
                      {!isAdmin && (
                        <>
                          <Link to={messagesPath} onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                            <MessagesIcon className="w-4 h-4 shrink-0 text-slate-500" />
                            Messages
                          </Link>
                          <Link to="/buyer-dashboard?tab=Saved" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                            <Bookmark className="w-4 h-4 shrink-0 text-slate-500" />
                            Saved Services
                          </Link>
                          <Link to={settingsPath} onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                            <Settings className="w-4 h-4 shrink-0 text-slate-500" />
                            Settings
                          </Link>
                          <Link to="/affiliate" onClick={() => setShowMenu(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                            <BadgeDollarSign className="w-4 h-4 shrink-0 text-slate-500" />
                            Affiliate Program
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="border-t border-slate-700 py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 md:gap-6">
                <Link to="/signin" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                  Log in
                </Link>
                <Link to="/signup" className="flex items-center text-sm font-medium text-slate-300 hover:text-white px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors">
                  Sign up <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile search bar — shown only on small screens */}
        <div className="md:hidden mt-3 mb-3 flex items-center bg-surface-raised border border-slate-700 rounded-lg h-10">
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
            className="flex-1 bg-transparent px-3 text-sm text-white focus:outline-none placeholder-slate-500 min-w-0"
          />
          <button
            onClick={commitSearch}
            className="group flex items-center justify-center shrink-0"
          >
            <svg width="36" height="40" viewBox="0 0 36 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect y="6" width="30" height="28" rx="4" className="fill-[#2B7FFF] group-hover:fill-blue-400 transition-colors"/>
              <path d="M14.1667 25.3333C17.8486 25.3333 20.8333 22.3486 20.8333 18.6667C20.8333 14.9848 17.8486 12 14.1667 12C10.4848 12 7.5 14.9848 7.5 18.6667C7.5 22.3486 10.4848 25.3333 14.1667 25.3333Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22.5003 27.0003L18.917 23.417" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Category Nav */}
      <nav ref={categoryNavRef} className="w-full border-b border-slate-800 relative flex flex-col">
        <div className="flex items-center w-full">
          {canScrollLeft && (
            <button
              onClick={() => scrollCategories('left')}
              className="absolute left-0 z-10 h-12 px-2 bg-gradient-to-r from-[#0E1422] via-[#0E1422]/90 to-transparent flex items-center text-slate-400 hover:text-white transition-colors"
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
            <ul className="flex items-center gap-5 text-sm text-slate-400 whitespace-nowrap font-medium min-w-max w-full justify-between">
              {categoryOptions.map((cat) => (
                <li key={cat.value}
                  onMouseEnter={() => canHover && subcategoryMap[cat.value] && showFlyout(cat.value)}
                  onMouseLeave={() => canHover && hideFlyout()}
                >
                  <button
                    onClick={() => handleCategoryClick(cat.value)}
                    className={`flex items-center gap-1 transition-colors py-1 cursor-pointer ${activeCategory === cat.value ? 'text-white' : 'hover:text-white'}`}
                  >
                    {cat.label}
                    {subcategoryMap[cat.value]?.length ? (
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${hoveredCategory === cat.value ? 'rotate-180' : ''}`} />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {canScrollRight && (
            <button
              onClick={() => scrollCategories('right')}
              className="absolute right-0 z-10 h-12 px-2 bg-gradient-to-l from-[#0E1422] via-[#0E1422]/90 to-transparent flex items-center text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Subcategory flyout — Fiverr-style list panel */}
        {hoveredCategory && subcategoryMap[hoveredCategory] && (
          <div
            className="absolute left-0 right-0 top-full bg-surface border-b border-slate-700 shadow-2xl z-40 max-h-[70vh] overflow-y-auto"
            onMouseEnter={() => canHover && keepFlyout()}
            onMouseLeave={() => canHover && hideFlyout()}
          >
            <div className="px-4 md:px-6 lg:px-12 py-5">
              {/* "All …" selects the whole category */}
              <button
                onClick={() => selectWholeCategory(hoveredCategory)}
                className={`flex items-center gap-2 w-full text-left mb-3 pb-3 border-b border-slate-800 transition-colors ${
                  activeCategory === hoveredCategory && !activeSubcategory ? 'text-primary' : 'text-white hover:text-primary'
                }`}
              >
                <span className="font-semibold text-sm">All {getCategoryLabel(hoveredCategory)}</span>
                <ArrowRight className="w-4 h-4 shrink-0 opacity-70" />
              </button>
              <div className="grid gap-x-6 md:gap-x-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {subcategoryMap[hoveredCategory].map((sub) => (
                  <button
                    key={sub.value}
                    onClick={() => {
                      setActiveCategory(hoveredCategory);
                      setActiveSubcategory(sub.value);
                      setHoveredCategory(null);
                      if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
                    }}
                    className={`text-left py-2 text-sm border-b border-slate-800/50 transition-colors cursor-pointer ${
                      activeCategory === hoveredCategory && activeSubcategory === sub.value
                        ? 'text-primary font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-6 lg:px-12 py-6 md:py-10">
        {activeCategory && (
          <nav className="text-sm font-medium mb-3">
            <button onClick={clearCategory} className="text-slate-400 hover:text-white transition-colors">
              All Services
            </button>
            <span className="text-slate-600 mx-2">/</span>
            <span className="text-white">{getCategoryLabel(activeCategory)}</span>
          </nav>
        )}

        <h1 className="text-2xl md:text-3xl font-bold mb-5 md:mb-8">
          {(() => {
            const catLabel = activeCategory ? getCategoryLabel(activeCategory) : '';
            const subLabel = activeSubcategory ? getSubcategoryLabel(activeCategory, activeSubcategory) : '';
            if (activeSearch) return `Results for "${activeSearch}"${catLabel ? ` in ${catLabel}` : ''}`;
            if (subLabel) return subLabel;
            if (catLabel) return catLabel;
            return 'All Services';
          })()}
        </h1>

        {/* Filter bar — horizontally scrollable on mobile */}
        <div ref={filterBarRef} className="mb-6 border-b border-slate-800 pb-4">
          <div
            className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto md:overflow-visible scrollbar-hide"
            onScroll={() => setOpenDropdown(null)}
          >
            <div className="flex items-center gap-4 md:gap-6 md:flex-wrap">
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

              <div className="hidden md:block w-px h-5 bg-slate-700 shrink-0" />

              {/* Mobile: every filter below lives in a drawer instead. The row used
                  to scroll horizontally with no affordance that it did. */}
              <button
                type="button"
                onClick={() => { setOpenDropdown(null); setDrawerSection(null); setFiltersOpen(true); }}
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
                className={`md:hidden ml-auto flex items-center gap-2 shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  activeFilterCount > 0
                    ? 'border-primary text-white font-semibold'
                    : 'border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-white text-xs font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

          <div className="hidden md:flex items-center gap-4 md:gap-6 ml-auto">
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
                <div className="flex items-center bg-slate-700 border border-slate-600 rounded-lg px-3 h-10">
                  <span className="text-slate-500 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && applyBudget()}
                    placeholder="Any"
                    className="flex-1 bg-transparent px-2 text-sm text-white focus:outline-none placeholder-slate-400"
                  />
                </div>
                <div className="flex items-center justify-between mt-4">
                  <button onClick={clearBudget} className="text-xs text-slate-400 hover:text-white transition-colors">
                    Clear all
                  </button>
                  <button onClick={applyBudget} className="bg-primary hover:bg-blue-400 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
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
          </div>
        </div>

        {/* Applied filter chips */}
        {filterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8 bg-surface border border-slate-800 rounded-xl px-4 py-3">
            <span className="text-sm text-slate-400 mr-1">Filters</span>
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.onRemove}
                className="flex items-center gap-1.5 bg-surface-raised border border-slate-700 hover:border-slate-500 text-slate-200 text-xs px-3 py-1.5 rounded-full transition-colors"
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
              <Link to="/post-service" className="mt-2 bg-primary hover:bg-blue-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors">
                Post a Service
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-8 md:gap-y-12 mb-10">
              {paginatedPosts.map((post) => (
                <ServiceCard
                  key={post.id}
                  post={post}
                  isSaved={isSaved(post.id)}
                  onToggleSave={handleToggleSave}
                  meta={sellerMeta[post.sellerId]}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="pt-6 pb-16">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                <p className="text-slate-400 text-sm">
                  {loadingMore && paginatedPosts.length === 0
                    ? 'Loading…'
                    : (() => {
                        const start = currentPage * ITEMS_PER_PAGE + 1;
                        const end = Math.min((currentPage + 1) * ITEMS_PER_PAGE, displayedPosts.length);
                        return hasMore
                          ? `Showing ${start}–${end} results`
                          : `Showing ${start}–${end} of ${displayedPosts.length} result${displayedPosts.length !== 1 ? 's' : ''}`;
                      })()}
                </p>
                {(totalPages > 1 || hasMore) && (
                  <PaginationBar
                    currentPage={currentPage}
                    totalPages={totalPages}
                    hasMore={hasMore}
                    loadingMore={loadingMore}
                    onPageChange={handlePageSelect}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 w-full py-12 px-6 lg:px-12 text-center text-sm text-slate-500">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 mb-8">
          <Link to="/about" className="hover:text-slate-300 transition-colors">About Us</Link>
          <Link to="/for-sellers" className="hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="/" className="hover:text-slate-300 transition-colors">For Buyers</Link>
          <Link to="/affiliate" className="hover:text-slate-300 transition-colors">Affiliate Program</Link>
          <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms &amp; Conditions</Link>
          <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
        </div>
        <p>© Gigspace, LLC. All rights reserved.</p>
      </footer>

      {/* Mobile filter drawer — the md+ dropdown row stays exactly as it was. */}
      {filtersOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          <div className="relative flex flex-col max-h-[85vh] bg-surface border-t border-slate-700 rounded-t-2xl">
            <div className="shrink-0 flex items-center justify-between px-4 py-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">Filters</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} className="p-1 -mr-1 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Radius — same precise-location gate as the desktop dropdown. */}
              {locationType === 'precise' && (
                <DrawerSection title="Radius">
                  {[0, 1, 5, 10, 25, 50, 100].map((mi) => (
                    <RadioOpt
                      key={mi}
                      label={mi === 0 ? 'Any distance' : `Within ${mi} mi`}
                      selected={searchRadius === mi}
                      onClick={() => { setSearchRadius(mi); setPendingRadius(mi); }}
                    />
                  ))}
                </DrawerSection>
              )}

              <DrawerSection title="Budget">
                <div className="px-4">
                  <label className="block text-xs text-slate-400 mb-2">Up to</label>
                  <div className="flex items-center bg-slate-700 border border-slate-600 rounded-lg px-3 h-10">
                    <span className="text-slate-500 text-sm">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && applyBudget()}
                      onBlur={applyBudget}
                      placeholder="Any"
                      className="flex-1 bg-transparent px-2 text-sm text-white focus:outline-none placeholder-slate-400"
                    />
                  </div>
                </div>
              </DrawerSection>

              <DrawerAccordion
                title="Rating"
                open={drawerSection === 'rating'}
                onToggle={() => setDrawerSection((s) => (s === 'rating' ? null : 'rating'))}
                summary={
                  minRating === 0 ? (
                    <span className="text-slate-400">Any rating</span>
                  ) : (
                    <>
                      <span className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < minRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}`} />
                        ))}
                      </span>
                      <span className="text-xs">&amp; up</span>
                    </>
                  )
                }
              >
                {[0, 5, 4, 3, 2, 1].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setMinRating(n); setDrawerSection(null); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-slate-300 hover:text-white hover:bg-slate-800"
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${minRating === n ? 'border-blue-400' : 'border-slate-500'}`}>
                      {minRating === n && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                    </span>
                    {n === 0 ? (
                      'Any rating'
                    ) : (
                      <>
                        <span className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3.5 h-3.5 ${i < n ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}`} />
                          ))}
                        </span>
                        <span className="text-xs">&amp; up</span>
                      </>
                    )}
                  </button>
                ))}
              </DrawerAccordion>

              <DrawerSection title="Verified">
                <RadioOpt label="Any"           selected={verifiedFilter === ''}    onClick={() => { setVerifiedFilter('');    setPendingVerified(''); }} />
                <RadioOpt label="Verified only" selected={verifiedFilter === 'yes'} onClick={() => { setVerifiedFilter('yes'); setPendingVerified('yes'); }} />
                <RadioOpt label="Not verified"  selected={verifiedFilter === 'no'}  onClick={() => { setVerifiedFilter('no');  setPendingVerified('no'); }} />
              </DrawerSection>

              <DrawerSection title="Remote">
                <RadioOpt label="All"            selected={remoteFilter === ''}          onClick={() => { setRemoteFilter('');          setPendingRemote(''); }} />
                <RadioOpt label="Remote only"    selected={remoteFilter === 'remote'}    onClick={() => { setRemoteFilter('remote');    setPendingRemote('remote'); }} />
                <RadioOpt label="In-person only" selected={remoteFilter === 'in_person'} onClick={() => { setRemoteFilter('in_person'); setPendingRemote('in_person'); }} />
              </DrawerSection>

              <DrawerAccordion
                title="Language"
                open={drawerSection === 'language'}
                onToggle={() => setDrawerSection((s) => (s === 'language' ? null : 'language'))}
                summary={
                  selectedLanguages.length === 0
                    ? <span className="text-slate-400">Any language</span>
                    : <span className="truncate">{selectedLanguages.join(', ')}</span>
                }
              >
                {languageOptions.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-500 italic">No languages listed</p>
                ) : (
                  // Multi-select: tapping a row never collapses the list.
                  <div className="max-h-64 overflow-y-auto overscroll-contain">
                    {languageOptions.map((lang) => {
                      const checked = selectedLanguages.includes(lang);
                      return (
                        <button
                          key={lang}
                          onClick={() => toggleLanguage(lang)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-slate-600'}`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                )}
              </DrawerAccordion>

              <DrawerSection title="Online Now">
                <RadioOpt label="Any"        selected={onlineFilter === ''}       onClick={() => { setOnlineFilter('');       setPendingOnline(''); }} />
                <RadioOpt label="Online now" selected={onlineFilter === 'online'} onClick={() => { setOnlineFilter('online'); setPendingOnline('online'); }} />
              </DrawerSection>
            </div>

            <div className="shrink-0 flex items-center gap-3 px-4 py-4 border-t border-slate-800">
              <button
                type="button"
                onClick={clearDrawerFilters}
                disabled={activeFilterCount === 0}
                className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => { applyBudget(); setFiltersOpen(false); }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-blue-400 text-white text-sm font-semibold transition-colors"
              >
                Show {displayedPosts.length} {displayedPosts.length === 1 ? 'result' : 'results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerSearch;
