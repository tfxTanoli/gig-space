import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  MessageCircle,
  Bell,
  ChevronDown,
  Bookmark,
  LayoutDashboard,
  MessageSquare,
  Settings,
  LogOut,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import { useSavedServices } from './useSavedServices';

const categories = [
  "Automotive", "Business", "Graphics & Design", "Home & Garden",
  "Labor & Moving", "Lessons", "Legal", "Marketing",
  "Programming & Tech", "Real Estate", "Skilled Trade"
];

const filters = [
  "Budget", "Rating", "Verified", "Remote", "Language", "Online Now"
];

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

const BuyerSearch = () => {
  const { user, userProfile, logout } = useAuth();
  const { isSaved, toggleSave } = useSavedServices();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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

  const handleLogout = async () => {
    setShowMenu(false);
    await logout();
    navigate('/signin');
  };

  useEffect(() => {
    const servicesRef = ref(database, 'services');
    const unsub = onValue(servicesRef, (snap) => {
      const result: ServicePost[] = [];
      snap.forEach((child) => {
        const val = child.val();
        if (val.status === 'active') {
          result.push({ id: child.key!, ...val });
        }
      });
      result.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(result);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">
      {/* Top Main Navigation */}
      <header className="w-full px-6 py-4 lg:px-12 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center flex-1">
          <Link to="/" className="flex items-center mr-10 shrink-0">
            <LocationIcon className="w-6 h-6 mr-1" />
            <span className="text-2xl font-bold tracking-tight text-white">igspace</span>
          </Link>

          <div className="hidden md:flex items-center bg-[#0E1422] border border-slate-700 rounded-lg overflow-hidden h-10 w-full max-w-xl">
            <div className="px-4 border-r border-slate-700 flex items-center shrink-0 cursor-pointer text-slate-300 text-sm h-full bg-[#1A2035]">
              All locations
              <ChevronDown className="w-4 h-4 ml-2 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search for a service"
              className="flex-1 bg-transparent px-4 text-sm text-white focus:outline-none placeholder-slate-500"
            />
            <button className="bg-primary h-full px-4 flex items-center justify-center hover:bg-blue-600 transition-colors">
              <Search className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-6 shrink-0">
          <button className="text-slate-400 hover:text-white transition-colors">
            <MessageCircle className="w-5 h-5" />
          </button>
          <button className="text-slate-400 hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
          </button>
          <Link to="/post-service" className="text-sm font-medium hover:text-primary transition-colors text-slate-300 hidden sm:block">
            Create New Post
          </Link>
          {/* Avatar with dropdown */}
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
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-800">
                  <p className="text-white text-sm font-semibold truncate">
                    {userProfile?.name ?? 'User'}
                  </p>
                  <p className="text-slate-500 text-xs truncate mt-0.5">
                    {user?.email ?? ''}
                  </p>
                </div>

                {/* Nav links */}
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

                {/* Sign out */}
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
      <nav className="w-full px-6 lg:px-12 py-3 border-b border-slate-800 overflow-x-auto">
        <ul className="flex items-center space-x-8 text-sm text-slate-400 whitespace-nowrap font-medium min-w-max">
          {categories.map((category, idx) => (
            <li key={idx}>
              <button className="hover:text-white transition-colors">{category}</button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main Content */}
      <main className="flex-1 px-6 lg:px-12 py-10">
        <h1 className="text-3xl font-bold mb-8">All Services</h1>

        {/* Filter bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
            Sort <ChevronDown className="w-4 h-4 ml-1" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            {filters.map((filter, idx) => (
              <div key={idx} className="flex items-center text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                {filter} <ChevronDown className="w-4 h-4 ml-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-slate-500 text-sm">Loading services…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-slate-400 text-lg font-medium">No services listed yet.</p>
            <p className="text-slate-600 text-sm">Be the first to post a service!</p>
            <Link to="/post-service" className="mt-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
              Post a Service
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {posts.map((post) => {
                const { prefix, price, suffix } = formatPrice(post);
                const location = post.offeredRemotely ? 'Remote / Online' : post.primaryLocation;
                return (
                  <div key={post.id} className="group block">
                    {/* Image */}
                    <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-4 bg-[#1A2035] relative">
                      <Link to={`/service-detail?id=${post.id}`} className="block w-full h-full">
                        {post.images?.[0] ? (
                          <img
                            src={post.images[0]}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-slate-600 text-xs">No image</span>
                          </div>
                        )}
                      </Link>
                      {/* Save button */}
                      <button
                        onClick={() => toggleSave(post.id)}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                        title={isSaved(post.id) ? 'Remove from saved' : 'Save service'}
                      >
                        <Bookmark className={`w-4 h-4 ${isSaved(post.id) ? 'fill-primary text-primary' : 'text-white'}`} />
                      </button>
                    </div>

                    {/* Seller */}
                    <Link to={`/service-detail?id=${post.id}`} className="block">
                      <div className="flex items-center gap-2 mb-2">
                        <UserAvatar photoURL={post.sellerPhotoURL} name={post.sellerName} size="sm" />
                        <span className="text-sm font-medium truncate">{post.sellerName}</span>
                      </div>

                      {/* Title */}
                      <h3 className="font-medium text-white mb-2 leading-snug line-clamp-2 group-hover:underline">
                        {post.title}
                      </h3>

                      {/* Location */}
                      {location && (
                        <div className="flex items-center text-slate-400 text-xs mb-3">
                          <LocationIcon className="w-3 h-3 mr-1.5 shrink-0" />
                          {location}
                        </div>
                      )}

                      {/* Price */}
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

            <div className="flex justify-between items-center py-6 border-t border-slate-800 mb-16">
              <p className="text-slate-400 text-sm">{posts.length} service{posts.length !== 1 ? 's' : ''} found</p>
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
