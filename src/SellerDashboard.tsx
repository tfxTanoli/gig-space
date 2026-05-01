import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  Edit3,
  Package,
  MessageSquare,
  FileText,
  DollarSign,
  Settings,
  RefreshCw,
  Search,
  Bell,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';
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
              <Edit3 className="w-10 h-10 text-slate-600" />
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
                <img src={img} alt="" className="w-full h-full object-cover" />
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
              to="/post-service"
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
  const [activeTab, setActiveTab] = useState('Home');
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ServicePost | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const unreadMessages = useUnreadMessages('seller');

  const navItems = [
    { name: 'Home', icon: Home },
    { name: 'Posts', icon: Edit3 },
    { name: 'Orders', icon: Package },
    { name: 'Messages', icon: MessageSquare },
    { name: 'Statements', icon: FileText },
    { name: 'Payouts', icon: DollarSign },
    { name: 'Settings', icon: Settings },
  ];

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

  const activePosts = posts.filter(p => p.status === 'active');

  const formatPrice = (post: ServicePost) => {
    const suffix = post.priceType === 'per_hour' ? '/hr' : '/project';
    if (post.priceMax) return `$${post.priceMin} – $${post.priceMax}${suffix}`;
    return `$${post.priceMin}${suffix}`;
  };

  const PostCard = ({ post }: { post: ServicePost }) => (
    <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col hover:border-slate-600 transition-colors">
      {/* Thumbnail — opens modal */}
      <button
        onClick={() => setSelectedPost(post)}
        className="block relative w-full aspect-[4/3] bg-[#1A2035] shrink-0 overflow-hidden group text-left"
      >
        {post.images?.[0] ? (
          <img
            src={post.images[0]}
            alt={post.title}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Edit3 className="w-8 h-8 text-slate-600" />
            <span className="text-slate-600 text-xs">No image</span>
          </div>
        )}
        {/* Status badge over image */}
        <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium backdrop-blur-sm ${
          post.status === 'active'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-slate-800/80 text-slate-400 border border-slate-700'
        }`}>
          {post.status === 'active' ? 'Active' : 'Paused'}
        </span>
      </button>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        {/* Category */}
        <p className="text-slate-500 text-xs mb-1.5">{categoryLabels[post.category] ?? post.category}</p>

        {/* Title */}
        <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-2">
          {post.title}
        </h3>

        {/* Description */}
        {post.description && (
          <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-3">
            {post.description}
          </p>
        )}

        {/* Price + Location */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-auto mb-3">
          <span className="font-semibold text-white text-sm">{formatPrice(post)}</span>
          {(post.primaryLocation || post.offeredRemotely) && (
            <span className="flex items-center gap-1 text-slate-400">
              <LocationIcon className="w-3 h-3" />
              {post.offeredRemotely ? 'Remote' : post.primaryLocation}
            </span>
          )}
        </div>

        {/* Footer: Edit · View · Date */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-800 text-xs">
          <Link
            to="/post-service"
            className="text-primary hover:text-blue-400 font-medium transition-colors"
          >
            Edit
          </Link>
          <span className="text-slate-700">·</span>
          <button
            onClick={() => setSelectedPost(post)}
            className="text-slate-400 hover:text-white font-medium transition-colors"
          >
            View
          </button>
          <span className="text-slate-700 ml-auto">
            {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">

      {/* Post detail modal */}
      {selectedPost && (
        <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}

      {/* Sidebar — desktop only */}
      <aside className="w-64 bg-[#111827] flex-col shrink-0 border-r border-slate-800 hidden md:flex">
        <div className="h-16 flex items-center px-6">
          <Link to="/" className="flex items-center">
            <LocationIcon className="w-6 h-6 mr-1" />
            <span className="text-xl font-bold tracking-tight text-white">igspace</span>
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

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
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
            onClick={logout}
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
          <Link to="/" className="flex items-center md:hidden mr-3">
            <LocationIcon className="w-5 h-5 mr-1" />
            <span className="text-base font-bold text-white">igspace</span>
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
            <button className="text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-700 hidden md:block" />
            <Link to="/post-service" className="hidden sm:flex items-center gap-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium px-3 md:px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> <span className="hidden md:inline">New Post</span>
            </Link>
            <CurrentUserAvatar size="sm" />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 flex flex-col">

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
                    {posts.slice(0, 4).map(post => <PostCard key={post.id} post={post} />)}
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
                  {posts.map(post => <PostCard key={post.id} post={post} />)}
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
