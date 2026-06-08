import { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';
import StarryBackground from './StarryBackground';

const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.5 17.5L13.8833 13.8833" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.16667 15.8333C12.8486 15.8333 15.8333 12.8486 15.8333 9.16667C15.8333 5.48477 12.8486 2.5 9.16667 2.5C5.48477 2.5 2.5 5.48477 2.5 9.16667C2.5 12.8486 5.48477 15.8333 9.16667 15.8333Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#ch1a)">
      <path d="M2.4934 13.6174C2.61593 13.9265 2.64321 14.2652 2.57173 14.5899L1.68423 17.3316C1.65564 17.4706 1.66303 17.6147 1.70571 17.75C1.7484 17.8854 1.82495 18.0077 1.92812 18.1052C2.03129 18.2027 2.15766 18.2722 2.29523 18.3071C2.43281 18.3421 2.57704 18.3413 2.71423 18.3049L5.5584 17.4733C5.86483 17.4125 6.18218 17.439 6.47423 17.5499C8.25372 18.3809 10.2695 18.5568 12.166 18.0464C14.0625 17.536 15.7178 16.3721 16.8398 14.7602C17.9618 13.1483 18.4785 11.1919 18.2986 9.23622C18.1188 7.2805 17.254 5.45115 15.8568 4.07092C14.4596 2.6907 12.6198 1.84829 10.6621 1.69234C8.70429 1.53639 6.75435 2.07691 5.15627 3.21854C3.55819 4.36017 2.41468 6.02955 1.92748 7.93212C1.44028 9.8347 1.64071 11.8482 2.4934 13.6174Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="ch1a"><rect width="20" height="20" fill="white"/></clipPath></defs>
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

const IconShieldCheck = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.6666 10.8335C16.6666 15.0002 13.75 17.0835 10.2833 18.2919C10.1018 18.3534 9.90459 18.3505 9.72498 18.2835C6.24998 17.0835 3.33331 15.0002 3.33331 10.8335V5.00021C3.33331 4.7792 3.42111 4.56724 3.57739 4.41096C3.73367 4.25468 3.94563 4.16688 4.16665 4.16688C5.83331 4.16688 7.91665 3.16688 9.36665 1.90021C9.54319 1.74938 9.76777 1.6665 9.99998 1.6665C10.2322 1.6665 10.4568 1.74938 10.6333 1.90021C12.0916 3.17521 14.1666 4.16688 15.8333 4.16688C16.0543 4.16688 16.2663 4.25468 16.4226 4.41096C16.5788 4.56724 16.6666 4.7792 16.6666 5.00021V10.8335Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 10.0002L9.16667 11.6668L12.5 8.3335" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const values = [
  {
    icon: IconSearch,
    title: 'Opportunity for everyone.',
    description: "Whether you're a local pro or a digital expert, Gigspace gives you a fair shot to earn what you're worth."
  },
  {
    icon: IconChat,
    title: 'Every interaction matters.',
    description: 'We treat every project and connection with care—because real people depend on the work done here.'
  },
  {
    icon: IconScreen,
    title: 'Simplicity wins.',
    description: 'From posting a service to hiring a pro, every step is designed to be fast, intuitive, and frustration-free.'
  },
  {
    icon: IconShieldCheck,
    title: 'Fairness & transparency.',
    description: "We're honest with our pricing, our policies, and our promises — no hidden fees, no surprises."
  },
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
      <section className="flex flex-col items-center justify-center pt-10 md:pt-20 pb-16 md:pb-24 px-4 text-center relative overflow-hidden w-full">
        <StarryBackground />
        <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto">
          <div className="inline-block border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-6 md:mb-8 tracking-wide">
            About Us
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-100 mb-4 md:mb-6 leading-tight tracking-tight">
            Changing the way people<br />work together
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            From home services to digital work, Gigspace brings people together to collaborate, create, and accomplish any project big or small.
          </p>
        </div>
      </section>

      {/* Mission & Stats Section */}
      <section className="px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Mission */}
          <div>
            <h2 className="text-3xl font-bold text-white mb-8">Our mission</h2>
            <div className="space-y-6 text-slate-400 leading-relaxed text-[15px]">
              <p>
                At Gigspace, our mission is to connect talented professionals with the people and businesses who need them—whether it's a hands-on home project, a virtual task, or anything in between. We empower sellers to turn their skills into income, while giving buyers a simple, reliable, and transparent way to hire the right pro for the job.
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
            const VIcon = value.icon;
            return (
              <div key={i} className="flex items-start">
                <div className="mt-1 flex-shrink-0">
                  <VIcon />
                </div>
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
          Gigspace makes it easier to hire, sell,<br />
          and get things done faster.
        </h2>

        <Link to="/signup" className="inline-flex items-center px-5 py-2 text-sm bg-white text-background font-semibold rounded-full hover:bg-slate-200 transition-colors">
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
        <p>© {new Date().getFullYear()} Gigspace, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AboutUs;
