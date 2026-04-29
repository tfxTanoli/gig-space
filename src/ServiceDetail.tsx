import { useState, useEffect, type ReactNode } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  MessageCircle, Bell, ChevronLeft, ChevronRight,
  Bookmark, Star,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';
import { ref, get, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import { useSavedServices } from './useSavedServices';

/* ─── Types ─── */

interface ReviewItem {
  orderId: string;
  rating: number;
  text: string;
  reviewerName: string;
  reviewerPhoto: string;
  serviceTitle: string;
  timestamp: number;
}

interface ServicePost {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerUsername: string;
  sellerPhotoURL: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  priceMin: number;
  priceMax: number | null;
  priceType: 'per_project' | 'per_hour';
  images: string[];
  languages: string[];
  primaryLocation: string;
  extraLocations: string[];
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

/* ─── Sub-components ─── */

const FilledStars = ({ count, size = 14 }: { count: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => {
      if (i < Math.floor(count)) {
        return <Star key={i} style={{ width: size, height: size }} className="fill-amber-400 text-amber-400" />;
      }
      if (i === Math.floor(count) && count % 1 >= 0.5) {
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star style={{ width: size, height: size }} className="text-slate-600" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
              <Star style={{ width: size, height: size }} className="fill-amber-400 text-amber-400" />
            </span>
          </span>
        );
      }
      return <Star key={i} style={{ width: size, height: size }} className="text-slate-600" />;
    })}
  </div>
);

const SocialBtn = ({ color, children }: { color: string; children: ReactNode }) => (
  <button
    className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
    style={{ backgroundColor: color }}
  >
    {children}
  </button>
);

/* ─── Main component ─── */

const ServiceDetail = () => {
  const [searchParams] = useSearchParams();
  const postId = searchParams.get('id');
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const { isSaved, toggleSave } = useSavedServices();
  const [post, setPost] = useState<ServicePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const isOwnService = !!(user && post && user.uid === post.sellerId);

  const handleContactSeller = () => {
    if (!post) return;
    if (!user) { navigate('/signin'); return; }
    if (isOwnService) return;
    const params = new URLSearchParams({
      tab: 'Messages',
      with: post.sellerId,
      sellerName: post.sellerName || '',
      sellerPhoto: post.sellerPhotoURL || '',
      serviceId: post.id,
      serviceTitle: post.title,
      serviceImage: post.images?.[0] || '',
    });
    navigate(`/buyer-dashboard?${params.toString()}`);
  };

  useEffect(() => {
    if (!postId) { setNotFound(true); setLoading(false); return; }
    get(ref(database, `services/${postId}`)).then((snap) => {
      if (!snap.exists()) { setNotFound(true); }
      else { setPost({ id: postId, ...snap.val() }); }
      setLoading(false);
    });
  }, [postId]);

  useEffect(() => { setActiveImg(0); }, [post?.id]);

  // Real-time reviews listener — primary path: serviceReviews/{serviceId}
  // Fallback: scan completed orders for this service and read buyerReview entries
  useEffect(() => {
    if (!post?.id) return;
    setReviewsLoading(true);

    // Primary: listen to the denormalized serviceReviews collection
    const unsub = onValue(
      ref(database, `serviceReviews/${post.id}`),
      (snap) => {
        if (snap.exists()) {
          const list: ReviewItem[] = Object.entries(
            snap.val() as Record<string, Omit<ReviewItem, 'orderId'>>
          ).map(([orderId, r]) => ({ orderId, ...r }));
          setReviews(list.sort((a, b) => b.timestamp - a.timestamp));
          setReviewsLoading(false);
        } else {
          // Fallback: query completed orders for this service and load their reviews
          const ordersQ = query(
            ref(database, 'orders'),
            orderByChild('serviceId'),
            equalTo(post.id)
          );
          get(ordersQ)
            .then((ordersSnap) => {
              if (!ordersSnap.exists()) { setReviews([]); setReviewsLoading(false); return; }
              const completedIds: string[] = [];
              ordersSnap.forEach((c) => {
                if (c.val().status === 'completed') completedIds.push(c.key!);
              });
              if (completedIds.length === 0) { setReviews([]); setReviewsLoading(false); return; }
              Promise.all(
                completedIds.map((id) => get(ref(database, `reviews/${id}/buyerReview`)))
              ).then((snaps) => {
                const list: ReviewItem[] = snaps
                  .filter((s) => s.exists())
                  .map((s) => ({
                    orderId: s.ref.parent!.key!,
                    ...s.val(),
                    serviceTitle: post.title,
                  }));
                setReviews(list.sort((a, b) => b.timestamp - a.timestamp));
                setReviewsLoading(false);
              });
            })
            .catch(() => { setReviews([]); setReviewsLoading(false); });
        }
      },
      () => { setReviews([]); setReviewsLoading(false); }
    );

    return () => unsub();
  }, [post?.id, post?.title]);

  const images = post?.images?.length ? post.images : [];
  const prev = () => setActiveImg((p) => (p === 0 ? images.length - 1 : p - 1));
  const next = () => setActiveImg((p) => (p === images.length - 1 ? 0 : p + 1));

  const formatPrice = () => {
    if (!post) return '';
    const suffix = post.priceType === 'per_hour' ? 'per hour' : 'per project';
    if (post.priceMax) return { from: `$${post.priceMin}`, range: `$${post.priceMin} – $${post.priceMax}`, suffix };
    return { from: `$${post.priceMin}`, range: `$${post.priceMin}`, suffix };
  };
  const price = formatPrice() as { from: string; range: string; suffix: string } | '';

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1422] flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    );
  }

  /* ── Not found ── */
  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-[#0E1422] flex flex-col items-center justify-center gap-4">
        <p className="text-white font-semibold text-lg">Post not found</p>
        <Link to="/" className="text-primary text-sm hover:underline">Go home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="bg-[#0E1422] border-b border-slate-800/70 px-6 py-3.5 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <LocationIcon className="w-5 h-5 mr-0.5" />
          <span className="text-xl font-bold tracking-tight text-white">igspace</span>
        </Link>
        <div className="flex items-center gap-5">
          <button className="text-slate-400 hover:text-white transition-colors">
            <MessageCircle className="w-5 h-5" />
          </button>
          <button className="text-slate-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <Link to="/post-service" className="text-white text-sm font-medium hover:text-slate-300 transition-colors">
            Create New Post
          </Link>
          <CurrentUserAvatar size="sm" />
        </div>
      </header>

      {/* ── Main two-column content ── */}
      <main className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">

        {/* ═══ LEFT COLUMN ═══ */}
        <div>
          {/* Main image / placeholder */}
          {images.length > 0 ? (
            <>
              <div className="relative rounded-xl overflow-hidden bg-slate-800 mb-2" style={{ aspectRatio: '4/3' }}>
                <img src={images[activeImg]} alt={post.title} className="w-full h-full object-contain" />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2 mb-8">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className={`rounded-lg overflow-hidden border-2 transition-colors ${
                        activeImg === i ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ aspectRatio: '4/3' }}
                    >
                      <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl bg-[#1A2035] border border-slate-800 flex items-center justify-center mb-8" style={{ aspectRatio: '4/3' }}>
              <p className="text-slate-500 text-sm">No images uploaded</p>
            </div>
          )}

          {/* Description */}
          <div>
            <h2 className="text-base font-bold text-white mb-4">Description</h2>
            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {post.description || <span className="text-slate-500">No description provided.</span>}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
            <Link to="/search" className="hover:text-white transition-colors">All Services</Link>
            <span className="text-slate-600">/</span>
            <span className="hover:text-white cursor-pointer transition-colors">
              {categoryLabels[post.category] ?? post.category}
            </span>
            {post.subcategory && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-white">{subcategoryLabels[post.subcategory] ?? post.subcategory}</span>
              </>
            )}
          </nav>

          {/* Title */}
          <h1 className="text-xl font-bold text-white mb-4 leading-snug">{post.title}</h1>

          {/* Seller row */}
          <div className="flex items-center gap-2 mb-4">
            <UserAvatar photoURL={post.sellerPhotoURL} name={post.sellerName} size="sm" />
            <div>
              <span className="text-sm text-white font-medium">{post.sellerName}</span>
              {post.sellerUsername && (
                <span className="text-slate-500 text-xs ml-1.5">@{post.sellerUsername}</span>
              )}
            </div>
          </div>

          {/* Price */}
          {price && (
            <div className="mb-5">
              <span className="text-slate-400 text-sm">From </span>
              <span className="text-white text-2xl font-bold">{price.from}</span>
              {post.priceMax && (
                <span className="text-slate-400 text-lg font-semibold"> – ${post.priceMax}</span>
              )}
              <span className="text-slate-400 text-sm"> {price.suffix}</span>
            </div>
          )}

          {/* CTAs */}
          {isOwnService ? (
            <div className="mb-6 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-center">
              <p className="text-slate-400 text-sm">This is your service</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleContactSeller}
                className="flex-1 bg-primary hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                Message seller
              </button>
              <button
                onClick={() => post && toggleSave(post.id)}
                className="w-10 h-10 border border-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-800 transition-colors flex-shrink-0"
                title={post && isSaved(post.id) ? 'Remove from saved' : 'Save service'}
              >
                <Bookmark className={`w-4 h-4 transition-colors ${post && isSaved(post.id) ? 'fill-primary text-primary' : 'text-slate-400'}`} />
              </button>
            </div>
          )}

          <hr className="border-slate-800 mb-5" />

          {/* Locations */}
          {(post.primaryLocation || post.offeredRemotely || post.extraLocations?.length > 0) && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-white mb-2">Locations Served</h3>
              <div className="text-slate-400 text-sm space-y-1">
                {post.primaryLocation && <p>{post.primaryLocation}</p>}
                {post.extraLocations?.map((loc) => <p key={loc}>{loc}</p>)}
                {post.offeredRemotely && <p className="text-primary">Remote / Online</p>}
              </div>
            </div>
          )}

          {/* Map placeholder */}
          {(post.primaryLocation || post.offeredRemotely) && (
            <div className="rounded-xl overflow-hidden mb-5 border border-slate-700/40" style={{ height: 210 }}>
              <div
                className="w-full h-full relative"
                style={{
                  background: 'linear-gradient(160deg, #c8d8a8 0%, #b8cca0 15%, #aec4a0 30%, #b0cce0 55%, #9fbcd8 75%, #b8cca8 100%)',
                }}
              >
                <div className="absolute inset-0 opacity-25">
                  {[18, 32, 46, 60, 74, 88].map((t) => (
                    <div key={t} className="absolute w-full bg-white/80" style={{ top: `${t}%`, height: 2 }} />
                  ))}
                  {[12, 25, 38, 52, 65, 78, 91].map((l) => (
                    <div key={l} className="absolute h-full bg-white/80" style={{ left: `${l}%`, width: 2 }} />
                  ))}
                </div>
                <div className="absolute top-2 left-2 flex flex-col gap-px">
                  <button className="w-6 h-6 bg-white text-gray-700 rounded-t flex items-center justify-center text-sm font-bold shadow">+</button>
                  <button className="w-6 h-6 bg-white text-gray-700 rounded-b flex items-center justify-center text-sm font-bold shadow">−</button>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="w-14 h-14 rounded-full border-4 border-blue-500 bg-blue-300/25 flex items-center justify-center">
                    <LocationIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-gray-700 font-medium bg-white/70 px-2 py-0.5 rounded">
                    {post.offeredRemotely ? 'Remote' : post.primaryLocation}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Languages */}
          {post.languages?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white mb-1">Languages Spoken</h3>
              <p className="text-slate-400 text-sm">{post.languages.join(', ')}</p>
            </div>
          )}

          {/* Offered Remotely */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white mb-1">Offered Remotely</h3>
            <p className="text-slate-400 text-sm">{post.offeredRemotely ? 'Yes' : 'No'}</p>
          </div>

          <hr className="border-slate-800 mb-5" />

          {/* Share */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Share</h3>
            <div className="flex items-center gap-2.5">
              <SocialBtn color="#1877F2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </SocialBtn>
              <SocialBtn color="#000000">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.258 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                </svg>
              </SocialBtn>
              <SocialBtn color="#0A66C2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </SocialBtn>
              <SocialBtn color="#0084FF">
                <MessageCircle className="w-4 h-4 text-white" />
              </SocialBtn>
            </div>
          </div>
        </div>
      </main>

      {/* ── Customer Reviews ── */}
      <section className="border-t border-slate-800/60 px-6 lg:px-10 py-10 max-w-6xl mx-auto w-full">
        <h2 className="text-xl font-bold text-white mb-6">Customer Reviews</h2>

        {reviewsLoading ? (
          <p className="text-slate-500 text-sm">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <div className="flex items-center gap-2">
            <FilledStars count={0} size={16} />
            <span className="text-slate-500 text-sm">No reviews yet</span>
          </div>
        ) : (
          <>
            {/* Summary row */}
            {(() => {
              const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
              return (
                <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-800/60">
                  <span className="text-5xl font-bold text-white leading-none">{avg.toFixed(1)}</span>
                  <div>
                    <FilledStars count={avg} size={20} />
                    <p className="text-slate-400 text-sm mt-1">
                      {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Individual reviews */}
            <div className="space-y-6">
              {reviews.map((review) => (
                <div
                  key={review.orderId}
                  className="flex gap-4 pb-6 border-b border-slate-800/50 last:border-0 last:pb-0"
                >
                  <UserAvatar photoURL={review.reviewerPhoto} name={review.reviewerName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                      <p className="text-white text-sm font-semibold">{review.reviewerName}</p>
                      <span className="text-slate-600 text-xs shrink-0">
                        {new Date(review.timestamp).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <FilledStars count={review.rating} size={13} />
                    {review.text && (
                      <p className="text-slate-300 text-sm leading-relaxed mt-2">{review.text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-10 px-6 text-center text-sm text-slate-500">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 mb-6">
          <Link to="/about" className="hover:text-slate-300 transition-colors">About Us</Link>
          <Link to="/for-sellers" className="hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="/" className="hover:text-slate-300 transition-colors">For Buyers</Link>
          <Link to="/affiliate" className="hover:text-slate-300 transition-colors">Affiliate Program</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Terms &amp; Conditions</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
        </div>
        <p>© {new Date().getFullYear()} Gigspace, LLC. All rights reserved.</p>
      </footer>

    </div>
  );
};

export default ServiceDetail;
