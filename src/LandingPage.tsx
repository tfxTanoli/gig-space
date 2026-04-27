import { MapPin, Search, ChevronDown, ArrowRight, ChevronLeft, ChevronRight, Car, PenTool, Home, Package, Code, Hammer, MessageSquare, UserCheck, ShieldCheck, Image, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">
      
      {/* Header */}
      <header className="w-full px-6 py-6 lg:px-12 flex justify-between items-center">
        <div className="flex items-center">
          <MapPin className="text-primary w-6 h-6 mr-1" />
          <span className="text-xl font-bold tracking-tight text-white">igspace</span>
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link to="/account-type" className="text-white hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="/signin" className="text-white hover:text-slate-300 transition-colors">Log in</Link>
          <Link to="/signup" className="flex items-center text-white px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors">
            Sign up <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center pt-24 pb-16 px-4 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          Local talent. On demand.
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-12">
          Hire talented pros for in-person services or remote experts for digital work. 
          <br className="hidden md:block"/>
          One marketplace for everything you need.
        </p>

        {/* Search Bar */}
        <div className="w-full max-w-3xl flex flex-col md:flex-row items-center bg-[#1A2035] p-2 rounded-xl border border-slate-700/50 shadow-xl">
          <div className="flex items-center w-full md:w-auto px-4 py-2 text-slate-300 mb-2 md:mb-0 cursor-pointer">
            <span className="text-sm mr-2 whitespace-nowrap">All locations</span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </div>
          
          <div className="hidden md:block w-[1px] h-8 bg-slate-700 mx-2"></div>
          
          <div className="flex-1 w-full flex items-center pr-2">
            <input 
              type="text" 
              placeholder="Search for a service" 
              className="w-full bg-transparent border-none text-white px-4 py-2 focus:outline-none focus:ring-0 text-sm"
            />
            <button className="bg-primary hover:bg-blue-600 text-white p-2 md:px-6 md:py-3 rounded-lg transition-colors flex items-center justify-center ml-2">
              <Search className="w-5 h-5 text-white md:hidden" />
              <Search className="w-5 h-5 text-white hidden md:block" />
            </button>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="px-6 lg:px-12 py-16">
        <div className="flex justify-between items-center mb-10 max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold text-slate-300">Popular Service Categories</h2>
          <div className="flex items-center space-x-2">
            <button className="w-8 h-8 rounded-full bg-[#1A2035] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-full bg-[#1A2035] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-8 md:gap-12 max-w-7xl mx-auto">
          {categories.map((cat, index) => {
            const Icon = cat.icon;
            return (
              <div key={index} className="flex flex-col items-center group cursor-pointer">
                <div className="w-20 h-20 rounded-full bg-[#1A2035] flex items-center justify-center mb-4 transition-transform transform group-hover:scale-105 group-hover:bg-[#212942]">
                  <Icon className="w-8 h-8 text-primary" strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  {cat.name}
                </span>
              </div>
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
          <Link to="#" className="hover:text-slate-300 transition-colors">About Us</Link>
          <Link to="/account-type" className="hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">For Buyers</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Affiliate Program</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Terms & Conditions</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
        </div>
        <p>© {new Date().getFullYear()} Gigspace, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
