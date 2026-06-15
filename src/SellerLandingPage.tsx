import { useState } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import Logo from './Logo';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';
import StarryBackground from './StarryBackground';

const StepIconCreate = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2B7FFF"/>
    <path d="M28 18C28 22.993 22.461 28.193 20.601 29.799C20.4277 29.9293 20.2168 29.9998 20 29.9998C19.7832 29.9998 19.5723 29.9293 19.399 29.799C17.539 28.193 12 22.993 12 18C12 15.8783 12.8429 13.8434 14.3431 12.3431C15.8434 10.8429 17.8783 10 20 10C22.1217 10 24.1566 10.8429 25.6569 12.3431C27.1571 13.8434 28 15.8783 28 18Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 15V21" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 18H23" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const StepIconDeliver = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2B7FFF"/>
    <path d="M29 18.656V27C29 27.5304 28.7893 28.0391 28.4142 28.4142C28.0391 28.7893 27.5304 29 27 29H13C12.4696 29 11.9609 28.7893 11.5858 28.4142C11.2107 28.0391 11 27.5304 11 27V13C11 12.4696 11.2107 11.9609 11.5858 11.5858C11.9609 11.2107 12.4696 11 13 11H25.344" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 19L20 22L30 12" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WalletIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 7V4C19 3.73478 18.8946 3.48043 18.7071 3.29289C18.5196 3.10536 18.2652 3 18 3H5C4.46957 3 3.96086 3.21071 3.58579 3.58579C3.21071 3.96086 3 4.46957 3 5C3 5.53043 3.21071 6.03914 3.58579 6.41421C3.96086 6.78929 4.46957 7 5 7H20C20.2652 7 20.5196 7.10536 20.7071 7.29289C20.8946 7.48043 21 7.73478 21 8V12M21 12H18C17.4696 12 16.9609 12.2107 16.5858 12.5858C16.2107 12.9609 16 13.4696 16 14C16 14.5304 16.2107 15.0391 16.5858 15.4142C16.9609 15.7893 17.4696 16 18 16H21C21.2652 16 21.5196 15.8946 21.7071 15.7071C21.8946 15.5196 22 15.2652 22 15V13C22 12.7348 21.8946 12.4804 21.7071 12.2929C21.5196 12.1054 21.2652 12 21 12Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 5V19C3 19.5304 3.21071 20.0391 3.58579 20.4142C3.96086 20.7893 4.46957 21 5 21H20C20.2652 21 20.5196 20.8946 20.7071 20.7071C20.8946 20.5196 21 20.2652 21 20V16" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

const IconBadgeCheck = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#bc1s)">
      <path d="M3.20833 7.18358C3.0867 6.63568 3.10538 6.06595 3.26263 5.52719C3.41988 4.98844 3.71062 4.49811 4.10789 4.10168C4.50516 3.70524 4.99609 3.41553 5.53517 3.25941C6.07425 3.10328 6.64403 3.0858 7.19167 3.20858C7.49309 2.73716 7.90834 2.34921 8.39913 2.08048C8.88992 1.81175 9.44046 1.6709 10 1.6709C10.5595 1.6709 11.1101 1.81175 11.6009 2.08048C12.0917 2.34921 12.5069 2.73716 12.8083 3.20858C13.3568 3.08526 13.9276 3.10267 14.4675 3.25917C15.0074 3.41568 15.499 3.70619 15.8965 4.10371C16.294 4.50122 16.5846 4.9928 16.7411 5.53275C16.8976 6.07269 16.915 6.64344 16.7917 7.19191C17.2631 7.49334 17.651 7.90858 17.9198 8.39937C18.1885 8.89016 18.3293 9.4407 18.3293 10.0002C18.3293 10.5598 18.1885 11.1103 17.9198 11.6011C17.651 12.0919 17.2631 12.5072 16.7917 12.8086C16.9144 13.3562 16.897 13.926 16.7408 14.4651C16.5847 15.0042 16.295 15.4951 15.8985 15.8924C15.5021 16.2896 15.0118 16.5804 14.473 16.7376C13.9343 16.8949 13.3645 16.9135 12.8166 16.7919C12.5156 17.2651 12.1 17.6547 11.6084 17.9247C11.1168 18.1946 10.565 18.3361 10.0041 18.3361C9.44329 18.3361 8.8915 18.1946 8.39987 17.9247C7.90825 17.6547 7.49268 17.2651 7.19164 16.7919C6.64401 16.9147 6.07423 16.8972 5.53515 16.7411C4.99607 16.585 4.50514 16.2952 4.10787 15.8988C3.7106 15.5024 3.41986 15.012 3.26261 14.4733C3.10536 13.9345 3.08668 13.3648 3.20831 12.8169C2.73327 12.5163 2.34199 12.1004 2.07085 11.6079C1.79971 11.1155 1.65753 10.5624 1.65753 10.0002C1.65753 9.43807 1.79971 8.88503 2.07085 8.39257C2.34199 7.9001 2.73327 7.48421 3.20833 7.18358Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 10L9.16667 11.6667L12.5 8.33333" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="bc1s"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);

const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#ch1s)">
      <path d="M2.4934 13.6174C2.61593 13.9265 2.64321 14.2652 2.57173 14.5899L1.68423 17.3316C1.65564 17.4706 1.66303 17.6147 1.70571 17.75C1.7484 17.8854 1.82495 18.0077 1.92812 18.1052C2.03129 18.2027 2.15766 18.2722 2.29523 18.3071C2.43281 18.3421 2.57704 18.3413 2.71423 18.3049L5.5584 17.4733C5.86483 17.4125 6.18218 17.439 6.47423 17.5499C8.25372 18.3809 10.2695 18.5568 12.166 18.0464C14.0625 17.536 15.7178 16.3721 16.8398 14.7602C17.9618 13.1483 18.4785 11.1919 18.2986 9.23622C18.1188 7.2805 17.254 5.45115 15.8568 4.07092C14.4596 2.6907 12.6198 1.84829 10.6621 1.69234C8.70429 1.53639 6.75435 2.07691 5.15627 3.21854C3.55819 4.36017 2.41468 6.02955 1.92748 7.93212C1.44028 9.8347 1.64071 11.8482 2.4934 13.6174Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="ch1s"><rect width="20" height="20" fill="white"/></clipPath></defs>
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
    <g clipPath="url(#bp1s)">
      <path d="M3.20831 7.18358C3.08668 6.63568 3.10536 6.06595 3.26261 5.52719C3.41986 4.98844 3.7106 4.49811 4.10787 4.10168C4.50514 3.70524 4.99607 3.41553 5.53515 3.25941C6.07423 3.10328 6.64401 3.0858 7.19164 3.20858C7.49307 2.73716 7.90831 2.34921 8.3991 2.08048C8.88989 1.81175 9.44043 1.6709 9.99998 1.6709C10.5595 1.6709 11.1101 1.81175 11.6009 2.08048C12.0916 2.34921 12.5069 2.73716 12.8083 3.20858C13.3568 3.08526 13.9275 3.10267 14.4675 3.25917C15.0074 3.41568 15.499 3.70619 15.8965 4.10371C16.294 4.50122 16.5845 4.9928 16.741 5.53275C16.8976 6.07269 16.915 6.64344 16.7916 7.19191C17.2631 7.49334 17.651 7.90858 17.9197 8.39937C18.1885 8.89016 18.3293 9.4407 18.3293 10.0002C18.3293 10.5598 18.1885 11.1103 17.9197 11.6011C17.651 12.0919 17.2631 12.5072 16.7916 12.8086C16.9144 13.3562 16.8969 13.926 16.7408 14.4651C16.5847 15.0042 16.295 15.4951 15.8985 15.8924C15.5021 16.2896 15.0118 16.5804 14.473 16.7376C13.9343 16.8949 13.3645 16.9135 12.8166 16.7919C12.5156 17.2651 12.1 17.6547 11.6084 17.9247C11.1168 18.1946 10.565 18.3361 10.0041 18.3361C9.44329 18.3361 8.8915 18.1946 8.39987 17.9247C7.90825 17.6547 7.49268 17.2651 7.19164 16.7919C6.64401 16.9147 6.07423 16.8972 5.53515 16.7411C4.99607 16.585 4.50514 16.2952 4.10787 15.8988C3.7106 15.5024 3.41986 15.012 3.26261 14.4733C3.10536 13.9345 3.08668 13.3648 3.20831 12.8169C2.73327 12.5163 2.34199 12.1004 2.07085 11.6079C1.79971 11.1155 1.65753 10.5624 1.65753 10.0002C1.65753 9.43807 1.79971 8.88503 2.07085 8.39257C2.34199 7.9001 2.73327 7.48421 3.20831 7.18358Z" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 7.5L7.5 12.5" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 7.5H7.50833" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 12.5H12.5083" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
    <defs><clipPath id="bp1s"><rect width="20" height="20" fill="white"/></clipPath></defs>
  </svg>
);

const IconBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 14.1667V10.8333" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6.66667 14.1667V5.83333" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10.8333 14.1667V8.33333" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 14.1667V2.5" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1.66667 16.6667H16.6667" stroke="#2B7FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const featureIcons = [IconScreen, IconBadgeCheck, IconChat, IconShieldCheck, IconBadgePercent, IconBarChart];

const features = [
  {
    title: 'Photo & video portfolios.',
    description: 'Show off your best work with clean portfolios that help build trust with buyers.'
  },
  {
    title: 'Custom pricing.',
    description: "Send tailored quotes for each customer's project and charge exactly what your work is worth."
  },
  {
    title: 'Real-time messaging.',
    description: 'Chat instantly with customers to answer questions, confirm details, and close deals without delays.'
  },
  {
    title: 'Secure escrow payments.',
    description: 'Transact with confidence knowing funds are locked in and released when the job is approved.'
  },
  {
    title: 'Fair, low seller fees.',
    description: "Keep more of what you earn with a simple fee structure that's lower than every other marketplace."
  },
  {
    title: 'Performance insights.',
    description: 'Track views, messages, orders, and earnings to see what\'s working and optimize your growth.'
  }
];

const faqs = [
  { question: "What can I sell?", answer: "You can offer any service that falls inside our diverse categories ranging from digital professional services to localized trade work." },
  { question: "How much money can I make?", answer: "Your earning potential is entirely up to you. You set your own prices and determine how much work you want to take on." },
  { question: "How much does it cost?", answer: "Joining and setting up your primary listing is completely free. We charge a flat platform fee on completed orders and optional subscriptions for multiple local reach." },
  { question: "How much time will I need to invest?", answer: "It is highly flexible. You can freelance part-time or scale it to a full-time business. Setup usually takes under 15 minutes." },
  { question: "How do I price my service?", answer: "We recommend reviewing similar services to gauge local/remote market rates. You can always adjust your prices as your profile grows." },
  { question: "How do I get paid?", answer: "Payments are securely held in escrow and released to you upon project approval. You can withdraw directly to your bank account." }
];

const SellerLandingPage = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

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
            <Link to="/" className="text-slate-300 hover:text-white transition-colors">For Buyers</Link>
            <Link to="/affiliate" className="text-slate-300 hover:text-white transition-colors">Become an Affiliate</Link>
            {user ? (
              <HeaderUserMenu />
            ) : (
              <>
                <Link to="/signin?next=/seller-dashboard" className="text-slate-300 hover:text-white transition-colors">Log in</Link>
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
              <Link to="/" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMenuOpen(false)}>For Buyers</Link>
              <Link to="/affiliate" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMenuOpen(false)}>Become an Affiliate</Link>
              {user ? (
                <HeaderUserMenu />
              ) : (
                <>
                  <Link to="/signin?next=/seller-dashboard" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMenuOpen(false)}>Log in</Link>
                  <Link to="/signup" className="flex items-center justify-center text-slate-300 hover:text-white px-4 py-3 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors" onClick={() => setMenuOpen(false)}>
                    Sign up <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          )}
        </header>

        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center pt-12 md:pt-24 pb-16 md:pb-20 px-4 text-center relative">
          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex flex-row items-center bg-surface-raised text-white border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 md:mb-8 space-x-2">
              <span>Stripe integration is now live 💸</span>
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold gradient-heading mb-4 md:mb-6 tracking-tight leading-tight max-w-4xl mx-auto">
              Get Discovered. Get Hired.<br/>Get Paid.
            </h1>
            <p className="text-slate-300 text-sm md:text-lg max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed">
              From home repairs to digital work and everything in between.<br />
              Turn any skill into income and earn doing what you do best.
            </p>

            <Link to="/signup" className="inline-flex flex-row items-center bg-white hover:bg-slate-200 text-background font-semibold py-2 px-5 text-sm rounded-full transition-colors">
              Become a Seller <ArrowRight className="w-4 h-4 ml-2 text-blue-500" />
            </Link>
          </div>
        </section>
      </div>

      {/* How it works */}
      <section className="px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-bold gradient-heading mb-4">How it works</h2>
          <p className="text-slate-400 leading-relaxed">
            Gigspace makes selling your services easy. With simple tools for posting, messaging, and payments, you can scale your business faster than ever.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="flex flex-col items-start bg-transparent">
            <div className="mb-6">
              <StepIconCreate />
            </div>
            <h3 className="text-white font-bold mb-3 text-lg">1. Create a post</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Sign up for free, create your first post, and start showcasing your skills to a growing audience.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Create your first post <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="flex flex-col items-start bg-transparent">
            <div className="mb-6">
              <StepIconDeliver />
            </div>
            <h3 className="text-white font-bold mb-3 text-lg">2. Deliver excellent work</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Get order notifications, chat with customers, and track everything via your dashboard.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Get your first order <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="flex flex-col items-start bg-transparent">
            <div className="w-10 h-10 bg-[#2B7FFF] rounded-lg flex items-center justify-center mb-6">
              <WalletIcon />
            </div>
            <h3 className="text-white font-bold mb-3 text-lg">3. Get paid</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Accept payments directly through Stripe and funds remit to your bank account.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Start getting paid <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl font-bold gradient-heading mb-6">Our mission</h2>
            <div className="space-y-6 text-slate-400 leading-relaxed text-[15px]">
              <p>
                At Gigspace, our mission is to connect talented professionals with the people and businesses who need them—whether it's a hands-on home project, a virtual task, or anything in between. We empower sellers to turn their skills into income, while giving buyers a simple, reliable, and transparent way to hire the right pro for the job.
              </p>
              <p>
                By combining the flexibility of digital freelance platforms with the reach of local service marketplaces, we make hiring faster, safer, and more efficient for everyone. Our platform is built to remove unnecessary fees, streamline communication, and provide secure transactions, so professionals can focus on what they do best and buyers can get their work done with confidence.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-start space-y-10 lg:pl-32 lg:pt-[60px]">
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

      {/* Features */}
      <section className="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full">
        <div className="mb-16 max-w-2xl">
          <span className="text-primary text-xs font-bold tracking-widest block mb-3">
            Finally, a marketplace built for sellers
          </span>
          <h2 className="text-3xl md:text-4xl font-bold gradient-heading mb-6">
            A better way to sell your services
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            We remove the limits of traditional freelance platforms by giving you control and flexibility to scale your business on your terms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
          {features.map((feature, i) => {
            const FeatureIcon = featureIcons[i];
            return (
              <div key={i} className="flex items-start">
                <div className="mt-1 flex-shrink-0">
                  <FeatureIcon />
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

      {/* FAQ */}
      <section className="px-6 lg:px-12 py-24 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold gradient-heading mb-10 text-center md:text-left">
          Frequently asked questions
        </h2>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-slate-800/80 overflow-hidden">
              <button
                onClick={() => toggleFaq(index)}
                className="w-full py-6 flex justify-between items-center text-left focus:outline-none group"
              >
                <span className="font-medium text-white group-hover:text-primary transition-colors pr-8">
                  {faq.question}
                </span>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 flex-shrink-0 ${openFaqIndex === index ? 'rotate-180' : ''}`} />
              </button>
              <div
                className={`transition-all duration-300 ease-in-out ${
                  openFaqIndex === index ? 'max-h-40 opacity-100 pb-6' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-slate-400 text-sm leading-relaxed pr-8">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold gradient-heading mb-10 leading-tight">
          Work smarter, not harder.<br />
          Earn more with Gigspace today.
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

export default SellerLandingPage;
