import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  MessageCircle,
  Bell,
  ChevronDown,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';

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

function formatPrice(post: ServicePost) {
  const suffix = post.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (post.priceMax) return { prefix: '', price: `$${post.priceMin} – $${post.priceMax}`, suffix };
  return { prefix: 'From', price: `$${post.priceMin}`, suffix };
}

const BuyerSearchFiltered = () => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') ?? '';

  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const servicesRef = ref(database, 'services');
    const unsub = onValue(servicesRef, (snap) => {
      const result: ServicePost[] = [];
      snap.forEach((child) => {
        const val = child.val();
        if (val.status !== 'active') return;
        if (categoryParam && val.category !== categoryParam && val.subcategory !== categoryParam) return;
        result.push({ id: child.key!, ...val });
      });
      result.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(result);
      setLoading(false);
    });
    return () => unsub();
  }, [categoryParam]);

  const pageTitle = categoryParam || 'All Services';

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
          <CurrentUserAvatar size="sm" />
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
        {/* Breadcrumb */}
        <div className="text-sm font-medium mb-4">
          <Link to="/search" className="text-slate-400 hover:text-white transition-colors">All Services</Link>
          {categoryParam && (
            <>
              <span className="text-slate-600 mx-2">/</span>
              <span className="text-white">{pageTitle}</span>
            </>
          )}
        </div>

        <h1 className="text-3xl font-bold mb-8">{pageTitle}</h1>

        {/* Filter bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-2 pb-6 gap-4">
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
            <p className="text-slate-400 text-lg font-medium">No services found.</p>
            <Link to="/search" className="text-primary text-sm hover:underline">Browse all services</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 mt-4">
              {posts.map((post) => {
                const { prefix, price, suffix } = formatPrice(post);
                const location = post.offeredRemotely ? 'Remote / Online' : post.primaryLocation;
                return (
                  <Link
                    key={post.id}
                    to={`/service-detail?id=${post.id}`}
                    className="group block"
                  >
                    {/* Image */}
                    <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-4 bg-[#1A2035]">
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
                    </div>

                    {/* Seller */}
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

export default BuyerSearchFiltered;
