import { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';
import StarryBackground from './StarryBackground';

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.6666 10.8335C16.6666 15.0002 13.75 17.0835 10.2833 18.2919C10.1018 18.3534 9.90459 18.3505 9.72498 18.2835C6.24998 17.0835 3.33331 15.0002 3.33331 10.8335V5.00021C3.33331 4.7792 3.42111 4.56724 3.57739 4.41096C3.73367 4.25468 3.94563 4.16688 4.16665 4.16688C5.83331 4.16688 7.91665 3.16688 9.36665 1.90021C9.54319 1.74938 9.76777 1.6665 9.99998 1.6665C10.2322 1.6665 10.4568 1.74938 10.6333 1.90021C12.0916 3.17521 14.1666 4.16688 15.8333 4.16688C16.0543 4.16688 16.2663 4.25468 16.4226 4.41096C16.5788 4.56724 16.6666 4.7792 16.6666 5.00021V10.8335Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 10C12.2091 10 14 8.20914 14 6C14 3.79086 12.2091 2 10 2C7.79086 2 6 3.79086 6 6C6 8.20914 7.79086 10 10 10Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.33331 17.5C3.33331 15.1 6.31665 13.1667 9.99998 13.1667C13.6833 13.1667 16.6666 15.1 16.6666 17.5" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconHeart = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.3666 3.84172C16.941 3.41589 16.4355 3.0781 15.8794 2.84768C15.3234 2.61725 14.7275 2.49878 14.1258 2.49878C13.524 2.49878 12.9282 2.61725 12.3721 2.84768C11.816 3.0781 11.3105 3.41589 10.885 3.84172L9.99997 4.72672L9.11497 3.84172C8.25538 2.98213 7.08833 2.49922 5.87247 2.49922C4.65661 2.49922 3.48956 2.98213 2.62997 3.84172C1.77038 4.70131 1.28747 5.86836 1.28747 7.08422C1.28747 8.30008 1.77038 9.46713 2.62997 10.3267L9.99997 17.6967L17.37 10.3267C17.7958 9.90117 18.1336 9.39568 18.364 8.83957C18.5944 8.28347 18.7129 7.68761 18.7129 7.08588C18.7129 6.48415 18.5944 5.88829 18.364 5.33218C18.1336 4.77608 17.7958 4.27059 17.37 3.84505L17.3666 3.84172Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconZap = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.8333 2.5L3.33331 11.6667H9.99998L9.16665 17.5L16.6666 8.33333H9.99998L10.8333 2.5Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconShieldCheck = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.6666 10.8335C16.6666 15.0002 13.75 17.0835 10.2833 18.2919C10.1018 18.3534 9.90459 18.3505 9.72498 18.2835C6.24998 17.0835 3.33331 15.0002 3.33331 10.8335V5.00021C3.33331 4.7792 3.42111 4.56724 3.57739 4.41096C3.73367 4.25468 3.94563 4.16688 4.16665 4.16688C5.83331 4.16688 7.91665 3.16688 9.36665 1.90021C9.54319 1.74938 9.76777 1.6665 9.99998 1.6665C10.2322 1.6665 10.4568 1.74938 10.6333 1.90021C12.0916 3.17521 14.1666 4.16688 15.8333 4.16688C16.0543 4.16688 16.2663 4.25468 16.4226 4.41096C16.5788 4.56724 16.6666 4.7792 16.6666 5.00021V10.8335Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 10.0002L9.16667 11.6668L12.5 8.3335" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.1667 17.5V15.8333C14.1667 14.9493 13.8155 14.1014 13.1904 13.4763C12.5653 12.8512 11.7174 12.5 10.8333 12.5H4.16667C3.28261 12.5 2.43477 12.8512 1.80964 13.4763C1.18452 14.1014 0.833336 14.9493 0.833336 15.8333V17.5" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 9.16667C9.34095 9.16667 10.8333 7.67428 10.8333 5.83333C10.8333 3.99238 9.34095 2.5 7.5 2.5C5.65905 2.5 4.16667 3.99238 4.16667 5.83333C4.16667 7.67428 5.65905 9.16667 7.5 9.16667Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19.1667 17.5V15.8333C19.1661 15.0948 18.9203 14.3773 18.4678 13.7936C18.0153 13.2099 17.3818 12.793 16.6667 12.6083" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13.3333 2.60834C14.0503 2.79192 14.6859 3.20892 15.1397 3.79359C15.5935 4.37827 15.8398 5.09736 15.8398 5.8375C15.8398 6.57764 15.5935 7.29673 15.1397 7.88141C14.6859 8.46608 14.0503 8.88308 13.3333 9.06667" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const values = [
  {
    icon: IconShield,
    title: 'Trust first.',
    description: 'We built a platform where transparency, safety, and reliability come before everything else.'
  },
  {
    icon: IconUser,
    title: 'Opportunity for everyone.',
    description: "Whether you're a local pro or a digital expert, Gigspace gives you a fair shot to earn what you're worth."
  },
  {
    icon: IconHeart,
    title: 'Every interaction matters.',
    description: 'We treat every project and connection with care—because real people depend on the work done here.'
  },
  {
    icon: IconZap,
    title: 'Simplicity wins.',
    description: 'From posting a service to hiring a pro, every step is designed to be fast, intuitive, and frustration-free.'
  },
  {
    icon: IconShieldCheck,
    title: 'Fairness & transparency.',
    description: "We're honest with our pricing, our policies, and our promises — no hidden fees, no surprises."
  },
  {
    icon: IconUsers,
    title: 'Strength in community.',
    description: "We're building a space where pros and customers succeed together."
  },
];

const AboutUs = () => {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">

      {/* Shared starry background wrapper: header + hero */}
      <div className="relative flex flex-col">
        <StarryBackground />

        {/* Header */}
        <header className="relative z-10 w-full px-4 md:px-6 lg:px-12 h-16 flex justify-between items-center">
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
        <section className="flex flex-col items-center justify-center pt-10 md:pt-20 pb-16 md:pb-24 px-4 text-center relative w-full">
          <div className="relative z-10 flex flex-col items-center max-w-4xl mx-auto">
            <div className="inline-block border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-6 md:mb-8 tracking-wide">
              About Us
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold gradient-heading mb-4 md:mb-6 leading-tight tracking-tight">
              Changing the way people<br />work together
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              From home services to digital work, Gigspace brings people together to collaborate, create, and accomplish any project big or small.
            </p>
          </div>
        </section>
      </div>

      {/* Mission & Stats Section */}
      <section className="px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Mission */}
          <div>
            <h2 className="text-3xl font-bold gradient-heading mb-8">Our mission</h2>
            <div className="space-y-6 text-slate-400 leading-relaxed text-[15px]">
              <p>
                At Gigspace, our mission is to connect independent professionals with the people and businesses who need them—whether it's parents on home projects, entrepreneurs, or small businesses, we empower sellers to work independently, securely, and freely. Because when local experts thrive, so do their communities.
              </p>
              <p>
                Current platforms suffer from high fees, limited support, and a lack of local reach. Gigspace aims to fix that. We're building a marketplace that works for freelancers, completely removing platform fees locally so that professionals can focus on what they do best and buyers can get their work done with confidence.
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
            src="/Gigspace office.jpg"
            alt="Gigspace office"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-center"
          />
        </div>
      </section>

      {/* About Us Values */}
      <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto w-full border-b border-slate-800/80 mb-8">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-bold gradient-heading mb-4">About Us</h2>
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
                  <p className="text-slate-300 text-base leading-relaxed">
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
        <h2 className="text-3xl md:text-4xl font-bold gradient-heading mb-10 leading-tight">
          Gigspace makes it easier to hire, sell,<br />
          and get things done faster.
        </h2>

        <Link to="/signup" className="inline-flex items-center px-5 py-2 text-sm bg-white text-background font-semibold rounded-full hover:bg-slate-200 transition-colors">
          Get started for free <ArrowRight className="w-4 h-4 ml-2 text-blue-500" />
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
