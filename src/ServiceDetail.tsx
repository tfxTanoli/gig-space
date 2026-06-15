import { useState, useEffect, useRef, type ReactNode } from 'react';
import { sanitizeHtml } from './utils/sanitize';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight,
  Bookmark, Star, Play, ArrowRight,
} from 'lucide-react';
import Logo from './Logo';
import HeaderUserMenu from './HeaderUserMenu';
import { UserAvatar } from './UserAvatar';
import VerifiedBadgeIcon from './VerifiedBadgeIcon';
import { ref, get, onValue, query, orderByChild, equalTo, update, increment } from 'firebase/database';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import { useSavedServices } from './useSavedServices';
import { useCategories } from './CategoriesContext';
import { geocodeLocation } from './photon';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

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
  video?: string;
  videoIsCover?: boolean;
  languages: string[];
  primaryLocation: string;
  primaryLocationLat?: number;
  primaryLocationLng?: number;
  extraLocations: string[];
  offeredRemotely: boolean;
  status: 'active' | 'paused';
  createdAt: number;
}

/* ─── Map helpers ─── */

const PIN_ICON = L.divIcon({
  className: '',
  html: `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#3B82F6"/>
    <circle cx="14" cy="14" r="5.5" fill="white"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
});

interface MapPin {
  lat: number;
  lng: number;
  label: string;
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 11);
    } else {
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
    }
  }, [map, pins]);
  return null;
}

interface ServiceMapProps {
  primaryLocation: string;
  primaryLat?: number;
  primaryLng?: number;
  extraLocations: string[];
}

const ServiceMap = ({ primaryLocation, primaryLat, primaryLng, extraLocations }: ServiceMapProps) => {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const build = async () => {
      const result: MapPin[] = [];

      if (primaryLat != null && primaryLng != null) {
        result.push({ lat: primaryLat, lng: primaryLng, label: primaryLocation });
      } else if (primaryLocation) {
        const geo = await geocodeLocation(primaryLocation);
        if (geo) result.push({ lat: geo.lat, lng: geo.lng, label: primaryLocation });
      }

      for (const loc of extraLocations) {
        const geo = await geocodeLocation(loc);
        if (geo) result.push({ lat: geo.lat, lng: geo.lng, label: loc });
      }

      if (!cancelled) {
        setPins(result);
        setReady(result.length > 0);
      }
    };

    build();
    return () => { cancelled = true; };
  }, [primaryLocation, primaryLat, primaryLng, extraLocations]);

  if (!ready || pins.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden mb-5 border border-slate-700/40 bg-slate-800 flex items-center justify-center" style={{ height: 210 }}>
        <p className="text-slate-500 text-xs">Loading map…</p>
      </div>
    );
  }

  const center: [number, number] = [pins[0].lat, pins[0].lng];

  return (
    <div className="rounded-xl overflow-hidden mb-5 border border-slate-700/40" style={{ height: 210 }}>
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={true}
        style={{ width: '100%', height: '100%' }}
        attributionControl={true}
      >
        <TileLayer
          url={`https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=${import.meta.env.VITE_JAWG_ACCESS_TOKEN}`}
          attribution='<a href="https://www.jawg.io" target="_blank">&copy; Jawg Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds pins={pins} />
        {pins.map((pin, i) => (
          <Marker key={i} position={[pin.lat, pin.lng]} icon={PIN_ICON} />
        ))}
      </MapContainer>
    </div>
  );
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

/* Brand colors for social share hover */
const socialBrandColors: Record<string, string> = {
  facebook:  '#1877F2',
  twitter:   '#E7E9EA',
  linkedin:  '#0A66C2',
  messenger: '#0099FF',
  reddit:    '#FF4500',
  pinterest: '#E60023',
};

const SocialBtn = ({
  href,
  brand,
  children,
}: {
  href: string;
  brand: keyof typeof socialBrandColors;
  children: ReactNode;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ color: hovered ? socialBrandColors[brand] : '#62748E' }}
      className="flex items-center justify-center transition-colors flex-shrink-0"
      title="Share"
    >
      {children}
    </button>
  );
};

/* ─── Media item type for the gallery ─── */
type MediaItem =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string };

/* ─── Helper: readable subcategory label ─── */
function humanize(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Helper: format price with commas ─── */
function fmtPrice(n: number) {
  return n.toLocaleString('en-US');
}

/* ─── Main component ─── */

const ServiceDetail = () => {
  const [searchParams] = useSearchParams();
  const postId = searchParams.get('id');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getCategoryLabel, getSubcategoryLabel } = useCategories();

  const { isSaved, toggleSave } = useSavedServices();
  const [post, setPost] = useState<ServicePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [sellerVerified, setSellerVerified] = useState(false);

  const isOwnService = !!(user && post && user.uid === post.sellerId);
  const viewTrackedRef = useRef(false);

  const isNewSeller = !reviewsLoading && reviews.length === 0;
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  // Build ordered media list (images + optional video)
  const mediaItems: MediaItem[] = (() => {
    if (!post) return [];
    const imgs: MediaItem[] = (post.images ?? []).map((u) => ({ kind: 'image', url: u }));
    if (!post.video) return imgs;
    const vid: MediaItem = { kind: 'video', url: post.video };
    if (post.videoIsCover) return [vid, ...imgs];
    return [...imgs, vid];
  })();

  const activeMedia = mediaItems[activeIdx] ?? null;

  const prev = () => setActiveIdx((p) => (p === 0 ? mediaItems.length - 1 : p - 1));
  const next = () => setActiveIdx((p) => (p === mediaItems.length - 1 ? 0 : p + 1));

  const handleContactSeller = () => {
    if (!post) return;
    if (!user) { navigate('/signin'); return; }
    if (isOwnService) return;
    const today = new Date().toISOString().slice(0, 10);
    update(ref(database), {
      [`services/${post.id}/clicks`]: increment(1),
      [`sellerStats/${post.sellerId}/daily/${today}/clicks`]: increment(1),
    }).catch(() => {});
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
    const unsub = onValue(ref(database, `services/${postId}`), (snap) => {
      if (!snap.exists()) { setNotFound(true); }
      else { setPost({ id: postId, ...snap.val() }); }
      setLoading(false);
    });
    return () => unsub();
  }, [postId]);

  useEffect(() => { setActiveIdx(0); }, [post?.id]);

  useEffect(() => {
    if (!post?.sellerId) return;
    get(ref(database, `users/${post.sellerId}/emailVerified`))
      .then((snap) => setSellerVerified(snap.val() === true))
      .catch(() => {});
  }, [post?.sellerId]);

  useEffect(() => {
    if (!post || isOwnService || viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    const today = new Date().toISOString().slice(0, 10);
    update(ref(database), {
      [`services/${post.id}/views`]: increment(1),
      [`sellerStats/${post.sellerId}/daily/${today}/views`]: increment(1),
    }).catch(() => {});
  }, [post, isOwnService]);

  useEffect(() => {
    if (!post) return;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setNameMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const pageUrl = window.location.href;
    const image = post.images?.[0] ?? '';
    const description = post.description
      ? post.description.slice(0, 160).replace(/\s+/g, ' ').trim()
      : `${post.sellerName} offers this service on GigSpace.`;
    const priceLabel = `$${post.priceMin}${post.priceMax ? `–$${post.priceMax}` : ''} ${post.priceType === 'per_hour' ? '/hr' : '/project'}`;

    document.title = `${post.title} | GigSpace`;

    setMeta('og:type', 'website');
    setMeta('og:site_name', 'GigSpace');
    setMeta('og:url', pageUrl);
    setMeta('og:title', post.title);
    setMeta('og:description', `${priceLabel} · ${description}`);
    if (image) setMeta('og:image', image);

    setNameMeta('twitter:card', 'summary_large_image');
    setNameMeta('twitter:title', post.title);
    setNameMeta('twitter:description', `${priceLabel} · ${description}`);
    if (image) setNameMeta('twitter:image', image);

    return () => {
      document.title = 'GigSpace';
    };
  }, [post]);

  // Reviews listener
  useEffect(() => {
    if (!post?.id) return;
    setReviewsLoading(true);

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

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    );
  }

  /* ── Not found ── */
  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-white font-semibold text-lg">Post not found</p>
        <Link to="/" className="text-primary text-sm hover:underline">Go home</Link>
      </div>
    );
  }

  /* ── Breadcrumb labels ── */
  const rawCatLabel = getCategoryLabel(post.category);
  const categoryLabel = rawCatLabel !== post.category ? rawCatLabel : humanize(post.category);
  const rawSubLabel = post.subcategory ? getSubcategoryLabel(post.category, post.subcategory) : null;
  const subcategoryLabel = rawSubLabel != null
    ? (rawSubLabel !== post.subcategory ? rawSubLabel : humanize(post.subcategory))
    : null;

  const pageUrl = window.location.href;
  const enc = encodeURIComponent;
  const shareTitle = post.title;
  const shareImage = post.images?.[0] ?? '';

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="bg-background border-b border-slate-800/70 h-16 flex items-center justify-between px-4 md:px-6 lg:px-12">
        <Logo className="h-6 shrink-0" />
        <div className="flex items-center gap-3 md:gap-5">
          {user ? (
            <>
              <Link
                to="/post-service"
                className="text-white text-sm font-medium hover:text-slate-300 transition-colors hidden md:block"
              >
                Create New Post
              </Link>
              <HeaderUserMenu />
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className="text-white text-sm font-medium hover:text-slate-300 transition-colors hidden md:block"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="hidden md:flex items-center text-white text-sm px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors"
              >
                Sign up <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── Main two-column content ── */}
      <main className="w-full px-4 md:px-6 lg:px-12 py-6 md:py-8 flex flex-col">
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_minmax(0,420px)] gap-8 lg:gap-14 mb-10">

        {/* ═══ LEFT COLUMN — gallery + description ═══ */}
        <div className="order-2 lg:order-1 min-w-0">

          {/* ── Media gallery ── */}
          {mediaItems.length > 0 ? (
            <div className="mb-8">
              {/* Main viewer — 4:3 aspect ratio */}
              <div
                className="relative rounded-xl overflow-hidden bg-slate-900 mb-3 w-full"
                style={{ aspectRatio: '4/3' }}
              >
                {activeMedia?.kind === 'video' ? (
                  <video
                    key={activeMedia.url}
                    src={activeMedia.url}
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : activeMedia?.kind === 'image' ? (
                  <img
                    src={activeMedia.url}
                    alt={post.title}
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : null}

                {/* Prev / Next arrows */}
                {mediaItems.length > 1 && (
                  <>
                    <button
                      onClick={prev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                    {/* Dot indicators */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {mediaItems.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveIdx(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeIdx ? 'bg-white' : 'bg-white/40'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail strip */}
              {mediaItems.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {mediaItems.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIdx(i)}
                      className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === activeIdx ? 'border-primary' : 'border-transparent opacity-50 hover:opacity-80'
                      }`}
                      style={{ width: 72, height: 54 }}
                    >
                      {item.kind === 'video' ? (
                        <>
                          <video src={item.url} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        </>
                      ) : (
                        <img src={item.url} alt={`Thumbnail ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-surface-raised border border-slate-800 flex items-center justify-center mb-8" style={{ aspectRatio: '4/3' }}>
              <p className="text-slate-500 text-sm">No images uploaded</p>
            </div>
          )}

          {/* ── Description ── */}
          <div className="mb-8">
            <h2 className="text-base font-medium text-white mb-4">Description</h2>
            {post.description ? (
              <div
                className="text-slate-300 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_b]:text-white [&_strong]:text-white"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.description) }}
              />
            ) : (
              <span className="text-slate-500 text-sm">No description provided.</span>
            )}
          </div>

        </div>

        {/* ═══ RIGHT COLUMN — price/CTA/details ═══ */}
        <div className="order-1 lg:order-2 min-w-0 overflow-hidden">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-4 min-w-0 overflow-hidden whitespace-nowrap">
            <Link to="/search" className="hover:text-white transition-colors shrink-0">All Services</Link>
            <span className="text-slate-600 shrink-0">/</span>
            <span className="hover:text-white cursor-pointer transition-colors shrink-0">{categoryLabel}</span>
            {subcategoryLabel && (
              <>
                <span className="text-slate-600 shrink-0">/</span>
                <span className="text-white truncate">{subcategoryLabel}</span>
              </>
            )}
          </nav>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-4 leading-snug">{post.title}</h1>

          {/* Seller row */}
          <div className="flex items-center gap-2 mb-5">
            <UserAvatar photoURL={post.sellerPhotoURL} name={post.sellerName} size="sm" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-white font-medium">{post.sellerName}</span>
                {sellerVerified && <VerifiedBadgeIcon />}
              </div>
              {post.sellerUsername && (
                <span className="text-slate-500 text-xs">@{post.sellerUsername}</span>
              )}
            </div>
          </div>

          {/* Rating / New seller badge (between seller and price) */}
          {!reviewsLoading && (
            <div className="mb-5">
              {isNewSeller ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
                  <span className="text-amber-400 text-xs font-semibold">New seller</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <FilledStars count={avgRating} size={14} />
                  <span className="text-white text-sm font-semibold">{avgRating.toFixed(1)}</span>
                  <span className="text-slate-500 text-xs">
                    ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Price */}
          {post.priceMin != null && (
            <div className="mb-5">
              {post.priceMax ? (
                /* Range: From $X – $Y per project */
                <>
                  <span className="text-slate-400 text-sm">From </span>
                  <span className="text-white text-2xl font-bold">
                    ${fmtPrice(post.priceMin)} – ${fmtPrice(post.priceMax)}
                  </span>
                  <span className="text-slate-400 text-sm"> {post.priceType === 'per_hour' ? 'per hour' : 'per project'}</span>
                </>
              ) : (
                /* Single: From $X per project */
                <>
                  <span className="text-slate-400 text-sm">From </span>
                  <span className="text-white text-2xl font-bold">${fmtPrice(post.priceMin)}</span>
                  <span className="text-slate-400 text-sm"> {post.priceType === 'per_hour' ? 'per hour' : 'per project'}</span>
                </>
              )}
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
                className="flex-1 bg-primary hover:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
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

          <hr className="border-slate-800 mb-6" />

          {/* Locations */}
          {(post.primaryLocation || post.offeredRemotely || post.extraLocations?.length > 0) && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-white mb-2">Locations Served</h3>
              <div className="text-slate-400 text-sm space-y-1">
                {post.primaryLocation && <p>{post.primaryLocation}</p>}
                {post.extraLocations?.map((loc) => <p key={loc}>{loc}</p>)}
                {post.offeredRemotely && (
                  <p className="text-slate-400">
                    {post.primaryLocation ? `Remote (${post.primaryLocation})` : 'Remote'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Real map */}
          {(post.primaryLocation || (post.extraLocations?.length > 0)) && (
            <ServiceMap
              primaryLocation={post.primaryLocation}
              primaryLat={post.primaryLocationLat}
              primaryLng={post.primaryLocationLng}
              extraLocations={post.extraLocations ?? []}
            />
          )}

          {/* Divider between Locations/Map and Languages/Remote */}
          <hr className="border-slate-700 mb-6" />

          {/* Languages */}
          {post.languages?.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-white mb-1">Languages Spoken</h3>
              <div className="text-slate-400 text-sm space-y-0.5">
                {post.languages.map((lang) => (
                  <p key={lang}>{lang}</p>
                ))}
              </div>
            </div>
          )}

          {/* Offered Remotely */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-white mb-1">Offered Remotely</h3>
            <p className="text-slate-400 text-sm">{post.offeredRemotely ? 'Yes' : 'No'}</p>
          </div>

          <hr className="border-slate-800 mb-6" />

          {/* Share */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">Share</h3>
            <div className="flex items-center gap-3">
              {/* Facebook */}
              <SocialBtn href={`https://www.facebook.com/sharer/sharer.php?u=${enc(pageUrl)}`} brand="facebook">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#fb-clip)">
                    <path d="M12 2C6.4772 2 2 6.4772 2 12C2 16.6896 5.2288 20.6248 9.5844 21.7056V15.056H7.5224V12H9.5844V10.6832C9.5844 7.2796 11.1248 5.702 14.4664 5.702C15.1 5.702 16.1932 5.8264 16.6404 5.9504V8.7204C16.4044 8.6956 15.9944 8.6832 15.4852 8.6832C13.8456 8.6832 13.212 9.3044 13.212 10.9192V12H16.4784L15.9172 15.056H13.212V21.9268C18.1636 21.3288 22.0004 17.1128 22.0004 12C22 6.4772 17.5228 2 12 2Z" fill="currentColor"/>
                  </g>
                  <defs>
                    <clipPath id="fb-clip"><rect width="20" height="20" fill="white" transform="translate(2 2)"/></clipPath>
                  </defs>
                </svg>
              </SocialBtn>
              {/* X / Twitter */}
              <SocialBtn href={`https://twitter.com/intent/tweet?url=${enc(pageUrl)}&text=${enc(shareTitle)}`} brand="twitter">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.2718 3.58667H20.0831L13.9414 10.6062L21.1666 20.1583H15.5093L11.0783 14.365L6.00821 20.1583H3.19528L9.76445 12.6501L2.83325 3.58667H8.63418L12.6394 8.88195L17.2718 3.58667ZM16.2852 18.4757H17.8429L7.78775 5.18095H6.11614L16.2852 18.4757Z" fill="currentColor"/>
                </svg>
              </SocialBtn>
              {/* LinkedIn */}
              <SocialBtn href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(pageUrl)}`} brand="linkedin">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#li-clip)">
                    <path d="M20.5195 2H3.47656C2.66016 2 2 2.64453 2 3.44141V20.5547C2 21.3516 2.66016 22 3.47656 22H20.5195C21.3359 22 22 21.3516 22 20.5586V3.44141C22 2.64453 21.3359 2 20.5195 2ZM7.93359 19.043H4.96484V9.49609H7.93359V19.043ZM6.44922 8.19531C5.49609 8.19531 4.72656 7.42578 4.72656 6.47656C4.72656 5.52734 5.49609 4.75781 6.44922 4.75781C7.39844 4.75781 8.16797 5.52734 8.16797 6.47656C8.16797 7.42188 7.39844 8.19531 6.44922 8.19531ZM19.043 19.043H16.0781V14.4023C16.0781 13.2969 16.0586 11.8711 14.5352 11.8711C12.9922 11.8711 12.7578 13.0781 12.7578 14.3242V19.043H9.79688V9.49609H12.6406V10.8008H12.6797C13.0742 10.0508 14.043 9.25781 15.4844 9.25781C18.4883 9.25781 19.043 11.2344 19.043 13.8047V19.043Z" fill="currentColor"/>
                  </g>
                  <defs>
                    <clipPath id="li-clip"><rect width="20" height="20" fill="white" transform="translate(2 2)"/></clipPath>
                  </defs>
                </svg>
              </SocialBtn>
              {/* Messenger */}
              <SocialBtn href={`fb-messenger://share?link=${enc(pageUrl)}`} brand="messenger">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2.03979C6.3892 2.03979 2.03979 6.14964 2.03979 11.7009C2.03979 14.6048 3.22983 17.1135 5.16768 18.8469C5.33063 18.9923 5.42864 19.1967 5.43541 19.4146L5.4896 21.1867C5.50673 21.7516 6.09079 22.1193 6.60752 21.891L8.58442 21.0182C8.75215 20.9445 8.9398 20.9305 9.11629 20.9795C10.0251 21.2293 10.9916 21.3624 11.9996 21.3624C17.6103 21.3624 21.9597 17.2525 21.9597 11.7013C21.9597 6.15004 17.6107 2.03979 12 2.03979ZM18.1721 9.12287L14.7043 14.4821C14.5282 14.7542 14.1653 14.8319 13.8932 14.6558L10.6808 12.5774C10.5565 12.4969 10.3956 12.4993 10.2737 12.5833L6.65294 15.0805C6.12466 15.4446 5.47884 14.8179 5.82744 14.2793L9.29557 8.92008C9.47167 8.64798 9.83462 8.57029 10.1063 8.74638L13.3195 10.8252C13.4438 10.9057 13.6047 10.9033 13.7266 10.8192L17.3466 8.32249C17.8749 7.95796 18.5207 8.58503 18.1721 9.12366V9.12287Z" fill="currentColor"/>
                </svg>
              </SocialBtn>
              {/* Reddit */}
              <SocialBtn href={`https://www.reddit.com/submit?url=${enc(pageUrl)}&title=${enc(shareTitle)}`} brand="reddit">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.4412 5.65873C14.6493 6.54092 15.4415 7.19811 16.3874 7.19811C17.4918 7.19811 18.3871 6.30279 18.3871 5.19842C18.3871 4.09404 17.4918 3.19873 16.3874 3.19873C15.4218 3.19873 14.6165 3.88311 14.429 4.79342C12.8118 4.96686 11.549 6.33842 11.549 8.00061C11.549 8.00436 11.549 8.00717 11.549 8.01092C9.79023 8.08498 8.18429 8.58561 6.90929 9.37592C6.43585 9.00936 5.84147 8.79092 5.19647 8.79092C3.64866 8.79092 2.39429 10.0453 2.39429 11.5931C2.39429 12.7162 3.05429 13.6837 4.00772 14.1309C4.10054 17.384 7.64523 20.0006 12.0055 20.0006C16.3659 20.0006 19.9152 17.3812 20.0033 14.1253C20.9493 13.6753 21.6037 12.7106 21.6037 11.594C21.6037 10.0462 20.3493 8.79186 18.8015 8.79186C18.1593 8.79186 17.5677 9.00842 17.0952 9.37217C15.809 8.57623 14.1852 8.07561 12.4087 8.00904C12.4087 8.00623 12.4087 8.00436 12.4087 8.00154C12.4087 6.81092 13.2937 5.82279 14.4412 5.66061V5.65873ZM6.79679 13.3715C6.84366 12.3553 7.51866 11.5753 8.30335 11.5753C9.08804 11.5753 9.68804 12.3994 9.64116 13.4156C9.59429 14.4319 9.00835 14.8012 8.22272 14.8012C7.4371 14.8012 6.74991 14.3878 6.79679 13.3715ZM15.7087 11.5753C16.4943 11.5753 17.1693 12.3553 17.2152 13.3715C17.2621 14.3878 16.574 14.8012 15.7893 14.8012C15.0046 14.8012 14.4177 14.4328 14.3708 13.4156C14.324 12.3994 14.923 11.5753 15.7087 11.5753ZM14.7749 15.7228C14.9221 15.7378 15.0158 15.8906 14.9587 16.0275C14.4758 17.1815 13.3358 17.9925 12.0055 17.9925C10.6752 17.9925 9.53616 17.1815 9.05241 16.0275C8.99522 15.8906 9.08897 15.7378 9.23616 15.7228C10.0987 15.6356 11.0315 15.5878 12.0055 15.5878C12.9796 15.5878 13.9115 15.6356 14.7749 15.7228Z" fill="currentColor"/>
                </svg>
              </SocialBtn>
              {/* Pinterest */}
              <SocialBtn href={`https://pinterest.com/pin/create/button/?url=${enc(pageUrl)}&media=${enc(shareImage)}&description=${enc(shareTitle)}`} brand="pinterest">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.236 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.806-2.428 1.808-2.428.852 0 1.266.64 1.266 1.408 0 .858-.546 2.14-.828 3.33-.236.995.499 1.806 1.476 1.806 1.772 0 3.136-1.866 3.136-4.561 0-2.385-1.715-4.052-4.163-4.052-2.834 0-4.498 2.126-4.498 4.323 0 .856.33 1.772.742 2.272a.3.3 0 0 1 .069.286c-.076.309-.244.995-.277 1.134-.044.183-.145.222-.334.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.473 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.966-.527-2.292-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="currentColor"/>
                </svg>
              </SocialBtn>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Reviews — full width, always below both columns ── */}
      <div className="border-t border-slate-800/60 pt-8">
        <h2 className="text-xl font-medium text-white mb-6">Customer Reviews</h2>

        {reviewsLoading ? (
          <p className="text-slate-500 text-sm">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <span className="text-amber-400 text-xs font-semibold">New seller</span>
            </div>
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
      </div>
      </main>

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
