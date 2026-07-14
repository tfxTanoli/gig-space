import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Home,
  Package,
  FileText,
  Settings,
  RefreshCw,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  LayoutDashboard,
  LogOut,
  BadgeDollarSign,
  MapPin,
} from 'lucide-react';

const PostsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2.5H4.16667C3.72464 2.5 3.30072 2.67559 2.98816 2.98816C2.67559 3.30072 2.5 3.72464 2.5 4.16667V15.8333C2.5 16.2754 2.67559 16.6993 2.98816 17.0118C3.30072 17.3244 3.72464 17.5 4.16667 17.5H15.8333C16.2754 17.5 16.6993 17.3244 17.0118 17.0118C17.3244 16.6993 17.5 16.2754 17.5 15.8333V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.3125 2.18769C15.644 1.85617 16.0937 1.66992 16.5625 1.66992C17.0313 1.66992 17.481 1.85617 17.8125 2.18769C18.144 2.51921 18.3303 2.96885 18.3303 3.43769C18.3303 3.90653 18.144 4.35617 17.8125 4.68769L10.3017 12.1994C10.1038 12.3971 9.85934 12.5418 9.59083 12.6202L7.19667 13.3202C7.12496 13.3411 7.04895 13.3424 6.97659 13.3238C6.90423 13.3053 6.83819 13.2676 6.78537 13.2148C6.73256 13.162 6.69491 13.096 6.67637 13.0236C6.65783 12.9512 6.65909 12.8752 6.68 12.8035L7.38 10.4094C7.45877 10.1411 7.60378 9.8969 7.80167 9.69936L15.3125 2.18769Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MessagesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.57641 12.7014C1.69894 13.0105 1.72622 13.3492 1.65474 13.6739L0.767243 16.4156C0.738646 16.5546 0.74604 16.6987 0.788722 16.834C0.831405 16.9694 0.907961 17.0916 1.01113 17.1891C1.1143 17.2866 1.24067 17.3562 1.37824 17.3911C1.51582 17.4261 1.66004 17.4253 1.79724 17.3889L4.64141 16.5572C4.94784 16.4965 5.26518 16.523 5.55724 16.6339C7.33673 17.4649 9.35255 17.6407 11.249 17.1303C13.1455 16.6199 14.8008 15.4561 15.9228 13.8442C17.0448 12.2323 17.5615 10.2759 17.3817 8.3202C17.2018 6.36449 16.337 4.53514 14.9398 3.15491C13.5426 1.77468 11.7028 0.932277 9.74506 0.776325C7.78729 0.620374 5.83735 1.1609 4.23928 2.30253C2.6412 3.44416 1.49769 5.11353 1.01049 7.01611C0.523289 8.91869 0.723717 10.9322 1.57641 12.7014Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PayoutsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 15H3.33333C2.89131 15 2.46738 14.8244 2.15482 14.5118C1.84226 14.1993 1.66667 13.7754 1.66667 13.3333V6.66667C1.66667 6.22464 1.84226 5.80072 2.15482 5.48816C2.46738 5.17559 2.89131 5 3.33333 5H16.6667C17.1087 5 17.5326 5.17559 17.8452 5.48816C18.1577 5.80072 18.3333 6.22464 18.3333 6.66667V10.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.3333 15.8335L15.8333 18.3335L18.3333 15.8335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 10H15.0083" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.8333 13.3335V18.3335" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 10H5.00833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 11.6668C10.9205 11.6668 11.6667 10.9206 11.6667 10.0002C11.6667 9.07969 10.9205 8.3335 10 8.3335C9.07952 8.3335 8.33333 9.07969 8.33333 10.0002C8.33333 10.9206 9.07952 11.6668 10 11.6668Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
import Logo from './Logo';
import { sanitizeHtml } from './utils/sanitize';
import { useCategories } from './CategoriesContext';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';
import NotificationBell from './notifications/NotificationBell';
import { ref, query, orderByChild, equalTo, onValue, remove } from 'firebase/database';
import { cancelListingSubscription } from './stripe/paymentHelpers';
import { database } from './firebase';
import ChatMessages from './ChatMessages';
import { useUnreadMessages } from './useUnreadMessages';
import { useAppHeight } from './useAppHeight';
import OrdersTab from './OrdersTab';
import SettingsTab from './SettingsTab';
import WalletTab from './components/WalletTab';
import StatementsTab from './components/StatementsTab';

interface ServicePost {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  priceMin: number;
  priceMax: number | null;
  priceType: 'per_project' | 'per_hour';
  images: string[];
  primaryLocation: string;
  offeredRemotely: boolean;
  status: 'active' | 'paused' | 'draft';
  createdAt: number;
  views?: number;
  clicks?: number;
  extraLocations?: string[];
  subscriptionId?: string | null;
}


const sellerNavItems = [
  { name: 'Home', icon: Home },
  { name: 'Posts', icon: PostsIcon },
  { name: 'Orders', icon: Package },
  { name: 'Messages', icon: MessagesIcon },
  { name: 'Statements', icon: FileText },
  { name: 'Payouts', icon: PayoutsIcon },
  { name: 'Settings', icon: Settings },
];

function fmt(n: number) { return n.toLocaleString('en-US'); }

function formatPostPrice(post: ServicePost) {
  const suffix = post.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (post.priceMax) return { prefix: '', price: `$${fmt(post.priceMin)} – $${fmt(post.priceMax)}`, suffix };
  return { prefix: 'From', price: `$${fmt(post.priceMin)}`, suffix };
}

interface PostCardProps {
  post: ServicePost;
  sellerName: string;
  sellerPhotoURL: string;
  onSelect: (post: ServicePost) => void;
}

const PostCard = memo(({ post, sellerName, sellerPhotoURL, onSelect }: PostCardProps) => {
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
  const { prefix, price, suffix } = formatPostPrice(post);
  const hasStats = (post.views ?? 0) > 0 || (post.clicks ?? 0) > 0;

  return (
    <div className="group block">
      {/* Image */}
      <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-3 bg-surface-raised relative">
        <button
          onClick={() => onSelect(post)}
          className="block w-full h-full text-left"
        >
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
        </button>
        <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium ${
          post.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
        }`}>
          {post.status === 'active' ? 'Active' : 'Draft'}
        </span>
        <Link
          to={`/post-service?id=${post.id}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 w-7 h-7 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-full flex items-center justify-center transition-colors"
          title="Edit post"
        >
          <PostsIcon className="w-3.5 h-3.5 text-white" />
        </Link>
      </div>

      <button onClick={() => onSelect(post)} className="w-full text-left block">
        {/* Avatar & Name */}
        <div className="flex items-center gap-2 mb-2.5">
          <UserAvatar photoURL={sellerPhotoURL} name={sellerName} size="sm" />
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-sm text-slate-300 truncate min-w-0">{sellerName}</span>
          </div>
        </div>

        {/* Title — min-h keeps single-line titles consistent with two-line ones */}
        <h3 className="text-sm font-medium text-white mb-2 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:underline">
          {post.title}
        </h3>

        {/* Location — fixed height keeps reviews/price aligned across all cards */}
        <div className="h-[26px] flex items-center mb-2 relative group/loc">
          {locationPrimary && (
            <>
              <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0 text-slate-400" />
              <span className="truncate text-slate-400 text-[13px]">
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

        {/* Reviews row — fixed height keeps price aligned across all cards */}
        <div className="mb-2 h-[26px] flex items-center">
          <span className="text-[13px] text-slate-500">No reviews</span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
          <span className="font-bold text-white">{price}</span>
          <span className="text-xs text-slate-400">{suffix}</span>
        </div>

        {/* Views / clicks — only on dashboard cards */}
        {hasStats && (
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
            {(post.views ?? 0) > 0 && <span>{post.views!.toLocaleString()} views</span>}
            {(post.clicks ?? 0) > 0 && <span>{post.clicks!.toLocaleString()} clicks</span>}
          </div>
        )}
      </button>
    </div>
  );
});

/* ── Analytics Chart ──
   Mirrors the admin dashboard graphs: gradient fill under the lines, real
   Y-axis values, hover tooltip with each day's numbers, and week-over-week
   % change badges. */
const AnalyticsChart = ({ data }: { data: Array<{ date: string; views: number; clicks: number }> }) => {
  const [hover, setHover] = useState<number | null>(null);
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });

  const filled = days.map((date) => {
    const found = data.find((d) => d.date === date);
    return { date, views: found?.views ?? 0, clicks: found?.clicks ?? 0 };
  });

  const maxVal = Math.max(0, ...filled.map((d) => Math.max(d.views, d.clicks)));
  // Even integer ceiling so the Y axis never repeats a value (e.g. "1, 1, 0").
  const tickMax = maxVal <= 1 ? 1 : Math.ceil(maxVal / 2) * 2;
  const totalViews = filled.reduce((s, d) => s + d.views, 0);
  const totalClicks = filled.reduce((s, d) => s + d.clicks, 0);
  const hasData = totalViews > 0 || totalClicks > 0;

  // Week-over-week change: last 7 days vs the 7 days before.
  const trendOf = (key: 'views' | 'clicks') => {
    const sum = (from: number, to: number) => filled.slice(from, to).reduce((s, d) => s + d[key], 0);
    const last = sum(23, 30);
    const prev = sum(16, 23);
    if (prev === 0 && last === 0) return { text: '0%', up: true };
    if (prev === 0)               return { text: 'New', up: true };
    const t = ((last - prev) / prev) * 100;
    return { text: `${t >= 0 ? '+' : ''}${t.toFixed(0)}%`, up: t >= 0 };
  };
  const viewsTrend  = trendOf('views');
  const clicksTrend = trendOf('clicks');

  const xOf = (i: number) => (i / 29) * 100;
  const yOf = (v: number) => 38 - (v / tickMax) * 34;

  const linePath = (key: 'views' | 'clicks') =>
    filled.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(2)},${yOf(d[key]).toFixed(2)}`).join(' ');

  const areaPath = (key: 'views' | 'clicks') =>
    `${linePath(key)} L100,38 L0,38 Z`;

  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Spell out the comparison window so the % isn't a mystery number.
  const trendBadge = (t: { text: string; up: boolean }) => (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${t.up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
      title="Last 7 days vs. the 7 days before"
    >
      {t.text === 'New' ? 'New this week' : `${t.text} vs last week`}
    </span>
  );

  return (
    <div className="bg-surface border border-slate-800 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Post Analytics</h3>
          <p className="text-xs text-slate-500 mt-0.5">Last 30 days across all posts</p>
        </div>
        <div className="flex items-center gap-5 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block shrink-0" />
            Views <span className="text-white font-semibold ml-1">{totalViews.toLocaleString()}</span>
            {trendBadge(viewsTrend)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
            Clicks <span className="text-white font-semibold ml-1">{totalClicks.toLocaleString()}</span>
            {trendBadge(clicksTrend)}
          </span>
        </div>
      </div>

      {(() => {
        const fmtY = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
        return (
          <div className="flex gap-2">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between text-[11px] text-slate-400 shrink-0 w-9 text-right pt-[3px] pb-[3px]">
              <span>{fmtY(tickMax)}</span>
              <span>{tickMax <= 1 ? '' : fmtY(tickMax / 2)}</span>
              <span>0</span>
            </div>
            {/* Chart */}
            <div
              className="flex-1 relative"
              onMouseMove={(e) => {
                if (!hasData) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const i = Math.round(((e.clientX - rect.left) / rect.width) * 29);
                setHover(Math.min(29, Math.max(0, i)));
              }}
              onMouseLeave={() => setHover(null)}
            >
              <svg viewBox="0 0 100 40" className="w-full h-48" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="seller-grad-views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3B82F6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="seller-grad-clicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#F59E0B" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1={yOf(tickMax * 0.25)} x2="100" y2={yOf(tickMax * 0.25)} stroke="#1e293b" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1={yOf(tickMax * 0.5)}  x2="100" y2={yOf(tickMax * 0.5)}  stroke="#1e293b" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1={yOf(tickMax * 0.75)} x2="100" y2={yOf(tickMax * 0.75)} stroke="#1e293b" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                {hasData ? (
                  <>
                    <path d={areaPath('views')} fill="url(#seller-grad-views)" />
                    <path d={areaPath('clicks')} fill="url(#seller-grad-clicks)" />
                    <path d={linePath('views')} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <path d={linePath('clicks')} fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    {hover !== null && (
                      <line
                        x1={xOf(hover)} y1={yOf(tickMax)} x2={xOf(hover)} y2={38}
                        stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.6"
                      />
                    )}
                  </>
                ) : (
                  <path d="M0,20 L100,20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />
                )}
              </svg>

              {/* Hover dots + tooltip — HTML so they stay round/crisp despite the
                 stretched SVG. Mirrors the admin graph: the card hugs the hovered
                 point with a downward caret, rather than floating at the top. */}
              {hasData && hover !== null && (() => {
                const px = xOf(hover);
                // Anchor to the higher of the two points so the card clears both lines.
                const upperPct = (yOf(Math.max(filled[hover].views, filled[hover].clicks)) / 40) * 100;
                // Clamp the card so it can't spill past the chart edges; the caret
                // stays at the true x (its own element) so it still points at the day.
                const cardLeft = Math.min(90, Math.max(10, px));
                return (
                  <>
                    <span
                      className="absolute w-2 h-2 rounded-full bg-blue-500 border border-slate-900 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: `${px}%`, top: `${(yOf(filled[hover].views) / 40) * 100}%` }}
                    />
                    <span
                      className="absolute w-2 h-2 rounded-full bg-amber-500 border border-slate-900 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: `${px}%`, top: `${(yOf(filled[hover].clicks) / 40) * 100}%` }}
                    />
                    {/* Tooltip card, floating just above the higher point */}
                    <div
                      className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 shadow-lg whitespace-nowrap"
                      style={{
                        left: `${cardLeft}%`,
                        top: `calc(${upperPct}% - 9px)`,
                        transform: 'translate(-50%, -100%)',
                      }}
                    >
                      <p className="text-[10px] text-slate-400 leading-tight">{fmtDay(filled[hover].date)}</p>
                      <p className="text-xs font-semibold text-white leading-tight">
                        <span className="text-blue-400">{filled[hover].views.toLocaleString()}</span> views
                        <span className="text-slate-600 mx-1">·</span>
                        <span className="text-amber-400">{filled[hover].clicks.toLocaleString()}</span> clicks
                      </p>
                    </div>
                    {/* Downward caret pointing at the hovered day */}
                    <span
                      className="absolute z-10 w-0 h-0 -translate-x-1/2 pointer-events-none"
                      style={{
                        left: `${px}%`,
                        top: `calc(${upperPct}% - 9px)`,
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderTop: '5px solid #0f172a',
                      }}
                    />
                  </>
                );
              })()}

              {!hasData && (
                <div className="absolute inset-0 flex items-center justify-center px-4">
                  <p className="text-xs text-slate-600 text-center">No data yet — views and clicks appear after buyers visit your posts</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 pl-11">
        {[0, 7, 14, 21, 29].map((i) => (
          <span key={i}>{filled[i]?.date.slice(5)}</span>
        ))}
      </div>
    </div>
  );
};

/* ── Post detail modal ── */
interface PostModalProps {
  post: ServicePost;
  onClose: () => void;
  onDelete: (post: ServicePost) => void;
}

const PostModal = ({ post, onClose, onDelete }: PostModalProps) => {
  const [imgIdx, setImgIdx] = useState(0);
  const images = post.images?.length ? post.images : [];
  const { getCategoryLabel, getSubcategoryLabel } = useCategories();

  const formatPrice = () => {
    const suffix = post.priceType === 'per_hour' ? '/hr' : '/project';
    if (post.priceMax) return `$${post.priceMin} – $${post.priceMax}${suffix}`;
    return `$${post.priceMin}${suffix}`;
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative z-10 bg-surface border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-300" />
        </button>

        {/* Image carousel */}
        <div className="relative w-full bg-background rounded-t-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          {images.length > 0 ? (
            <>
              <img
                src={images[imgIdx]}
                alt={post.title}
                className="w-full h-full object-contain"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIdx(i => (i === 0 ? images.length - 1 : i - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={() => setImgIdx(i => (i === images.length - 1 ? 0 : i + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setImgIdx(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <PostsIcon className="w-10 h-10 text-slate-600" />
              <span className="text-slate-600 text-sm">No images</span>
            </div>
          )}
          {/* Status badge */}
          <span className={`absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full font-medium ${
            post.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
          }`}>
            {post.status === 'active' ? 'Active' : 'Draft'}
          </span>
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIdx ? 'border-blue-500' : 'border-transparent opacity-50 hover:opacity-80'}`}
              >
                <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Details */}
        <div className="p-5 space-y-4">
          {/* Category breadcrumb */}
          <p className="text-slate-500 text-xs">
            {(getCategoryLabel(post.category) || post.category).replace(/^\w/, c => c.toUpperCase())}
            {post.subcategory && (
              <span> / {(getSubcategoryLabel(post.category, post.subcategory) || post.subcategory).replace(/^\w/, c => c.toUpperCase())}</span>
            )}
          </p>

          {/* Title */}
          <h2 className="text-lg font-bold text-white leading-snug">{post.title}</h2>

          {/* Price row */}
          <span className="text-xl font-bold text-white">{formatPrice()}</span>

          {/* Locations */}
          {(post.primaryLocation || (post.extraLocations && post.extraLocations.length > 0)) && (
            <div className="space-y-1 mt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Locations</p>
              {post.primaryLocation && (
                <div className="flex items-center gap-1.5 text-slate-300 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  {post.primaryLocation}
                </div>
              )}
              {post.extraLocations?.map((loc) => (
                <div key={loc} className="flex items-center gap-1.5 text-slate-300 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {loc}
                  {post.primaryLocation && <span className="text-xs text-primary">+$5/mo</span>}
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          {post.description && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</p>
              <div
                className="text-slate-300 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_b]:text-white [&_strong]:text-white"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.description) }}
              />
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-500">
            <span>Created {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Link
              to={`/post-service?id=${post.id}`}
              className="flex-1 text-center bg-primary hover:bg-blue-400 text-white text-sm font-semibold py-2 rounded-[6px] transition-colors"
            >
              Edit post
            </Link>
            <button
              onClick={() => onDelete(post)}
              className="flex-1 text-center bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-400 hover:text-white text-sm font-semibold py-2 rounded-[6px] transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Delete post confirmation modal ── */
interface DeletePostModalProps {
  post: ServicePost;
  onClose: () => void;
  onSuccess: (id: string) => void;
}

const DeletePostModal = ({ post, onClose, onSuccess }: DeletePostModalProps) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleDelete = async () => {
    if (!user) return;
    setError(null);
    setDeleting(true);
    try {
      if (post.subscriptionId) {
        try { await cancelListingSubscription(post.subscriptionId); } catch { /* non-fatal */ }
      }
      await remove(ref(database, `services/${post.id}`));
      await remove(ref(database, `users/${user.uid}/posts/${post.id}`));
      onSuccess(post.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-end px-6 py-4 border-b border-slate-800">
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-center text-white font-semibold mb-1">Delete this post?</p>
          <p className="text-center text-slate-500 text-sm mb-5">
            This post will be permanently deleted and cannot be recovered.
            {post.subscriptionId && ' Any active location subscription will be cancelled.'}
          </p>
          {post.title && (
            <div className="bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 mb-4">
              <p className="text-sm text-white font-medium truncate">{post.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">{post.status}</p>
            </div>
          )}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SellerDashboard = () => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('Home');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  useAppHeight(shellRef);
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ServicePost | null>(null);
  const [deletingPost, setDeletingPost] = useState<ServicePost | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [pendingInProgressCount, setPendingInProgressCount] = useState(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState<number | null>(null);
  const [dailyStats, setDailyStats] = useState<Array<{ date: string; views: number; clicks: number }>>([]);
  const unreadMessages = useUnreadMessages('seller');
  const mainRef = useRef<HTMLElement>(null);

  const navItems = sellerNavItems;

  const handleLogout = useCallback(() => logout(), [logout]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Read ?tab= from URL on mount/change and activate the matching tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    const validTabs = sellerNavItems.map(i => i.name);
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
      setSearchParams(prev => { prev.delete('tab'); return prev; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      ref(database, 'services'),
      orderByChild('sellerId'),
      equalTo(user.uid)
    );
    const unsub = onValue(q, (snap) => {
      const result: ServicePost[] = [];
      snap.forEach((child) => {
        result.push({ id: child.key!, ...child.val() });
      });
      setPosts(result.sort((a, b) => b.createdAt - a.createdAt));
      setPostsLoading(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      ref(database, 'orders'),
      orderByChild('sellerId'),
      equalTo(user.uid)
    );
    const unsub = onValue(q, (snap) => {
      let count = 0;
      let pip = 0;
      snap.forEach((child) => {
        count++;
        const st = (child.val() as { status?: string }).status;
        if (st === 'pending' || st === 'in_progress') pip++;
      });
      setOrderCount(count);
      setPendingInProgressCount(pip);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const walletRef = ref(database, `wallets/${user.uid}`);
    const unsub = onValue(walletRef, (snap) => {
      const w = snap.val() as { lifetimeEarnings?: number } | null;
      setLifetimeEarnings(w?.lifetimeEarnings ?? 0);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const statsRef = ref(database, `sellerStats/${user.uid}/daily`);
    const unsub = onValue(statsRef, (snap) => {
      const data: Array<{ date: string; views: number; clicks: number }> = [];
      snap.forEach((child) => {
        const val = child.val() as { views?: number; clicks?: number };
        data.push({ date: child.key!, views: val.views ?? 0, clicks: val.clicks ?? 0 });
      });
      setDailyStats(data.sort((a, b) => a.date.localeCompare(b.date)));
    });
    return () => unsub();
  }, [user]);

const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const handleSelectPost = useCallback((post: ServicePost) => setSelectedPost(post), []);
  const handleDeletePost = useCallback((post: ServicePost) => setDeletingPost(post), []);
  const handleDeleteSuccess = useCallback((id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    setSelectedPost(prev => prev?.id === id ? null : prev);
  }, []);

  return (
    <div ref={shellRef} className="app-shell h-screen supports-[height:100dvh]:h-dvh overflow-hidden bg-background flex text-white font-sans">

      {/* Post detail modal */}
      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} onDelete={handleDeletePost} />
      )}

      {/* Draft delete confirmation */}
      {deletingPost && (
        <DeletePostModal
          post={deletingPost}
          onClose={() => setDeletingPost(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}

      {/* Sidebar — desktop only */}
      <aside className="w-72 bg-surface flex-col shrink-0 border-r border-slate-800 hidden md:flex">
        <div className="h-16 flex items-center px-6">
          <Logo className="h-6" />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-hidden">
          {navItems.map((item) => {
            const isActive = activeTab === item.name;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => handleTabChange(item.name)}
                className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/10 text-primary'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                {item.name}
                {item.name === 'Posts' && posts.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-blue-950 text-blue-500 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {posts.length}
                  </span>
                )}
                {item.name === 'Orders' && pendingInProgressCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-emerald-950 text-emerald-500 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {pendingInProgressCount > 9 ? '9+' : pendingInProgressCount}
                  </span>
                )}
                {item.name === 'Messages' && unreadMessages > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-amber-950 text-amber-500 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-1">
          <Link to="/buyer-dashboard" className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <RefreshCw className="w-5 h-5 mr-3" />
            Switch to buyer dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="safe-header sticky top-0 z-30 shrink-0 h-16 flex items-center justify-between px-4 md:px-6 bg-background border-b border-slate-800">
          {/* Mobile: logo */}
          <span className="md:hidden mr-3 flex items-center">
            <Logo className="h-6" />
          </span>
          <div className="flex items-center flex-1">
            <Search className="w-4 h-4 md:w-5 md:h-5 text-slate-500 mr-2 md:mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              autoComplete="one-time-code"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); }}
              className="bg-transparent border-none text-sm text-white focus:outline-none w-full max-w-sm placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <NotificationBell onNavigate={handleTabChange} dashboardType="seller" />
            <div className="w-px h-6 bg-slate-700 hidden md:block" />
            <Link to="/post-service" className="hidden sm:flex items-center gap-2 bg-primary hover:bg-blue-400 text-white text-sm font-medium px-3 md:px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> <span className="hidden md:inline">New Post</span>
            </Link>
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
                aria-label="Open user menu"
                aria-expanded={showUserMenu}
              >
                <CurrentUserAvatar size="sm" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-800">
                    <p className="text-white text-sm font-semibold truncate">{userProfile?.name ?? 'User'}</p>
                    <p className="text-slate-500 text-xs truncate mt-0.5">{user?.email ?? ''}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { handleTabChange('Home'); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <LayoutDashboard className="w-4 h-4 shrink-0 text-slate-500" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => { handleTabChange('Messages'); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <MessagesIcon className="w-4 h-4 shrink-0 text-slate-500" />
                      Messages
                    </button>
                    <button
                      onClick={() => { handleTabChange('Settings'); setShowUserMenu(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Settings className="w-4 h-4 shrink-0 text-slate-500" />
                      Settings
                    </button>
                    <Link
                      to="/affiliate"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <BadgeDollarSign className="w-4 h-4 shrink-0 text-slate-500" />
                      Affiliate Program
                    </Link>
                    <Link
                      to="/buyer-dashboard"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 shrink-0 text-slate-500" />
                      Switch to buyer dashboard
                    </Link>
                  </div>

                  <div className="border-t border-slate-700 py-1">
                    <button
                      onClick={() => { setShowUserMenu(false); handleLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
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

        <main ref={mainRef} className={`flex-1 flex flex-col overflow-x-hidden ${activeTab === 'Messages' ? 'min-h-0 overflow-hidden' : 'p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto overscroll-contain'}`}>

          {/* HOME TAB */}
          {activeTab === 'Home' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Welcome back{userProfile?.name ? `, ${userProfile.name}` : ''}!
                </h2>
                <p className="text-slate-400 text-sm mt-1">Here's an overview of your seller activity.</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-surface border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-400 text-xs mb-1">Total Posts</p>
                  <p className="text-2xl font-bold text-white">{postsLoading ? '—' : posts.length}</p>
                </div>
                <div className="bg-surface border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-400 text-xs mb-1">Orders</p>
                  <p className="text-2xl font-bold text-white">{orderCount === null ? '—' : orderCount}</p>
                </div>
                <div className="bg-surface border border-slate-800 rounded-xl p-4 col-span-2 sm:col-span-1">
                  <p className="text-slate-400 text-xs mb-1">Earnings</p>
                  <p className="text-2xl font-bold text-white">
                    {lifetimeEarnings === null ? '—' : `$${lifetimeEarnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>

              <AnalyticsChart data={dailyStats} />

              {/* Recent posts or empty state */}
              {postsLoading ? (
                <div className="border border-slate-800 rounded-xl p-8 flex items-center justify-center">
                  <p className="text-slate-500 text-sm">Loading posts...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="border border-dashed border-slate-800 rounded-xl bg-background flex flex-col items-center justify-center min-h-[240px] gap-4">
                  <p className="text-slate-500 text-sm">You have no posts yet.</p>
                  <Link to="/post-service" className="bg-primary hover:bg-blue-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors">
                    Create your first post
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Recent Posts</h3>
                    <button onClick={() => handleTabChange('Posts')} className="text-xs text-primary hover:text-blue-400 transition-colors">
                      View all →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {posts.slice(0, 4).map(post => <PostCard key={post.id} post={post} sellerName={userProfile?.name ?? ''} sellerPhotoURL={userProfile?.photoURL ?? ''} onSelect={handleSelectPost} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* POSTS TAB */}
          {activeTab === 'Posts' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Your Posts</h2>
                  <p className="text-slate-400 text-sm mt-1">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
                </div>
                <Link
                  to="/post-service"
                  className="flex items-center gap-2 bg-primary hover:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> New Post
                </Link>
              </div>

              {postsLoading ? (
                <div className="border border-slate-800 rounded-xl p-8 flex items-center justify-center">
                  <p className="text-slate-500 text-sm">Loading posts...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center min-h-[300px] gap-4">
                  <p className="text-slate-500 text-sm">No posts yet. Create one to get started.</p>
                  <Link to="/post-service" className="bg-primary hover:bg-blue-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors">
                    Create post
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                  {posts.map(post => <PostCard key={post.id} post={post} sellerName={userProfile?.name ?? ''} sellerPhotoURL={userProfile?.photoURL ?? ''} onSelect={handleSelectPost} />)}
                </div>
              )}
            </div>
          )}

          {/* MESSAGES TAB */}
          {activeTab === 'Messages' && (
            <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 pb-20 md:pb-6 overflow-hidden">
              <ChatMessages mode="seller" />
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'Orders' && <OrdersTab mode="seller" />}

          {/* SETTINGS TAB */}
          {activeTab === 'Settings' && <SettingsTab mode="seller" />}

          {/* PAYOUTS TAB */}
          {activeTab === 'Payouts' && <WalletTab />}

          {/* STATEMENTS TAB */}
          {activeTab === 'Statements' && <StatementsTab />}

          {/* OTHER TABS (coming soon) */}
          {activeTab !== 'Home' && activeTab !== 'Posts' && activeTab !== 'Messages' && activeTab !== 'Orders' && activeTab !== 'Settings' && activeTab !== 'Payouts' && activeTab !== 'Statements' && (
            <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-background flex items-center justify-center min-h-[400px]">
              <p className="text-slate-500 text-sm">{activeTab} — coming soon</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-slate-800 flex items-center z-40">
        {navItems.map((item) => {
          const isActive = activeTab === item.name;
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              onClick={() => handleTabChange(item.name)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 relative transition-colors ${
                isActive ? 'text-primary' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-medium leading-tight w-full text-center truncate">{item.name}</span>
              {item.name === 'Messages' && unreadMessages > 0 && (
                <span className="absolute top-1.5 right-1/4 translate-x-1/2 text-[9px] font-bold bg-amber-950 text-amber-500 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default SellerDashboard;
