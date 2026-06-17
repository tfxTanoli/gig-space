import { useState, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Car, Palette, Home, Package, Code, Wrench, Briefcase, Music, Megaphone, Scale, MapPinHouse, Menu, X, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import LocationSearch from './LocationSearch';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';
import StarryBackground from './StarryBackground';

const categories = [
  { name: 'Automotive', icon: Car },
  { name: 'Graphics & Design', icon: Palette },
  { name: 'Home & Garden', icon: Home },
  { name: 'Labor & Moving', icon: Package },
  { name: 'Programming & Tech', icon: Code },
  { name: 'Skilled Trade', icon: Wrench },
  { name: 'Business', icon: Briefcase },
  { name: 'Lessons', icon: Music },
  { name: 'Marketing', icon: Megaphone },
  { name: 'Legal', icon: Scale },
  { name: 'Real Estate', icon: MapPinHouse },
];

const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.5 17.5L13.8833 13.8833" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.16667 15.8333C12.8486 15.8333 15.8333 12.8486 15.8333 9.16667C15.8333 5.48477 12.8486 2.5 9.16667 2.5C5.48477 2.5 2.5 5.48477 2.5 9.16667C2.5 12.8486 5.48477 15.8333 9.16667 15.8333Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconBadgeCheck = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#bc1l)">
      <path d="M3.20833 7.18358C3.0867 6.63568 3.10538 6.06595 3.26263 5.52719C3.41988 4.98844 3.71062 4.49811 4.10789 4.10168C4.50516 3.70524 4.99609 3.41553 5.53517 3.25941C6.07425 3.10328 6.64403 3.0858 7.19167 3.20858C7.49309 2.73716 7.90834 2.34921 8.39913 2.08048C8.88992 1.81175 9.44046 1.6709 10 1.6709C10.5595 1.6709 11.1101 1.81175 11.6009 2.08048C12.0917 2.34921 12.5069 2.73716 12.8083 3.20858C13.3568 3.08526 13.9276 3.10267 14.4675 3.25917C15.0074 3.41568 15.499 3.70619 15.8965 4.10371C16.294 4.50122 16.5846 4.9928 16.7411 5.53275C16.8976 6.07269 16.915 6.64344 16.7917 7.19191C17.2631 7.49334 17.651 7.90858 17.9198 8.39937C18.1885 8.89016 18.3293 9.4407 18.3293 10.0002C18.3293 10.5598 18.1885 11.1103 17.9198 11.6011C17.651 12.0919 17.2631 12.5072 16.7917 12.8086C16.9144 13.3562 16.897 13.926 16.7408 14.4651C16.5847 15.0042 16.295 15.4951 15.8985 15.8924C15.5021 16.2896 15.0118 16.5804 14.473 16.7376C13.9343 16.8949 13.3645 16.9135 12.8166 16.7919C12.5156 17.2651 12.1 17.6547 11.6084 17.9247C11.1168 18.1946 10.565 18.3361 10.0041 18.3361C9.44329 18.3361 8.8915 18.1946 8.39987 17.9247C7.90825 17.6547 7.49268 17.2651 7.19164 16.7919C6.64401 16.9147 6.07423 16.8972 5.53515 16.7411C4.99607 16.585 4.50514 16.2952 4.10787 15.8988C3.7106 15.5024 3.41986 15.012 3.26261 14.4733C3.10536 13.9345 3.08668 13.3648 3.20831 12.8169C2.73327 12.5163 2.34199 12.1004 2.07085 11.6079C1.79971 11.1155 1.65753 10.5624 1.65753 10.0002C1.65753 9.43807 1.79971 8.88503 2.07085 8.39257C2.34199 7.9001 2.73327 7.48421 3.20833 7.18358Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 10L9.16667 11.6667L12.5 8.33333" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="bc1l"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);

const IconScreen = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.8333 2.5H4.16667C3.24619 2.5 2.5 3.24619 2.5 4.16667V12.5C2.5 13.4205 3.24619 14.1667 4.16667 14.1667H15.8333C16.7538 14.1667 17.5 13.4205 17.5 12.5V4.16667C17.5 3.24619 16.7538 2.5 15.8333 2.5Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.33333 17.5H4.16667" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 17.5H8.33333" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11.6667 17.5H12.5" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.8333 17.5H16.6667" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#ch1l)">
      <path d="M2.4934 13.6174C2.61593 13.9265 2.64321 14.2652 2.57173 14.5899L1.68423 17.3316C1.65564 17.4706 1.66303 17.6147 1.70571 17.75C1.7484 17.8854 1.82495 18.0077 1.92812 18.1052C2.03129 18.2027 2.15766 18.2722 2.29523 18.3071C2.43281 18.3421 2.57704 18.3413 2.71423 18.3049L5.5584 17.4733C5.86483 17.4125 6.18218 17.439 6.47423 17.5499C8.25372 18.3809 10.2695 18.5568 12.166 18.0464C14.0625 17.536 15.7178 16.3721 16.8398 14.7602C17.9618 13.1483 18.4785 11.1919 18.2986 9.23622C18.1188 7.2805 17.254 5.45115 15.8568 4.07092C14.4596 2.6907 12.6198 1.84829 10.6621 1.69234C8.70429 1.53639 6.75435 2.07691 5.15627 3.21854C3.55819 4.36017 2.41468 6.02955 1.92748 7.93212C1.44028 9.8347 1.64071 11.8482 2.4934 13.6174Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="ch1l"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);

const IconShieldCheck = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.6666 10.8335C16.6666 15.0002 13.75 17.0835 10.2833 18.2919C10.1018 18.3534 9.90459 18.3505 9.72498 18.2835C6.24998 17.0835 3.33331 15.0002 3.33331 10.8335V5.00021C3.33331 4.7792 3.42111 4.56724 3.57739 4.41096C3.73367 4.25468 3.94563 4.16688 4.16665 4.16688C5.83331 4.16688 7.91665 3.16688 9.36665 1.90021C9.54319 1.74938 9.76777 1.6665 9.99998 1.6665C10.2322 1.6665 10.4568 1.74938 10.6333 1.90021C12.0916 3.17521 14.1666 4.16688 15.8333 4.16688C16.0543 4.16688 16.2663 4.25468 16.4226 4.41096C16.5788 4.56724 16.6666 4.7792 16.6666 5.00021V10.8335Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 10.0002L9.16667 11.6668L12.5 8.3335" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconBadgePercent = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#bp1l)">
      <path d="M3.20831 7.18358C3.08668 6.63568 3.10536 6.06595 3.26261 5.52719C3.41986 4.98844 3.7106 4.49811 4.10787 4.10168C4.50514 3.70524 4.99607 3.41553 5.53515 3.25941C6.07423 3.10328 6.64401 3.0858 7.19164 3.20858C7.49307 2.73716 7.90831 2.34921 8.3991 2.08048C8.88989 1.81175 9.44043 1.6709 9.99998 1.6709C10.5595 1.6709 11.1101 1.81175 11.6009 2.08048C12.0916 2.34921 12.5069 2.73716 12.8083 3.20858C13.3568 3.08526 13.9275 3.10267 14.4675 3.25917C15.0074 3.41568 15.499 3.70619 15.8965 4.10371C16.294 4.50122 16.5845 4.9928 16.741 5.53275C16.8976 6.07269 16.915 6.64344 16.7916 7.19191C17.2631 7.49334 17.651 7.90858 17.9197 8.39937C18.1885 8.89016 18.3293 9.4407 18.3293 10.0002C18.3293 10.5598 18.1885 11.1103 17.9197 11.6011C17.651 12.0919 17.2631 12.5072 16.7916 12.8086C16.9144 13.3562 16.8969 13.926 16.7408 14.4651C16.5847 15.0042 16.295 15.4951 15.8985 15.8924C15.5021 16.2896 15.0118 16.5804 14.473 16.7376C13.9343 16.8949 13.3645 16.9135 12.8166 16.7919C12.5156 17.2651 12.1 17.6547 11.6084 17.9247C11.1168 18.1946 10.565 18.3361 10.0041 18.3361C9.44329 18.3361 8.8915 18.1946 8.39987 17.9247C7.90825 17.6547 7.49268 17.2651 7.19164 16.7919C6.64401 16.9147 6.07423 16.8972 5.53515 16.7411C4.99607 16.585 4.50514 16.2952 4.10787 15.8988C3.7106 15.5024 3.41986 15.012 3.26261 14.4733C3.10536 13.9345 3.08668 13.3648 3.20831 12.8169C2.73327 12.5163 2.34199 12.1004 2.07085 11.6079C1.79971 11.1155 1.65753 10.5624 1.65753 10.0002C1.65753 9.43807 1.79971 8.88503 2.07085 8.39257C2.34199 7.9001 2.73327 7.48421 3.20831 7.18358Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 7.5L7.5 12.5" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 7.5H7.50833" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 12.5H12.5083" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="bp1l"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);

const features = [
  { icon: IconSearch,       title: 'Instant search results.',      description: 'Find local or remote pros in seconds — no scrolling through irrelevant listings.' },
  { icon: IconChat,         title: 'Real-time messaging.',          description: 'Chat instantly without filling out forms, sharing personal details, or waiting for bids.' },
  { icon: IconBadgeCheck,   title: 'Transparent profiles.',         description: 'See upfront rates and service areas before reaching out.' },
  { icon: IconShieldCheck,  title: 'Secure escrow payments.',       description: 'Transact with confidence and only pay when services are completed and fully approved.' },
  { icon: IconScreen,       title: 'Photo & video portfolios.',     description: "Preview real work quality so you know exactly who you're hiring and how talented they are." },
  { icon: IconBadgePercent, title: '0% buyer fees.',                description: 'Skip the added fees other platforms sneak in — your budget should go to the work, not the platform.' },
];

const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroQuery, setHeroQuery] = useState('');
  const [heroLocation, setHeroLocation] = useState('');
  const catScrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const goToSearch = () => {
    const params = new URLSearchParams();
    if (heroQuery.trim()) params.set('q', heroQuery.trim());
    if (heroLocation) params.set('location', heroLocation);
    const qs = params.toString();
    navigate(`/search${qs ? `?${qs}` : ''}`);
  };

  const scrollCats = (dir: 'left' | 'right') =>
    catScrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">

      {/* Shared starry background wrapper: header + hero */}
      <div className="relative flex flex-col">
        <StarryBackground />

        {/* Header */}
        <header className="relative z-20 w-full px-4 md:px-6 lg:px-12 h-16 flex justify-between items-center">
          <Logo className="h-6 shrink-0" />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium">
            <Link to="/for-sellers" className="text-slate-300 hover:text-white transition-colors">For Sellers</Link>
            <Link to="/affiliate" className="text-slate-300 hover:text-white transition-colors">Become an Affiliate</Link>
            {user ? (
              <HeaderUserMenu />
            ) : (
              <>
                <Link to="/signin?next=/buyer-dashboard" className="text-slate-300 hover:text-white transition-colors">Log in</Link>
                <Link to="/signup" className="flex items-center text-slate-300 hover:text-white px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors">
                  Sign up <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden text-white p-2 rounded-md hover:bg-slate-800 transition-colors"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Mobile dropdown menu */}
          {menuOpen && (
            <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-t border-slate-700/50 shadow-xl z-50 px-6 py-4 flex flex-col space-y-4 text-sm font-medium">
              <Link to="/for-sellers" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMenuOpen(false)}>For Sellers</Link>
              <Link to="/affiliate" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMenuOpen(false)}>Become an Affiliate</Link>
              {user ? (
                <HeaderUserMenu />
              ) : (
                <>
                  <Link to="/signin?next=/buyer-dashboard" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMenuOpen(false)}>Log in</Link>
                  <Link to="/signup" className="flex items-center justify-center text-slate-300 hover:text-white px-4 py-3 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors" onClick={() => setMenuOpen(false)}>
                    Sign up <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          )}
        </header>

        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center pt-10 md:pt-24 pb-12 md:pb-16 px-4 text-center relative">
          <div className="relative z-10 w-full flex flex-col items-center">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold gradient-heading mb-4 md:mb-6">
              Local talent. On demand.
            </h1>
            <p className="text-slate-300 text-sm md:text-lg max-w-2xl mx-auto mb-8 md:mb-12">
              Hire talented pros for in-person services or remote experts for digital work.
              <br className="hidden md:block"/>
              One marketplace for everything you need.
            </p>

            {/* Search Bar */}
            <div className="w-full max-w-3xl flex flex-col md:flex-row items-center bg-surface-raised p-2 rounded-xl border border-slate-700/50 shadow-xl">
              <div className="w-full md:basis-2/5 md:shrink-0">
                <LocationSearch value={heroLocation} onChange={(label) => setHeroLocation(label)} variant="hero" />
              </div>

              <div className="hidden md:block w-[1px] h-8 bg-slate-700 mx-2"></div>

              <div className="flex-1 w-full flex items-center pr-2">
                <input
                  type="text"
                  placeholder="Search for a service"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && goToSearch()}
                  className="w-full bg-transparent border-none text-white px-4 py-2 focus:outline-none focus:ring-0 text-sm"
                />
                <button
                  onClick={goToSearch}
                  className="bg-primary hover:bg-blue-400 text-white p-3 rounded-md transition-colors flex items-center justify-center ml-2"
                >
                  <Search className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Categories Section */}
      <section className="px-4 md:px-6 lg:px-12 py-10 md:py-16">
        <div className="flex justify-between items-center mb-6 md:mb-10 max-w-7xl mx-auto">
          <h2 className="text-base md:text-lg font-semibold text-slate-300">Popular Service Categories</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => scrollCats('left')}
              className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollCats('right')}
              className="w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div ref={catScrollRef} className="overflow-x-auto scrollbar-hide max-w-7xl mx-auto">
          <div className="flex flex-nowrap gap-6 md:gap-10 pb-2 pt-4">
          {categories.map((cat, index) => {
            const Icon = cat.icon;
            return (
              <Link
                key={index}
                to={`/search?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center group cursor-pointer flex-shrink-0 px-2"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-surface-raised flex items-center justify-center mb-3 transition-transform transform group-hover:scale-105 group-hover:bg-surface-raised-hover">
                  <Icon className="w-8 h-8 md:w-10 md:h-10 text-primary" strokeWidth={1.5} />
                </div>
                <span className="text-base font-medium text-slate-300 group-hover:text-white transition-colors whitespace-nowrap">
                  {cat.name}
                </span>
              </Link>
            );
          })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full">
        <div className="mb-16">
          <span className="text-primary text-sm font-semibold tracking-wide block mb-3">
            Everything you need, all in one place
          </span>
          <h2 className="text-3xl md:text-4xl font-bold gradient-heading mb-6">
            Hire the right pro for any project
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            Find trusted professionals for any project {'—'} home repairs, digital tasks, and everything in between.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
          {features.map((feature, i) => {
            const FIcon = feature.icon;
            return (
              <div key={i} className="flex items-start">
                <div className="mt-1 flex-shrink-0">
                  <FIcon />
                </div>
                <div className="ml-4">
                  <p className="text-slate-300 text-base leading-relaxed">
                    <span className="font-bold text-white mr-1">{feature.title}</span>
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold gradient-heading mb-6">
          Work smarter, not harder.<br />
          Get more done with Gigspace today.
        </h2>
        <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
          See why we're the #1 platform that helps you move from planning to done in a fraction of the time.
        </p>
        <Link to="/signup" className="inline-flex items-center px-5 py-2 text-sm bg-white text-background font-semibold rounded-full hover:bg-slate-200 transition-colors">
          Get started for free <ArrowRight className="w-4 h-4 ml-2 text-blue-500" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-12 px-6 lg:px-12 text-center text-sm text-slate-500">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 mb-8">
          <Link to="/about" className="hover:text-slate-300 transition-colors">About Us</Link>
          <Link to="/for-sellers" className="hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="/" className="hover:text-slate-300 transition-colors">For Buyers</Link>
          <Link to="/affiliate" className="hover:text-slate-300 transition-colors">Affiliate Program</Link>
          <Link to="/terms" className="hover:text-slate-300 transition-colors cursor-pointer">Terms &amp; Conditions</Link>
          <Link to="/privacy" className="hover:text-slate-300 transition-colors cursor-pointer">Privacy Policy</Link>
        </div>
        <p>© Gigspace, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
