import { useState } from 'react';
import { Search, ArrowRight, ChevronLeft, ChevronRight, Car, PenTool, Home, Package, Code, Hammer, MessageSquare, UserCheck, ShieldCheck, Image, Percent, Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import LocationSearch from './LocationSearch';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';

const categories = [
  { name: 'Automotive', icon: Car },
  { name: 'Graphics & Design', icon: PenTool },
  { name: 'Home & Garden', icon: Home },
  { name: 'Labor & Moving', icon: Package },
  { name: 'Programming & Tech', icon: Code },
  { name: 'Skilled Trade', icon: Hammer },
];

const features = [
  {
    icon: Search,
    title: 'Instant search results.',
    description: 'Find local or remote pros in seconds — no scrolling through irrelevant listings.'
  },
  {
    icon: MessageSquare,
    title: 'Real-time messaging.',
    description: 'Chat instantly without filling out forms, sharing personal details, or waiting for bids.'
  },
  {
    icon: UserCheck,
    title: 'Transparent profiles.',
    description: 'See upfront rates and service areas before reaching out.'
  },
  {
    icon: ShieldCheck,
    title: 'Secure escrow payments.',
    description: 'Transact with confidence and only pay when services are completed and fully approved.'
  },
  {
    icon: Image,
    title: 'Photo & video portfolios.',
    description: "Preview real work quality so you know exactly who you're hiring and how talented they are."
  },
  {
    icon: Percent,
    title: '0% buyer fees.',
    description: 'Skip the added fees other platforms sneak in — your budget should go to the work, not the platform.'
  }
];

const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroQuery, setHeroQuery] = useState('');
  const [heroLocation, setHeroLocation] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const goToSearch = () => {
    const params = new URLSearchParams();
    if (heroQuery.trim()) params.set('q', heroQuery.trim());
    if (heroLocation) params.set('location', heroLocation);
    const qs = params.toString();
    navigate(`/search${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">

      {/* Header */}
      <header className="w-full px-4 py-4 md:px-6 md:py-6 lg:px-12 flex justify-between items-center relative">
        <div className="flex items-center">
          <Logo className="h-6" />
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium">
          <Link to="/for-sellers" className="text-white hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="/signup" className="text-white hover:text-slate-300 transition-colors">Become an Affiliate</Link>
          {user ? (
            <HeaderUserMenu />
          ) : (
            <>
              <Link to="/signin" className="text-white hover:text-slate-300 transition-colors">Log in</Link>
              <Link to="/signup" className="flex items-center text-white px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors">
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
          <div className="lg:hidden absolute top-full left-0 right-0 bg-[#0E1422] border-t border-slate-700/50 shadow-xl z-50 px-6 py-4 flex flex-col space-y-4 text-sm font-medium">
            <Link to="/for-sellers" className="text-white hover:text-slate-300 transition-colors py-2" onClick={() => setMenuOpen(false)}>For Sellers</Link>
            <Link to="/signup" className="text-white hover:text-slate-300 transition-colors py-2" onClick={() => setMenuOpen(false)}>Become an Affiliate</Link>
            {user ? (
              <HeaderUserMenu />
            ) : (
              <>
                <Link to="/signin" className="text-white hover:text-slate-300 transition-colors py-2" onClick={() => setMenuOpen(false)}>Log in</Link>
                <Link to="/signup" className="flex items-center justify-center text-white px-4 py-3 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors" onClick={() => setMenuOpen(false)}>
                  Sign up <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center pt-10 md:pt-24 pb-12 md:pb-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6">
          Local talent. On demand.
        </h1>
        <p className="text-slate-400 text-base md:text-lg lg:text-xl max-w-2xl mx-auto mb-8 md:mb-12">
          Hire talented pros for in-person services or remote experts for digital work.
          <br className="hidden md:block"/>
          One marketplace for everything you need.
        </p>

        {/* Search Bar */}
        <div className="w-full max-w-3xl flex flex-col md:flex-row items-center bg-[#1A2035] p-2 rounded-xl border border-slate-700/50 shadow-xl">
          <LocationSearch value={heroLocation} onChange={(label) => setHeroLocation(label)} variant="hero" />

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
              className="bg-primary hover:bg-blue-600 text-white p-2 md:px-6 md:py-3 rounded-lg transition-colors flex items-center justify-center ml-2"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="px-4 md:px-6 lg:px-12 py-10 md:py-16">
        <div className="flex justify-between items-center mb-6 md:mb-10 max-w-7xl mx-auto">
          <h2 className="text-base md:text-lg font-semibold text-slate-300">Popular Service Categories</h2>
          <div className="flex items-center space-x-2">
            <button className="w-8 h-8 rounded-full bg-[#1A2035] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-full bg-[#1A2035] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 md:gap-8 max-w-7xl mx-auto">
          {categories.map((cat, index) => {
            const Icon = cat.icon;
            return (
              <Link
                key={index}
                to={`/search?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center group cursor-pointer"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#1A2035] flex items-center justify-center mb-3 md:mb-4 transition-transform transform group-hover:scale-105 group-hover:bg-[#212942]">
                  <Icon className="w-6 h-6 md:w-8 md:h-8 text-primary" strokeWidth={1.5} />
                </div>
                <span className="text-xs md:text-sm font-medium text-slate-300 group-hover:text-white transition-colors text-center">
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full">
        <div className="mb-16">
          <span className="text-primary text-sm font-semibold tracking-wide uppercase block mb-3">
            Everything you need, all in one place
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Hire the right pro for any project
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl">
            Find trusted professionals for any project — home repairs, digital tasks, and everything in between.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
          {features.map((feature, i) => {
            const FIcon = feature.icon;
            return (
              <div key={i} className="flex items-start">
                <FIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div className="ml-4">
                  <p className="text-slate-300 text-sm leading-relaxed">
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
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          Work smarter, not harder.<br />
          Get more done with Gigspace today.
        </h2>
        <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
          See why we're the #1 platform that helps you move from planning to done in a fraction of the time.
        </p>
        <Link to="/signup" className="inline-flex items-center px-6 py-3 bg-white text-[#0E1422] font-semibold rounded-full hover:bg-slate-200 transition-colors">
          Get started for free <ArrowRight className="w-4 h-4 ml-2" />
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
        <p>© {new Date().getFullYear()} Gigspace, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
