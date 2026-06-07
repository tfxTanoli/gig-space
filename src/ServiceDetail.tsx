import { useState, useEffect, useRef, type ReactNode } from 'react';
import { sanitizeHtml } from './utils/sanitize';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  MessageCircle, Bell, ChevronLeft, ChevronRight,
  Bookmark, Star, Play,
} from 'lucide-react';
import Logo from './Logo';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';
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
      map.fitBounds(bounds, { padding: [40, 40] });
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

      // Primary location — use saved lat/lng if available, otherwise geocode
      if (primaryLat != null && primaryLng != null) {
        result.push({ lat: primaryLat, lng: primaryLng, label: primaryLocation });
      } else if (primaryLocation) {
        const geo = await geocodeLocation(primaryLocation);
        if (geo) result.push({ lat: geo.lat, lng: geo.lng, label: primaryLocation });
      }

      // Extra locations — always geocode (no saved coords)
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
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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

const SocialBtn = ({ color, children }: { color: string; children: ReactNode }) => (
  <button
    className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
    style={{ backgroundColor: color }}
  >
    {children}
  </button>
);

/* ─── Media item type for the gallery ─── */
type MediaItem =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string };

/* ─── Helper: readable subcategory label ─── */
function humanize(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
  // getCategoryLabel returns the raw slug when no match found — detect that and humanize instead
  const rawCatLabel = getCategoryLabel(post.category);
  const categoryLabel = rawCatLabel !== post.category ? rawCatLabel : humanize(post.category);
  const rawSubLabel = post.subcategory ? getSubcategoryLabel(post.category, post.subcategory) : null;
  const subcategoryLabel = rawSubLabel != null
    ? (rawSubLabel !== post.subcategory ? rawSubLabel : humanize(post.subcategory))
    : null;

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">

      {/* ── Header ── */}
      <header className="bg-background border-b border-slate-800/70 px-4 md:px-6 lg:px-12 h-16 flex items-center justify-between">
        <Logo className="h-6 shrink-0" />
        <div className="flex items-center gap-3 md:gap-5">
          <button className="text-slate-400 hover:text-white transition-colors hidden md:block">
            <MessageCircle className="w-5 h-5" />
          </button>
          <button className="text-slate-400 hover:text-white transition-colors hidden md:block">
            <Bell className="w-5 h-5" />
          </button>
          <Link to="/post-service" className="text-white text-sm font-medium hover:text-slate-300 transition-colors hidden md:block">
            Create New Post
          </Link>
          <CurrentUserAvatar size="sm" />
        </div>
      </header>

      {/* ── Main two-column content ── */}
      <main className="max-w-6xl mx-auto w-full px-4 md:px-6 lg:px-10 py-6 md:py-8 flex flex-col lg:grid lg:grid-cols-[1fr_380px] gap-8 md:gap-10">

        {/* ═══ LEFT COLUMN — gallery + description ═══ */}
        <div className="order-2 lg:order-1">

          {/* ── Media gallery ── */}
          {mediaItems.length > 0 ? (
            <div className="mb-8">
              {/* Main viewer — 4:3 aspect ratio, 592px wide on desktop */}
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

          {/* Description */}
          <div>
            <h2 className="text-base font-bold text-white mb-4">Description</h2>
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
        <div className="order-1 lg:order-2">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
            <Link to="/search" className="hover:text-white transition-colors">All Services</Link>
            <span className="text-slate-600">/</span>
            <span className="hover:text-white cursor-pointer transition-colors">{categoryLabel}</span>
            {subcategoryLabel && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-white">{subcategoryLabel}</span>
              </>
            )}
          </nav>

          {/* Title */}
          <h1 className="text-xl font-bold text-white mb-4 leading-snug">{post.title}</h1>

          {/* Seller row */}
          <div className="flex items-center gap-2 mb-4">
            <UserAvatar photoURL={post.sellerPhotoURL} name={post.sellerName} size="sm" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm text-white font-medium">{post.sellerName}</span>
              {sellerVerified && <VerifiedBadgeIcon />}
              {post.sellerUsername && (
                <span className="text-slate-500 text-xs">@{post.sellerUsername}</span>
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
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white mb-2">Locations Served</h3>
              <div className="text-slate-400 text-sm space-y-1">
                {post.primaryLocation && <p>{post.primaryLocation}</p>}
                {post.extraLocations?.map((loc) => <p key={loc}>{loc}</p>)}
                {post.offeredRemotely && <p className="text-primary">Remote / Online</p>}
              </div>
            </div>
          )}

          {/* Real map — only when there is a geocodable location */}
          {(post.primaryLocation || (post.extraLocations?.length > 0)) && (
            <ServiceMap
              primaryLocation={post.primaryLocation}
              primaryLat={post.primaryLocationLat}
              primaryLng={post.primaryLocationLng}
              extraLocations={post.extraLocations ?? []}
            />
          )}

          {/* Languages — one per line */}
          {post.languages?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white mb-1">Languages Spoken</h3>
              <div className="text-slate-400 text-sm space-y-0.5">
                {post.languages.map((lang) => (
                  <p key={lang}>{lang}</p>
                ))}
              </div>
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
      <section className="border-t border-slate-800/60 px-4 md:px-6 lg:px-10 py-8 md:py-10 max-w-6xl mx-auto w-full">
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
