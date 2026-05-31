import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  MessageCircle,
  Bell,
  ChevronDown,
  MapPin,
  BadgeCheck,
  Star,
} from 'lucide-react';
import Logo from './Logo';
import { UserAvatar } from './UserAvatar';
import HeaderUserMenu from './HeaderUserMenu';
import { ref, onValue, get } from 'firebase/database';
import { database } from './firebase';
import { useCategories } from './CategoriesContext';

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
  extraLocations?: string[];
  offeredRemotely: boolean;
  status: 'active' | 'paused';
  createdAt: number;
}

interface SellerMeta {
  verified: boolean;
  rating: number;
  reviewCount: number;
}

function formatPrice(post: ServicePost) {
  const suffix = post.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (post.priceMax) return { prefix: '', price: `$${post.priceMin} – $${post.priceMax}`, suffix };
  return { prefix: 'From', price: `$${post.priceMin}`, suffix };
}

const BuyerSearchFiltered = () => {
  const { categoryOptions } = useCategories();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') ?? '';

  const [posts, setPosts] = useState<ServicePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerMeta, setSellerMeta] = useState<Record<string, SellerMeta>>({});

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
        const reviewCount: number = r?.reviewCount ?? 0;
        const rating = reviewCount > 0 ? r.totalStars / reviewCount : 0;
        return [id, { verified: verifiedSnap?.val() === true, rating, reviewCount }] as const;
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

  const pageTitle = categoryParam || 'All Services';

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">
      {/* Top Main Navigation */}
      <header className="w-full px-4 md:px-6 lg:px-12 h-16 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center flex-1">
          <span className="mr-10 shrink-0">
            <Logo className="h-6" />
          </span>

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
          <HeaderUserMenu />
        </div>
      </header>

      {/* Category Nav */}
      <nav className="w-full px-6 lg:px-12 py-3 border-b border-slate-800 overflow-x-auto">
        <ul className="flex items-center space-x-8 text-sm text-slate-400 whitespace-nowrap font-medium min-w-max">
          {categoryOptions.map((category) => (
            <li key={category.value}>
              <button className="hover:text-white transition-colors">{category.label}</button>
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
                const meta = sellerMeta[post.sellerId];
                const hasReviews = meta != null && meta.reviewCount > 0;
                const isVerified = meta?.verified ?? false;

                const allLocations = post.offeredRemotely
                  ? []
                  : [
                      ...(post.primaryLocation ? [post.primaryLocation] : []),
                      ...(post.extraLocations ?? []),
                    ];

                let locationLabel: string;
                if (post.offeredRemotely) {
                  locationLabel = post.primaryLocation ? `Remote (${post.primaryLocation})` : 'Remote';
                } else if (allLocations.length > 1) {
                  locationLabel = `${allLocations[0]} +${allLocations.length - 1} more`;
                } else {
                  locationLabel = allLocations[0] ?? '';
                }

                const extraLocationNames = allLocations.slice(1);

                return (
                  <div key={post.id} className="group block">
                    {/* Image */}
                    <Link to={`/service-detail?id=${post.id}`} className="block">
                      <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-3 bg-[#1A2035]">
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
                    </Link>

                    <Link to={`/service-detail?id=${post.id}`} className="block">
                      {/* Avatar & Name */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <UserAvatar photoURL={post.sellerPhotoURL} name={post.sellerName} size="sm" />
                        <span className="text-sm text-slate-300 truncate flex-1">{post.sellerName}</span>
                        {isVerified && <BadgeCheck className="w-4 h-4 text-blue-400 shrink-0" />}
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-medium text-white mb-2 leading-snug line-clamp-2 min-h-[2.5rem] group-hover:underline">
                        {post.title}
                      </h3>

                      {/* Location */}
                      {locationLabel && (
                        <div className="relative flex items-center text-slate-400 text-xs mb-2 group/loc">
                          <MapPin className="w-3 h-3 mr-1.5 shrink-0 text-slate-400" />
                          <span className="truncate">{locationLabel}</span>
                          {extraLocationNames.length > 0 && (
                            <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-20 hidden group-hover/loc:block bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 shadow-xl w-max max-w-[200px]">
                              {extraLocationNames.map((loc) => (
                                <p key={loc} className="text-xs text-slate-300 py-0.5">{loc}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Reviews / New Seller badge */}
                      {hasReviews ? (
                        <div className="flex items-center gap-1 mb-2">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs text-slate-400">
                            {meta!.rating.toFixed(1)} ({meta!.reviewCount})
                          </span>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <span className="text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            New seller
                          </span>
                        </div>
                      )}

                      {/* Price */}
                      <div className="flex items-baseline gap-1">
                        {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
                        <span className="font-bold text-white">{price}</span>
                        <span className="text-xs text-slate-400">{suffix}</span>
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

export default BuyerSearchFiltered;
