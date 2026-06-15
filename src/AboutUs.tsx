import { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';
import StarryBackground from './StarryBackground';

const IconTrust = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#iau_trust)">
      <path d="M16.6666 10.8335C16.6666 15.0002 13.7499 17.0835 10.2833 18.2919C10.1017 18.3534 9.90453 18.3505 9.72492 18.2835C6.24992 17.0835 3.33325 15.0002 3.33325 10.8335V5.00021C3.33325 4.7792 3.42105 4.56724 3.57733 4.41096C3.73361 4.25468 3.94557 4.16688 4.16659 4.16688C5.83325 4.16688 7.91658 3.16688 9.36658 1.90021C9.54313 1.74938 9.76771 1.6665 9.99992 1.6665C10.2321 1.6665 10.4567 1.74938 10.6333 1.90021C12.0916 3.17521 14.1666 4.16688 15.8333 4.16688C16.0543 4.16688 16.2662 4.25468 16.4225 4.41096C16.5788 4.56724 16.6666 4.7792 16.6666 5.00021V10.8335Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 10.0002L9.16667 11.6668L12.5 8.3335" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="iau_trust"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);

const IconSimplicity = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#iau_simp)">
      <path d="M5.83325 8.3335H14.1666" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83325 11.6665H14.1666" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.0001 18.3332C14.6025 18.3332 18.3334 14.6022 18.3334 9.99984C18.3334 5.39746 14.6025 1.6665 10.0001 1.6665C5.39771 1.6665 1.66675 5.39746 1.66675 9.99984C1.66675 14.6022 5.39771 18.3332 10.0001 18.3332Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="iau_simp"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);

const IconOpportunity = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.66675 7.91662C1.66677 6.98929 1.94808 6.08377 2.47353 5.31967C2.99898 4.55557 3.74385 3.96883 4.60976 3.63695C5.47567 3.30507 6.42188 3.24366 7.32343 3.46082C8.22497 3.67799 9.03944 4.16352 9.65925 4.85329C9.7029 4.89996 9.75568 4.93718 9.81431 4.96262C9.87294 4.98806 9.93617 5.00119 10.0001 5.00119C10.064 5.00119 10.1272 4.98806 10.1859 4.96262C10.2445 4.93718 10.2973 4.89996 10.3409 4.85329C10.9588 4.15904 11.7734 3.66943 12.6764 3.44962C13.5795 3.22982 14.528 3.29024 15.3958 3.62286C16.2636 3.95547 17.0096 4.5445 17.5343 5.31154C18.0591 6.07858 18.3378 6.98725 18.3334 7.91662C18.3334 9.82495 17.0834 11.25 15.8334 12.5L11.2567 16.9275C11.1015 17.1058 10.91 17.249 10.6951 17.3477C10.4802 17.4464 10.2468 17.4982 10.0103 17.4997C9.77386 17.5012 9.53979 17.4523 9.32365 17.3564C9.10752 17.2605 8.91427 17.1196 8.75675 16.9433L4.16675 12.5C2.91675 11.25 1.66675 9.83329 1.66675 7.91662Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconFairness = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#iau_fair)">
      <path d="M10.0001 18.3332C14.6025 18.3332 18.3334 14.6022 18.3334 9.99984C18.3334 5.39746 14.6025 1.6665 10.0001 1.6665C5.39771 1.6665 1.66675 5.39746 1.66675 9.99984C1.66675 14.6022 5.39771 18.3332 10.0001 18.3332Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.66675 11.6665C6.66675 11.6665 7.91675 13.3332 10.0001 13.3332C12.0834 13.3332 13.3334 11.6665 13.3334 11.6665" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 7.5H7.50833" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 7.5H12.5083" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="iau_fair"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);

const IconInteraction = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.16675 14.1668L10.8334 15.8335C10.9976 15.9976 11.1924 16.1279 11.4069 16.2167C11.6214 16.3055 11.8513 16.3513 12.0834 16.3513C12.3156 16.3513 12.5454 16.3055 12.7599 16.2167C12.9744 16.1279 13.1693 15.9976 13.3334 15.8335C13.4976 15.6693 13.6278 15.4745 13.7166 15.26C13.8055 15.0455 13.8512 14.8156 13.8512 14.5835C13.8512 14.3513 13.8055 14.1215 13.7166 13.907C13.6278 13.6925 13.4976 13.4976 13.3334 13.3335" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11.6666 11.6666L13.7499 13.7499C14.0815 14.0815 14.5311 14.2677 14.9999 14.2677C15.4688 14.2677 15.9184 14.0815 16.2499 13.7499C16.5815 13.4184 16.7677 12.9688 16.7677 12.4999C16.7677 12.0311 16.5815 11.5815 16.2499 11.2499L13.0166 8.0166C12.5479 7.54843 11.9124 7.28546 11.2499 7.28546C10.5874 7.28546 9.95203 7.54843 9.48328 8.0166L8.74994 8.74993C8.41842 9.08145 7.96879 9.2677 7.49994 9.2677C7.0311 9.2677 6.58147 9.08145 6.24994 8.74993C5.91842 8.41841 5.73218 7.96877 5.73218 7.49993C5.73218 7.03109 5.91842 6.58145 6.24994 6.24993L8.59161 3.90826C9.35181 3.15005 10.3432 2.66706 11.4088 2.53574C12.4744 2.40443 13.5534 2.63229 14.4749 3.18326L14.8666 3.4166C15.2214 3.63075 15.6433 3.70503 16.0499 3.62493L17.4999 3.33326" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17.5001 2.5L18.3334 11.6667H16.6667" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2.50008 2.5L1.66675 11.6667L7.08341 17.0833C7.41494 17.4149 7.86457 17.6011 8.33341 17.6011C8.80226 17.6011 9.25189 17.4149 9.58341 17.0833C9.91494 16.7518 10.1012 16.3022 10.1012 15.8333C10.1012 15.3645 9.91494 14.9149 9.58341 14.5833" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2.5 3.3335H9.16667" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconCommunity = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.0001 17.5002C15.0001 15.7321 14.2977 14.0364 13.0475 12.7861C11.7972 11.5359 10.1015 10.8335 8.33341 10.8335C6.5653 10.8335 4.86961 11.5359 3.61937 12.7861C2.36913 14.0364 1.66675 15.7321 1.66675 17.5002" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.33341 10.8333C10.6346 10.8333 12.5001 8.96785 12.5001 6.66667C12.5001 4.36548 10.6346 2.5 8.33341 2.5C6.03223 2.5 4.16675 4.36548 4.16675 6.66667C4.16675 8.96785 6.03223 10.8333 8.33341 10.8333Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.3333 16.6668C18.3333 13.8585 16.6667 11.2502 15 10.0002C15.5478 9.58914 15.9859 9.0494 16.2755 8.42872C16.565 7.80804 16.6971 7.12555 16.66 6.44166C16.6229 5.75777 16.4178 5.09357 16.0629 4.50783C15.7079 3.92209 15.2141 3.43288 14.625 3.0835" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const values = [
  {
    icon: IconTrust,
    title: 'Trust first.',
    description: 'We built a platform where transparency, safety, and reliability come before everything else.'
  },
  {
    icon: IconFairness,
    title: 'Simplicity wins.',
    description: 'From posting a service to hiring a pro, every step is designed to be fast, intuitive, and frustration-free.'
  },
  {
    icon: IconSimplicity,
    title: 'Opportunity for everyone.',
    description: "Whether you're a local pro or a digital expert, Gigspace gives you a fair shot to earn what you're worth."
  },
  {
    icon: IconInteraction,
    title: 'Fairness & transparency.',
    description: "We're honest with our pricing, our policies, and our promises — no hidden fees, no surprises."
  },
  {
    icon: IconOpportunity,
    title: 'Every interaction matters.',
    description: 'We treat every project and connection with care—because real people depend on the work done here.'
  },
  {
    icon: IconCommunity,
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
                <Link to="/signin" className="text-slate-300 hover:text-white transition-colors">Log in</Link>
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

          {/* Mobile dropdown */}
          {menuOpen && (
            <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-t border-slate-700/50 shadow-xl z-50 px-6 py-4 flex flex-col space-y-4 text-sm font-medium">
              {user ? (
                <HeaderUserMenu />
              ) : (
                <>
                  <Link to="/signin" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMenuOpen(false)}>Log in</Link>
                  <Link to="/signup" className="flex items-center justify-center text-slate-300 hover:text-white px-4 py-3 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors" onClick={() => setMenuOpen(false)}>
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
                At Gigspace, our mission is to connect talented professionals with the people and businesses who need them—whether it's a hands-on home project, a virtual task, or anything in between. We empower sellers to turn their skills into income, while giving buyers a simple, reliable, and transparent way to hire the right pro for the job.
              </p>
              <p>
                By combining the flexibility of digital freelance platforms with the reach of local service marketplaces, we make hiring faster, safer, and more efficient for everyone. Our platform is built to remove unnecessary fees, streamline communication, and provide secure transactions, so professionals can focus on what they do best and buyers can get their work done with confidence.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col justify-start space-y-10 lg:pl-32 lg:pt-[68px]">
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
      <section className="px-6 lg:px-12 py-16 max-w-7xl mx-auto w-full mb-8">
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
        <p>© Gigspace, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AboutUs;
