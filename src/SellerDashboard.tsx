import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import LocationIcon from './LocationIcon';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';
import NotificationBell from './notifications/NotificationBell';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { database } from './firebase';
import ChatMessages from './ChatMessages';
import { useUnreadMessages } from './useUnreadMessages';
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
  status: 'active' | 'paused';
  createdAt: number;
}

const categoryLabels: Record<string, string> = {
  digital: 'Digital Work',
  home: 'Home Services',
};

const subcategoryLabels: Record<string, string> = {
  web_dev: 'Web Development',
  mobile_dev: 'Mobile App Development',
  graphic_design: 'Graphic Design',
  video: 'Video & Animation',
  writing: 'Content Writing',
  seo: 'SEO & Marketing',
  data: 'Data & Analytics',
  cleaning: 'Cleaning',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  painting: 'Painting',
  moving: 'Moving & Delivery',
  landscaping: 'Landscaping',
  handyman: 'Handyman',
};

const sellerNavItems = [
  { name: 'Home', icon: Home },
  { name: 'Posts', icon: PostsIcon },
  { name: 'Orders', icon: Package },
  { name: 'Messages', icon: MessagesIcon },
  { name: 'Statements', icon: FileText },
  { name: 'Payouts', icon: PayoutsIcon },
  { name: 'Settings', icon: Settings },
];

function formatPostPrice(post: ServicePost) {
  const suffix = post.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (post.priceMax) return { prefix: '', price: `$${post.priceMin} – $${post.priceMax}`, suffix };
  return { prefix: 'From', price: `$${post.priceMin}`, suffix };
}

interface PostCardProps {
  post: ServicePost;
  onSelect: (post: ServicePost) => void;
}

const PostCard = memo(({ post, onSelect }: PostCardProps) => {
  const location = post.offeredRemotely ? 'Remote / Online' : post.primaryLocation;
  const { prefix, price, suffix } = formatPostPrice(post);
  return (
    <div className="group">
      <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-4 bg-[#1A2035] relative">
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
        <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium backdrop-blur-sm ${
          post.status === 'active'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-slate-800/80 text-slate-400 border border-slate-700'
        }`}>
          {post.status === 'active' ? 'Active' : 'Paused'}
        </span>
        <Link
          to={`/post-service?id=${post.id}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
          title="Edit post"
        >
          <PostsIcon className="w-3.5 h-3.5 text-white" />
        </Link>
      </div>
      <button onClick={() => onSelect(post)} className="w-full text-left">
        <h3 className="font-medium text-white mb-2 leading-snug line-clamp-2 group-hover:underline text-sm">
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
      </button>
    </div>
  );
});

/* ── Post detail modal ── */
interface PostModalProps {
  post: ServicePost;
  onClose: () => void;
}

const PostModal = ({ post, onClose }: PostModalProps) => {
  const [imgIdx, setImgIdx] = useState(0);
  const images = post.images?.length ? post.images : [];

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
        className="relative z-10 bg-[#111827] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
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
        <div className="relative w-full bg-[#0E1422] rounded-t-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
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
            post.status === 'active'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700'
          }`}>
            {post.status === 'active' ? 'Active' : 'Paused'}
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
            {categoryLabels[post.category] ?? post.category}
            {post.subcategory && (
              <span> / {subcategoryLabels[post.subcategory] ?? post.subcategory}</span>
            )}
          </p>

          {/* Title */}
          <h2 className="text-lg font-bold text-white leading-snug">{post.title}</h2>

          {/* Price + location row */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xl font-bold text-white">{formatPrice()}</span>
            {(post.primaryLocation || post.offeredRemotely) && (
              <span className="flex items-center gap-1 text-slate-400 text-sm">
                <LocationIcon className="w-3.5 h-3.5" />
                {post.offeredRemotely ? 'Remote / Online' : post.primaryLocation}
              </span>
            )}
          </div>

          {/* Description */}
          {post.description && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</p>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{post.description}</p>
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
              className="flex-1 text-center bg-primary hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Edit post
            </Link>
            <button
              onClick={onClose}
              className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SellerDashboard = () => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Home');
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ServicePost | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const unreadMessages = useUnreadMessages('seller');

  const navItems = sellerNavItems;

  const handleLogout = useCallback(async () => {
    navigate('/for-sellers', { replace: true });
    await logout();
  }, [navigate, logout]);

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
      snap.forEach(() => { count++; });
      setOrderCount(count);
    });
    return () => unsub();
  }, [user]);

  const activePosts = useMemo(() => posts.filter(p => p.status === 'active'), [posts]);
  const handleSelectPost = useCallback((post: ServicePost) => setSelectedPost(post), []);

  return (
    <div className="h-screen overflow-hidden bg-[#0E1422] flex text-white font-sans">

      {/* Post detail modal */}
      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}

      {/* Sidebar — desktop only */}
      <aside className="w-72 bg-[#111827] flex-col shrink-0 border-r border-slate-800 hidden md:flex">
        <div className="h-16 flex items-center px-6">
          <Link to="/">
            <Logo className="h-6" />
          </Link>
        </div>

        {userProfile && (
          <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-3">
            <CurrentUserAvatar size="md" />
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{userProfile.name}</p>
              <p className="text-slate-400 text-xs truncate">@{userProfile.username}</p>
            </div>
          </div>
        )}

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-hidden">
          {navItems.map((item) => {
            const isActive = activeTab === item.name;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/10 text-primary'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                {item.name}
                {item.name === 'Posts' && posts.length > 0 && (
                  <span className="ml-auto text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                    {posts.length}
                  </span>
                )}
                {item.name === 'Messages' && unreadMessages > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-blue-600 text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-1">
          <Link to="/buyer-dashboard" className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer">
            <RefreshCw className="w-5 h-5 mr-3" />
            Switch to buyer dashboard
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors"
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
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 bg-[#0E1422] border-b border-slate-800">
          {/* Mobile: logo */}
          <Link to="/" className="md:hidden mr-3">
            <Logo className="h-5" />
          </Link>
          <div className="flex items-center flex-1">
            <Search className="w-4 h-4 md:w-5 md:h-5 text-slate-500 mr-2 md:mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none text-sm text-white focus:outline-none w-full max-w-sm placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <NotificationBell onNavigate={setActiveTab} />
            <div className="w-px h-6 bg-slate-700 hidden md:block" />
            <Link to="/post-service" className="hidden sm:flex items-center gap-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium px-3 md:px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> <span className="hidden md:inline">New Post</span>
            </Link>
            <CurrentUserAvatar size="sm" />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 flex flex-col overflow-y-auto overflow-x-hidden">

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
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-400 text-xs mb-1">Total Posts</p>
                  <p className="text-2xl font-bold text-white">{postsLoading ? '—' : posts.length}</p>
                </div>
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-400 text-xs mb-1">Active</p>
                  <p className="text-2xl font-bold text-emerald-400">{postsLoading ? '—' : activePosts.length}</p>
                </div>
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 col-span-2 sm:col-span-1">
                  <p className="text-slate-400 text-xs mb-1">Orders</p>
                  <p className="text-2xl font-bold text-white">{orderCount === null ? '—' : orderCount}</p>
                </div>
              </div>

              {/* Recent posts or empty state */}
              {postsLoading ? (
                <div className="border border-slate-800 rounded-xl p-8 flex items-center justify-center">
                  <p className="text-slate-500 text-sm">Loading posts...</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex flex-col items-center justify-center min-h-[240px] gap-4">
                  <p className="text-slate-500 text-sm">You have no posts yet.</p>
                  <Link to="/post-service" className="bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
                    Create your first post
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Recent Posts</h3>
                    <button onClick={() => setActiveTab('Posts')} className="text-xs text-primary hover:text-blue-400 transition-colors">
                      View all →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {posts.slice(0, 4).map(post => <PostCard key={post.id} post={post} onSelect={handleSelectPost} />)}
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
                  className="flex items-center gap-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
                  <Link to="/post-service" className="bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
                    Create post
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {posts.map(post => <PostCard key={post.id} post={post} onSelect={handleSelectPost} />)}
                </div>
              )}
            </div>
          )}

          {/* MESSAGES TAB */}
          {activeTab === 'Messages' && (
            <ChatMessages mode="seller" />
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
            <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex items-center justify-center min-h-[400px]">
              <p className="text-slate-500 text-sm">{activeTab} — coming soon</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#111827] border-t border-slate-800 flex items-center z-40">
        {navItems.map((item) => {
          const isActive = activeTab === item.name;
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative transition-colors ${
                isActive ? 'text-primary' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
              {item.name === 'Messages' && unreadMessages > 0 && (
                <span className="absolute top-1.5 right-1/4 translate-x-1/2 text-[9px] font-bold bg-blue-600 text-white min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center">
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
