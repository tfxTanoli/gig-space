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
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { database } from './firebase';

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

const SellerDashboard = () => {
  const { user, userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

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

  const activePosts = posts.filter(p => p.status === 'active');

  const formatPrice = (post: ServicePost) => {
    const suffix = post.priceType === 'per_hour' ? '/hr' : '/project';
    if (post.priceMax) return `$${post.priceMin} – $${post.priceMax}${suffix}`;
    return `$${post.priceMin}${suffix}`;
  };

  const PostCard = ({ post }: { post: ServicePost }) => (
    <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col hover:border-slate-600 transition-colors">
      {/* Thumbnail — clickable, opens post detail */}
      <Link to={`/service-detail?id=${post.id}`} className="block relative w-full aspect-[4/3] bg-[#1A2035] shrink-0 overflow-hidden group">
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
      </Link>

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
          <Link
            to={`/service-detail?id=${post.id}`}
            className="text-slate-400 hover:text-white font-medium transition-colors"
          >
            View
          </Link>
          <span className="text-slate-700 ml-auto">
            {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0E1422] flex text-white font-sans">

      {/* Sidebar */}
      <aside className="w-64 bg-[#111827] flex flex-col shrink-0 border-r border-slate-800 hidden md:flex">
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
        <header className="h-16 flex items-center justify-between px-6 bg-[#0E1422] border-b border-slate-800">
          <div className="flex items-center flex-1">
            <Search className="w-5 h-5 text-slate-500 mr-3" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent border-none text-sm text-white focus:outline-none w-full max-w-sm placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-700" />
            <Link to="/post-service" className="hidden sm:flex items-center gap-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New Post
            </Link>
            <CurrentUserAvatar size="sm" />
          </div>
        </header>

        <main className="flex-1 p-6 flex flex-col">

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
                  <p className="text-2xl font-bold text-white">0</p>
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

          {/* OTHER TABS */}
          {activeTab !== 'Home' && activeTab !== 'Posts' && (
            <div className="flex-1 border border-dashed border-slate-800 rounded-xl bg-[#0E1422] flex items-center justify-center min-h-[400px]">
              <p className="text-slate-500 text-sm">{activeTab} — coming soon</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SellerDashboard;
