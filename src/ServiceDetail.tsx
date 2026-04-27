import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle, Bell, ChevronLeft, ChevronRight,
  Bookmark, Star, ArrowLeft, ArrowRight,
} from 'lucide-react';
import LocationIcon from './LocationIcon';
import { CurrentUserAvatar, UserAvatar } from './UserAvatar';

/* ─── Static data ─── */

const galleryImages = [
  '/service-card-image.png',
  '/service-card-image.png',
  '/service-card-image.png',
  '/service-card-image.png',
];

const ratingBreakdown = [
  { stars: 5, pct: 63 },
  { stars: 4, pct: 10 },
  { stars: 3, pct: 6 },
  { stars: 2, pct: 12 },
  { stars: 1, pct: 9 },
];

const reviews = [
  {
    name: 'Emily Selman',
    date: 'June 3, 2025',
    rating: 5,
    text: 'This is the bag of my dreams. I took it on my last vacation and was able to fit an absurd amount of snacks for the many long and hungry flights.',
    initials: 'ES',
    color: '#c0392b',
  },
  {
    name: 'Hector Gibbons',
    date: 'May 16, 2025',
    rating: 5,
    text: 'Before getting the Ruck Snack, I struggled my whole life with pulverized snacks, endless crumbs, and other heartbreaking snack catastrophes. Now, I can stow my snacks with confidence and style!',
    initials: 'HG',
    color: '#27ae60',
  },
  {
    name: 'Mark Edwards',
    date: 'May 5, 2025',
    rating: 4,
    text: 'I love how versatile this bag is. It can hold anything ranging from cookies that come in trays to cookies that come in tins.',
    initials: 'ME',
    color: '#8e5c3a',
  },
];

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

/* ─── Social icon buttons ─── */

const SocialBtn = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <button
    className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0"
    style={{ backgroundColor: color }}
  >
    {children}
  </button>
);

/* ─── Main component ─── */

const ServiceDetail = () => {
  const [activeImg, setActiveImg] = useState(0);

  const prev = () => setActiveImg((p) => (p === 0 ? galleryImages.length - 1 : p - 1));
  const next = () => setActiveImg((p) => (p === galleryImages.length - 1 ? 0 : p + 1));

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
          <Link
            to="/post-service"
            className="text-white text-sm font-medium hover:text-slate-300 transition-colors"
          >
            Create New Post
          </Link>
          <CurrentUserAvatar size="sm" />
        </div>
      </header>

      {/* ── Prev / Next bar ── */}
      <div className="border-b border-slate-800/60 py-2.5 flex items-center justify-center gap-3 text-sm text-slate-400">
        <button className="flex items-center gap-1 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Previous
        </button>
        <span className="text-slate-600">/</span>
        <button className="flex items-center gap-1 hover:text-white transition-colors">
          Next <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Claim banner ── */}
      <div className="bg-[#0f2040] border-b border-blue-900/50 px-6 py-2.5 text-center text-xs text-slate-300">
        This post was generated from publicly available business info. Are you the business owner?{' '}
        <span className="underline text-blue-300 cursor-pointer hover:text-blue-200 transition-colors">
          Click here to claim and update it.
        </span>
      </div>

      {/* ── Main two-column content ── */}
      <main className="max-w-6xl mx-auto w-full px-6 lg:px-10 py-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">

        {/* ═══ LEFT COLUMN ═══ */}
        <div>
          {/* Main image */}
          <div className="relative rounded-xl overflow-hidden bg-slate-800 mb-2" style={{ aspectRatio: '4/3' }}>
            <img
              src={galleryImages[activeImg]}
              alt="Service"
              className="w-full h-full object-cover"
            />
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
          </div>

          {/* Thumbnails */}
          <div className="grid grid-cols-4 gap-2 mb-8">
            {galleryImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={`rounded-lg overflow-hidden border-2 transition-colors ${
                  activeImg === i ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                style={{ aspectRatio: '4/3' }}
              >
                <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Description */}
          <div>
            <h2 className="text-base font-bold text-white mb-4">Description</h2>
            <div className="text-slate-300 text-sm leading-relaxed space-y-4">
              <p>
                Available now for your last-minute moves. We provide the best service man with the van.
                1 man or 2 men with a van or truck. We do any type of moving services!
              </p>
              <p>For inquiries send us a message.</p>
              <p className="font-bold text-white">
                Please send me pictures via chat of the things you are moving 📦📦
              </p>
              <div>
                <p className="mb-2">Include a description, for example:</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-slate-500 select-none mt-0.5">•</span>
                    <span>If there are stairs or elevator 🏢</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-500 select-none mt-0.5">•</span>
                    <span>How many flights?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-500 select-none mt-0.5">•</span>
                    <span>Old location to new location 🏠 To 🏠</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-500 select-none mt-0.5">•</span>
                    <span>
                      If you need one helper or more 👤👤👤 (We provide up to 4 depending on the size of the job)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-500 select-none mt-0.5">•</span>
                    <span>Provide date and time 📅📅</span>
                  </li>
                </ul>
              </div>
              <p>
                <span className="font-bold text-white">NOTE:</span> PLEASE SEND PHOTOS OF YOUR ITEMS AND A
                DESCRIPTION OF WHAT EXACTLY YOU NEED US TO HELP YOU WITH. 📦
              </p>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
            <span className="hover:text-white cursor-pointer transition-colors">All Services</span>
            <span className="text-slate-600">/</span>
            <span className="hover:text-white cursor-pointer transition-colors">Labor &amp; Moving</span>
            <span className="text-slate-600">/</span>
            <span className="text-white">Residential Moving</span>
          </nav>

          {/* Title */}
          <h1 className="text-xl font-bold text-white mb-4 leading-snug">
            I will help you move locally, or within a 40 mile radius of your home
          </h1>

          {/* Seller row */}
          <div className="flex items-center gap-2 mb-3">
            <UserAvatar name="Town to Town Movers" size="sm" />
            <span className="text-sm text-slate-300 font-medium">Town to Town Movers</span>
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
          </div>

          {/* Rating row */}
          <div className="flex items-center gap-2 mb-4">
            <FilledStars count={4.5} size={15} />
            <span className="text-primary text-xs hover:underline cursor-pointer">See all 162 reviews</span>
          </div>

          {/* Price */}
          <div className="mb-5">
            <span className="text-slate-400 text-sm">From </span>
            <span className="text-white text-2xl font-bold">$220</span>
            <span className="text-slate-400 text-sm"> per project</span>
          </div>

          {/* CTA + Bookmark */}
          <div className="flex items-center gap-3 mb-6">
            <button className="flex-1 bg-primary hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              Contact seller
            </button>
            <button className="w-10 h-10 border border-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-800 transition-colors flex-shrink-0">
              <Bookmark className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <hr className="border-slate-800 mb-5" />

          {/* Locations Served */}
          <div className="mb-5">
            <h3 className="text-sm font-bold text-white mb-2">Locations Served</h3>
            <div className="text-slate-400 text-sm space-y-0.5">
              <p>New York, NY</p>
              <p>Brooklyn, NY</p>
              <p>Bronx, NY</p>
            </div>
          </div>

          {/* Map placeholder */}
          <div className="rounded-xl overflow-hidden mb-5 border border-slate-700/40" style={{ height: 210 }}>
            <div
              className="w-full h-full relative"
              style={{
                background:
                  'linear-gradient(160deg, #c8d8a8 0%, #b8cca0 15%, #aec4a0 30%, #b0cce0 55%, #9fbcd8 75%, #b8cca8 100%)',
              }}
            >
              {/* Road grid overlay */}
              <div className="absolute inset-0 opacity-25">
                {[18, 32, 46, 60, 74, 88].map((t) => (
                  <div key={t} className="absolute w-full bg-white/80" style={{ top: `${t}%`, height: 2 }} />
                ))}
                {[12, 25, 38, 52, 65, 78, 91].map((l) => (
                  <div key={l} className="absolute h-full bg-white/80" style={{ left: `${l}%`, width: 2 }} />
                ))}
              </div>
              {/* Water body */}
              <div
                className="absolute bg-blue-400/35 rounded-full"
                style={{ width: '45%', height: '70%', top: '10%', right: '-8%', transform: 'rotate(-15deg)' }}
              />
              {/* Zoom controls */}
              <div className="absolute top-2 left-2 flex flex-col gap-px">
                <button className="w-6 h-6 bg-white text-gray-700 rounded-t flex items-center justify-center text-sm font-bold shadow">
                  +
                </button>
                <button className="w-6 h-6 bg-white text-gray-700 rounded-b flex items-center justify-center text-sm font-bold shadow">
                  −
                </button>
              </div>
              {/* Location marker */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full border-4 border-blue-500 bg-blue-300/25 flex items-center justify-center">
                  <LocationIcon className="w-5 h-5" />
                </div>
              </div>
              {/* Google label */}
              <div className="absolute bottom-1 right-2 text-[10px] text-gray-600 font-medium">Google</div>
            </div>
          </div>

          {/* Languages */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white mb-1">Languages Spoken</h3>
            <p className="text-slate-400 text-sm">English</p>
          </div>

          {/* Offered Remotely */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white mb-1">Offered Remotely</h3>
            <p className="text-slate-400 text-sm">No</p>
          </div>

          {/* Post ID */}
          <div className="mb-5">
            <h3 className="text-sm font-bold text-white mb-1">Post ID</h3>
            <p className="text-slate-400 text-sm">7748846438</p>
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
              {/* X / Twitter */}
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
              {/* Messenger */}
              <SocialBtn color="#0084FF">
                <MessageCircle className="w-4 h-4 text-white" />
              </SocialBtn>
              {/* Reddit */}
              <SocialBtn color="#FF4500">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                </svg>
              </SocialBtn>
              {/* Pinterest */}
              <SocialBtn color="#E60023">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001 12.017.001z" />
                </svg>
              </SocialBtn>
            </div>
          </div>
        </div>
      </main>

      {/* ── Customer Reviews ── */}
      <section className="border-t border-slate-800/60 px-6 lg:px-10 py-10 max-w-6xl mx-auto w-full">
        <h2 className="text-xl font-bold text-white mb-6">Customer Reviews</h2>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">
          {/* Rating summary */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <FilledStars count={4.5} size={18} />
            </div>
            <p className="text-slate-400 text-sm mb-5">Based on 1,624 reviews</p>
            <div className="space-y-2.5">
              {ratingBreakdown.map(({ stars, pct }) => (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs w-2.5 text-right">{stars}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-slate-400 text-xs w-7 text-right">{pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Individual reviews */}
          <div>
            {reviews.map((r, i) => (
              <div key={i}>
                <div className="flex items-center gap-3 mb-1.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.initials}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-tight">{r.name}</p>
                    <p className="text-slate-500 text-xs">{r.date}</p>
                  </div>
                </div>
                <div className="ml-12">
                  <div className="flex items-center gap-0.5 mb-2">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className={`w-3.5 h-3.5 ${j < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                      />
                    ))}
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{r.text}</p>
                </div>
                {i < reviews.length - 1 && <hr className="border-slate-800 my-7" />}
              </div>
            ))}

            <div className="text-center mt-8">
              <button className="text-slate-400 hover:text-white text-sm transition-colors">
                See more
              </button>
            </div>
          </div>
        </div>
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
