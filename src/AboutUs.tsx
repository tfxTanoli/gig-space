import { useState } from 'react';
import { ArrowRight, ShieldCheck, Zap, Globe, Scale, Heart, Users, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';

const values = [
  {
    icon: ShieldCheck,
    title: 'Trust first.',
    description: 'We built a platform where transparency, safety, and reliability come before everything else.'
  },
  {
    icon: Zap,
    title: 'Simplicity wins.',
    description: 'From posting a service to hiring a pro, every step is designed to be fast, intuitive, and frustration-free.'
  },
  {
    icon: Globe,
    title: 'Opportunity for everyone.',
    description: "Whether you're a local pro or a digital expert, Gigspace gives you a fair shot to earn what you're worth."
  },
  {
    icon: Scale,
    title: 'Fairness & transparency.',
    description: "We're honest with our pricing, our policies, and our promises â€” no hidden fees, no surprises."
  },
  {
    icon: Heart,
    title: 'Every interaction matters.',
    description: 'We treat every project and connection with careâ€”because real people depend on the work done here.'
  },
  {
    icon: Users,
    title: 'Strength in community.',
    description: "We're building a space where pros and customers succeed together."
  }
];

const AboutUs = () => {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">
      {/* Header */}
      <header className="w-full px-4 md:px-6 lg:px-12 h-16 flex justify-between items-center relative">
        <div className="flex items-center">
          <Logo className="h-6" />
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium">
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

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-t border-slate-700/50 shadow-xl z-50 px-6 py-4 flex flex-col space-y-4 text-sm font-medium">
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
      <section className="flex flex-col items-center justify-center pt-10 md:pt-20 pb-16 md:pb-24 px-4 text-center max-w-4xl mx-auto">
        <div className="inline-block border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-6 md:mb-8 tracking-wide">
          About Us
        </div>

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6 leading-tight tracking-tight">
          Changing the way people<br />work together
        </h1>
        <p className="text-slate-400 text-base md:text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed">
          From home services to digital work, Gigspace brings people together to collaborate, create, and accomplish any project big or small.
        </p>
      </section>

      {/* Mission & Stats Section */}
      <section className="px-6 lg:px-12 py-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Mission */}
          <div>
            <h2 className="text-3xl font-bold text-white mb-8">Our mission</h2>
            <div className="space-y-6 text-slate-400 leading-relaxed text-[15px]">
              <p>
                At Gigspace, our mission is to connect talented professionals with the people and businesses who need themâ€”whether it's a hands-on home project, a virtual task, or anything in between. We empower sellers to turn their skills into income, while giving buyers a simple, reliable, and transparent way to hire the right pro for the job.
              </p>
              <p>
                By combining the flexibility of digital freelance platforms with the reach of local service marketplaces, we make hiring faster, safer, and more efficient for everyone. Our platform is built to remove unnecessary fees, streamline communication, and provide secure transactions, so professionals can focus on what they do best and buyers can get their work done with confidence.
              </p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex flex-col justify-center space-y-10 lg:pl-12">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">$1.95 trillion</div>
              <div className="text-slate-500 text-sm">Spent annually on services worldwide</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">62%</div>
              <div className="text-slate-500 text-sm">People who prefer hiring local talent</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">$5 - $100K</div>
              <div className="text-slate-500 text-sm">Price range sellers can set</div>
            </div>
          </div>
        </div>
      </section>

      {/* Full Width Image Banner */}
      <section className="px-6 lg:px-12 py-16 w-full max-w-7xl mx-auto">
        <div className="w-full h-auto md:h-[500px] rounded-2xl overflow-hidden shadow-2xl">
          <img
            src="/about-hero.png"
            alt="Team collaborating at Gigspace"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-center"
          />
        </div>
      </section>

      {/* About Us Values */}
      <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto w-full border-b border-slate-800/80 mb-8">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-bold text-white mb-4">About Us</h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Every feature, design, and interaction on Gigspace is built to accomplish one thing: help people succeed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
          {values.map((value, i) => {
            const Icon = value.icon;
            return (
              <div key={i} className="flex items-start">
                <Icon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div className="ml-4">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    <span className="font-bold text-white mr-1">{value.title}</span> 
                    {value.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-10 leading-tight">
          Gigspace makes is easier to hire, sell,<br />
          and get things done faster.
        </h2>
        
        <Link to="/signup" className="inline-flex items-center px-6 py-3 bg-white text-background font-semibold rounded-full hover:bg-slate-200 transition-colors">
          Get started for free <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-6 lg:px-12 text-center text-sm text-slate-500">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 mb-8">
          <Link to="/about" className="hover:text-slate-300 transition-colors">About Us</Link>
          <Link to="/for-sellers" className="hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="/" className="hover:text-slate-300 transition-colors">For Buyers</Link>
          <Link to="/affiliate" className="hover:text-slate-300 transition-colors">Affiliate Program</Link>
          <Link to="/terms" className="hover:text-slate-300 transition-colors cursor-pointer">Terms &amp; Conditions</Link>
          <Link to="/privacy" className="hover:text-slate-300 transition-colors cursor-pointer">Privacy Policy</Link>
        </div>
        <p>Â© {new Date().getFullYear()} Gigspace, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AboutUs;
