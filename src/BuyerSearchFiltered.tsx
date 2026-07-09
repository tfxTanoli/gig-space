import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
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
  priceType: 'per_project' | 'per_hour' | 'contact_for_pricing';
  images: string[];
  primaryLocation: string;
  extraLocations?: string[];
  offeredRemotely: boolean;
  status: 'active' | 'paused';
  createdAt: number;
  reviewCount?: number;
  totalStars?: number;
}

interface SellerMeta {
  verified: boolean;
}

function fmt(n: number) { return n.toLocaleString('en-US'); }
function formatPrice(post: ServicePost) {
  const suffix = post.priceType === 'per_hour' ? 'per hour' : 'per project';
  if (post.priceMax) return { prefix: 'From', price: `$${fmt(post.priceMin)} – $${fmt(post.priceMax)}`, suffix };
  return { prefix: 'From', price: `$${fmt(post.priceMin)}`, suffix };
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
        const [verifiedSnap] = await Promise.all([
          get(ref(database, `users/${id}/emailVerified`)).catch(() => null),
        ]);
        return [id, { verified: verifiedSnap?.val() === true }] as const;
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
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">
      {/* Top Main Navigation */}
      <header className="w-full px-4 md:px-6 lg:px-12 h-16 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center flex-1">
          <span className="mr-10 shrink-0">
            <Logo className="h-6" />
          </span>

          <div className="hidden md:flex items-center bg-background border border-slate-700 rounded-lg h-10 w-full max-w-xl">
            <div className="px-4 border-r border-slate-700 flex items-center shrink-0 cursor-pointer text-slate-300 text-sm h-full rounded-l-lg">
              All locations
              <ChevronDown className="w-4 h-4 ml-2 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search for a service"
              className="flex-1 bg-transparent px-4 text-sm text-white focus:outline-none placeholder-slate-400"
            />
            <button className="group flex items-center justify-center shrink-0">
              <svg width="36" height="40" viewBox="0 0 36 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect y="6" width="30" height="28" rx="4" className="fill-[#2B7FFF] group-hover:fill-blue-400 transition-colors"/>
                <path d="M14.1667 25.3333C17.8486 25.3333 20.8333 22.3486 20.8333 18.6667C20.8333 14.9848 17.8486 12 14.1667 12C10.4848 12 7.5 14.9848 7.5 18.6667C7.5 22.3486 10.4848 25.3333 14.1667 25.3333Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22.5003 27.0003L18.917 23.417" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
                const svcReviewCount = post.reviewCount ?? 0;
                const svcAvgRating = svcReviewCount > 0 ? (post.totalStars ?? 0) / svcReviewCount : 0;
                const hasReviews = svcReviewCount > 0;
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
                      <div className="aspect-[4/3] w-full rounded-xl overflow-hidden mb-3 bg-surface-raised">
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

                      {/* Location — always reserves height so the badge/price row aligns across cards */}
                      <div className="relative flex items-center text-slate-400 text-xs mb-2 min-h-[16px] group/loc">
                        {locationLabel && (
                          <>
                            <MapPin className="w-3 h-3 mr-1.5 shrink-0 text-slate-400" />
                            <span className="truncate">{locationLabel}</span>
                            {extraLocationNames.length > 0 && (
                              <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-20 hidden group-hover/loc:block bg-surface border border-slate-700 rounded-lg px-3 py-2 shadow-xl w-max max-w-[200px]">
                                {extraLocationNames.map((loc) => (
                                  <p key={loc} className="text-xs text-slate-300 py-0.5">{loc}</p>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Reviews / New Seller badge — fixed height keeps price aligned across cards */}
                      <div className="flex items-center mb-2 h-[24px]">
                        {hasReviews ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs text-slate-400">
                              {svcAvgRating.toFixed(1)} ({svcReviewCount})
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                            New seller
                          </span>
                        )}
                      </div>

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
              })}
            </div>

            <div className="flex justify-between items-center py-6 mb-16">
              <p className="text-slate-400 text-sm">{posts.length} service{posts.length !== 1 ? 's' : ''} found</p>
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
    </div>
  );
};

export default BuyerSearchFiltered;
