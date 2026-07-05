import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Car, Palette, Home, Package, Code2, Wrench, Briefcase, Music, Megaphone, Scale, MapPinHouse, ChevronLeft, ChevronRight, ChevronDown, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ref as dbRef, get } from 'firebase/database';
import Logo from './Logo';
import { database } from './firebase';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';
import StarryBackground from './StarryBackground';

// Reads admin-managed FAQs from the CMS, falling back to the provided defaults.
function useCmsFaqs(defaults: { question: string; answer: string }[]) {
  const [faqs, setFaqs] = useState(defaults);
  useEffect(() => {
    get(dbRef(database, 'cms/faqs')).then((snap) => {
      const v = snap.val();
      if (v && typeof v === 'object') {
        const list = Object.values(v as Record<string, { question?: string; answer?: string }>)
          .filter((f) => f?.question && f?.answer)
          .map((f) => ({ question: String(f.question), answer: String(f.answer) }));
        if (list.length) setFaqs(list);
      }
    }).catch(() => {});
  }, []);
  return faqs;
}

const AffStepIcon1 = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2B7FFF"/>
    <path d="M19.0174 10.8125C19.0603 10.5831 19.182 10.3759 19.3615 10.2268C19.5411 10.0777 19.7671 9.99609 20.0004 9.99609C20.2338 9.99609 20.4598 10.0777 20.6393 10.2268C20.8189 10.3759 20.9406 10.5831 20.9834 10.8125L22.0344 16.3705C22.1091 16.7656 22.3011 17.1291 22.5855 17.4135C22.8698 17.6978 23.2333 17.8898 23.6284 17.9645L29.1864 19.0155C29.4158 19.0583 29.623 19.1801 29.7721 19.3596C29.9212 19.5391 30.0028 19.7651 30.0028 19.9985C30.0028 20.2319 29.9212 20.4579 29.7721 20.6374C29.623 20.8169 29.4158 20.9386 29.1864 20.9815L23.6284 22.0325C23.2333 22.1071 22.8698 22.2992 22.5855 22.5835C22.3011 22.8679 22.1091 23.2313 22.0344 23.6265L20.9834 29.1845C20.9406 29.4139 20.8189 29.6211 20.6393 29.7702C20.4598 29.9193 20.2338 30.0009 20.0004 30.0009C19.7671 30.0009 19.5411 29.9193 19.3615 29.7702C19.182 29.6211 19.0603 29.4139 19.0174 29.1845L17.9664 23.6265C17.8918 23.2313 17.6998 22.8679 17.4154 22.5835C17.1311 22.2992 16.7676 22.1071 16.3724 22.0325L10.8144 20.9815C10.585 20.9386 10.3779 20.8169 10.2288 20.6374C10.0797 20.4579 9.99805 20.2319 9.99805 19.9985C9.99805 19.7651 10.0797 19.5391 10.2288 19.3596C10.3779 19.1801 10.585 19.0583 10.8144 19.0155L16.3724 17.9645C16.7676 17.8898 17.1311 17.6978 17.4154 17.4135C17.6998 17.1291 17.8918 16.7656 17.9664 16.3705L19.0174 10.8125Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M28 10V14" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M30 12H26" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 30C13.1046 30 14 29.1046 14 28C14 26.8954 13.1046 26 12 26C10.8954 26 10 26.8954 10 28C10 29.1046 10.8954 30 12 30Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AffStepIcon2 = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2B7FFF"/>
    <path d="M26 16C27.6569 16 29 14.6569 29 13C29 11.3431 27.6569 10 26 10C24.3431 10 23 11.3431 23 13C23 14.6569 24.3431 16 26 16Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 23C15.6569 23 17 21.6569 17 20C17 18.3431 15.6569 17 14 17C12.3431 17 11 18.3431 11 20C11 21.6569 12.3431 23 14 23Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M26 30C27.6569 30 29 28.6569 29 27C29 25.3431 27.6569 24 26 24C24.3431 24 23 25.3431 23 27C23 28.6569 24.3431 30 26 30Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5898 21.5117L23.4198 25.4917" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M23.4098 14.5117L16.5898 18.4917" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WalletIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 7V4C19 3.73478 18.8946 3.48043 18.7071 3.29289C18.5196 3.10536 18.2652 3 18 3H5C4.46957 3 3.96086 3.21071 3.58579 3.58579C3.21071 3.96086 3 4.46957 3 5C3 5.53043 3.21071 6.03914 3.58579 6.41421C3.96086 6.78929 4.46957 7 5 7H20C20.2652 7 20.5196 7.10536 20.7071 7.29289C20.8946 7.48043 21 7.73478 21 8V12M21 12H18C17.4696 12 16.9609 12.2107 16.5858 12.5858C16.2107 12.9609 16 13.4696 16 14C16 14.5304 16.2107 15.0391 16.5858 15.4142C16.9609 15.7893 17.4696 16 18 16H21C21.2652 16 21.5196 15.8946 21.7071 15.7071C21.8946 15.5196 22 15.2652 22 15V13C22 12.7348 21.8946 12.4804 21.7071 12.2929C21.5196 12.1054 21.2652 12 21 12Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 5V19C3 19.5304 3.21071 20.0391 3.58579 20.4142C3.96086 20.7893 4.46957 21 5 21H20C20.2652 21 20.5196 20.8946 20.7071 20.7071C20.8946 20.5196 21 20.2652 21 20V16" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EarnIcon1 = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2B7FFF"/>
    <path d="M22.7005 14.2998C22.5172 14.4867 22.4146 14.738 22.4146 14.9998C22.4146 15.2615 22.5172 15.5129 22.7005 15.6998L24.3005 17.2998C24.4874 17.483 24.7387 17.5856 25.0005 17.5856C25.2622 17.5856 25.5135 17.483 25.7005 17.2998L28.8065 14.1948C29.1265 13.8728 29.6695 13.9748 29.7895 14.4128C30.0916 15.5117 30.0745 16.6739 29.7402 17.7634C29.406 18.8529 28.7683 19.8247 27.9019 20.565C27.0354 21.3054 25.9761 21.7836 24.8477 21.9439C23.7194 22.1041 22.5688 21.9396 21.5305 21.4698L13.6205 29.3798C13.2226 29.7775 12.6831 30.0008 12.1206 30.0008C11.5581 30.0007 11.0187 29.7771 10.621 29.3793C10.2233 28.9815 9.99991 28.4419 10 27.8794C10.0001 27.3169 10.2236 26.7775 10.6215 26.3798L18.5315 18.4698C18.0616 17.4315 17.8972 16.2809 18.0574 15.1525C18.2176 14.0242 18.6959 12.9648 19.4362 12.0984C20.1766 11.232 21.1484 10.5943 22.2379 10.2601C23.3274 9.92583 24.4896 9.90873 25.5885 10.2108L22.7005 14.2998Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EarnIcon2 = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2B7FFF"/>
    <path d="M22.9991 20L13.6261 29.373C13.4291 29.57 13.1952 29.7264 12.9378 29.833C12.6804 29.9397 12.4046 29.9946 12.1259 29.9947C11.5632 29.9948 11.0235 29.7713 10.6256 29.3735C10.2276 28.9757 10.004 28.4361 10.0039 27.8734C10.0038 27.3107 10.2273 26.771 10.6251 26.373L19.9991 17" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M26 23L30 19" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M29.5 19.5L27.586 17.586C27.2109 17.211 27.0001 16.7024 27 16.172V15.828C26.9999 15.2976 26.7891 14.789 26.414 14.414L24.757 12.757C23.6321 11.6323 22.1067 11.0003 20.516 11H17L18.243 12.243C19.3679 13.3681 19.9999 14.894 20 16.485V18L22 20H23.172C23.7024 20.0001 24.211 20.2109 24.586 20.586L26.5 22.5" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EarnIcon3 = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 21V13C15 12.7348 14.8946 12.4804 14.7071 12.2929C14.5196 12.1054 14.2652 12 14 12H10C9.73478 12 9.48043 12.1054 9.29289 12.2929C9.10536 12.4804 9 12.7348 9 13V21" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 10.0005C2.99993 9.70955 3.06333 9.4221 3.18579 9.1582C3.30824 8.89429 3.4868 8.66028 3.709 8.47248L10.709 2.47248C11.07 2.16739 11.5274 2 12 2C12.4726 2 12.93 2.16739 13.291 2.47248L20.291 8.47248C20.5132 8.66028 20.6918 8.89429 20.8142 9.1582C20.9367 9.4221 21.0001 9.70955 21 10.0005V19.0005C21 19.5309 20.7893 20.0396 20.4142 20.4147C20.0391 20.7898 19.5304 21.0005 19 21.0005H5C4.46957 21.0005 3.96086 20.7898 3.58579 20.4147C3.21071 20.0396 3 19.5309 3 19.0005V10.0005Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EarnIcon4 = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2B7FFF"/>
    <path d="M20 18H20.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 22H20.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 14H20.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24 18H24.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24 22H24.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24 14H24.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 18H16.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 22H16.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 14H16.01" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 30V27C17 26.7348 17.1054 26.4804 17.2929 26.2929C17.4804 26.1054 17.7348 26 18 26H22C22.2652 26 22.5196 26.1054 22.7071 26.2929C22.8946 26.4804 23 26.7348 23 27V30" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M26 10H14C12.8954 10 12 10.8954 12 12V28C12 29.1046 12.8954 30 14 30H26C27.1046 30 28 29.1046 28 28V12C28 10.8954 27.1046 10 26 10Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const earnIconComponents = [
  <div className="mb-5"><EarnIcon1 /></div>,
  <div className="mb-5"><EarnIcon2 /></div>,
  <div className="p-3 bg-[#2B7FFF] rounded-lg w-fit mb-5"><EarnIcon3 /></div>,
  <div className="mb-5"><EarnIcon4 /></div>,
];

const DEFAULT_FAQS = [
  {
    question: 'Who can become a Gigspace affiliate?',
    answer: 'Anyone can become a Gigspace affiliate. Whether you\'re a content creator, blogger, business owner, or just someone with a network, you can earn commissions by referring new clients to Gigspace.',
  },
  {
    question: 'Do I need to be a Gigspace customer?',
    answer: 'No, you don\'t need to be a Gigspace customer to join the affiliate program. Simply sign up for a free affiliate account and start sharing your unique referral link.',
  },
  {
    question: 'How do I join the program?',
    answer: 'Click the "Become an Affiliate" button, create your free account, and you\'ll get instant access to your unique referral link and a real-time tracking dashboard.',
  },
  {
    question: 'What promotion methods are accepted?',
    answer: 'You can promote Gigspace through social media, blogs, email newsletters, YouTube, podcasts, or any platform where you have an audience. Spam and misleading promotions are not permitted.',
  },
  {
    question: 'How do I track my referrals?',
    answer: 'Your affiliate dashboard provides real-time tracking of clicks, referrals, and earnings so you can see exactly how your link is performing at all times.',
  },
  {
    question: 'How do I get paid?',
    answer: 'Commissions are paid out once the referred job is completed and payment is released. You can withdraw your earnings directly to your bank account.',
  },
];

const earningsCards = [
  { label: 'Small Job', service: '$100 local repair job', commission: '+ $5 commission', emoji: '🔥' },
  { label: 'Medium Job', service: '$1,000 home service project', commission: '+ $50 commission', emoji: '⚡' },
  { label: 'High-Ticket Job', service: '$10,000 renovation project', commission: '+ $500 commission', emoji: '🌟' },
  { label: 'Large Project (top-end example)', service: '$100,000 commercial contract', commission: '+ $5,000 commission', emoji: '💰' },
];

const categories = [
  { name: 'Automotive', Icon: Car },
  { name: 'Graphics & Design', Icon: Palette },
  { name: 'Home & Garden', Icon: Home },
  { name: 'Labor & Moving', Icon: Package },
  { name: 'Programming & Tech', Icon: Code2 },
  { name: 'Skilled Trade', Icon: Wrench },
  { name: 'Business', Icon: Briefcase },
  { name: 'Lessons', Icon: Music },
  { name: 'Marketing', Icon: Megaphone },
  { name: 'Legal', Icon: Scale },
  { name: 'Real Estate', Icon: MapPinHouse },
];

const AffiliateLanding = () => {
  const { user, loading } = useAuth();
  const faqs = useCmsFaqs(DEFAULT_FAQS);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const catScrollRef = useRef<HTMLDivElement>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const scrollCats = (dir: 'left' | 'right') =>
    catScrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });

  const ctaHref = user ? '/affiliate-dashboard' : '/signup?next=/affiliate-dashboard';
  const ctaLabel = user ? 'Go to Dashboard' : 'Become an Affiliate';

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">

      {/* Shared starry background wrapper: header + hero */}
      <div className="relative flex flex-col">
        <StarryBackground />

        {/* Header */}
        <header className="relative z-10 w-full px-4 md:px-6 lg:px-12 h-16 flex justify-between items-center">
          <Logo className="h-6" />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium">
            {!loading && (
              user ? (
                <HeaderUserMenu />
              ) : (
                <>
                  <Link to="/signin?next=/affiliate-dashboard" className="text-slate-300 hover:text-white transition-colors">
                    Affiliate Log In
                  </Link>
                  <Link
                    to="/signup?next=/affiliate-dashboard"
                    className="flex items-center text-slate-300 hover:text-white px-4 py-2 border border-slate-600 rounded-full hover:bg-slate-800 transition-colors"
                  >
                    Become an Affiliate <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </>
              )
            )}
          </nav>

          {/* Mobile: avatar + dropdown when logged in, hamburger nav otherwise */}
          {user ? (
            <div className="lg:hidden">
              <HeaderUserMenu />
            </div>
          ) : (
            <>
              <button
                className="lg:hidden text-white p-2 rounded-md hover:bg-slate-800 transition-colors"
                onClick={() => setMenuOpen(prev => !prev)}
                aria-label="Toggle menu"
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              {menuOpen && (
                <div className="lg:hidden absolute top-full left-0 right-0 bg-background border-t border-slate-700/50 shadow-xl z-50 px-6 py-4 flex flex-col space-y-4 text-sm font-medium">
                  {!loading && (
                    <>
                      <Link to="/signin?next=/affiliate-dashboard" className="text-slate-300 hover:text-white transition-colors py-2" onClick={() => setMenuOpen(false)}>
                        Affiliate Log In
                      </Link>
                      <Link
                        to="/signup?next=/affiliate-dashboard"
                        className="flex items-center justify-center text-slate-300 hover:text-white px-4 py-3 border border-slate-600 rounded-full hover:bg-slate-800 transition-colors"
                        onClick={() => setMenuOpen(false)}
                      >
                        Become an Affiliate <ArrowRight className="ml-2 w-4 h-4" />
                      </Link>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center justify-center pt-10 md:pt-20 pb-16 md:pb-28 px-4 text-center relative">
          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-6 md:mb-8">The Gigspace affiliate program is now live!</div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold gradient-heading mb-4 md:mb-6 tracking-tight leading-tight max-w-4xl mx-auto">
              Earn Big Commissions for<br />Every Job Booked
            </h1>
            <p className="text-slate-300 text-sm md:text-lg max-w-xl mx-auto mb-8 md:mb-10 leading-relaxed">
              Get paid every time someone hires a service through your link.<br />
              Earn 50% of our platform fee on every completed job.
            </p>
            <Link
              to={ctaHref}
              className="inline-flex items-center px-5 py-2 text-sm bg-white text-background font-semibold rounded-full hover:bg-slate-200 transition-colors"
            >
              {ctaLabel} <ArrowRight className="w-4 h-4 ml-2 text-blue-500" />
            </Link>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <section className="px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-bold gradient-heading mb-4">How it works</h2>
          <p className="text-slate-400 leading-relaxed">
            Sign up in minutes, share your link, and earn commissions every time someone books a service through Gigspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="flex flex-col items-start">
            <div className="mb-6"><AffStepIcon1 /></div>
            <h3 className="text-white font-bold mb-3 text-lg">1. Sign Up as an Affiliate</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Create your free affiliate account in minutes and get instant access to your unique referral link and tracking dashboard.
            </p>
            <Link to={ctaHref} className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Get started for free <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="flex flex-col items-start">
            <div className="mb-6"><AffStepIcon2 /></div>
            <h3 className="text-white font-bold mb-3 text-lg">2. Share Your Link</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Promote Gigspace anywhere — social media, your audience, or direct outreach. Every click and referral is tracked automatically.
            </p>
            <Link to={ctaHref} className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Get your referral link <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="flex flex-col items-start">
            <div className="w-10 h-10 bg-[#2B7FFF] rounded-lg flex items-center justify-center mb-6"><WalletIcon /></div>
            <h3 className="text-white font-bold mb-3 text-lg">3. Get paid</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              When someone books a service through your link, you earn 50% of our platform fee once the job is completed.
            </p>
            <Link to={ctaHref} className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Start getting paid <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Earnings Section */}
      <section className="px-6 lg:px-12 py-24 max-w-7xl mx-auto w-full">
        <div className="mb-16 text-center">
          <span className="inline-block text-primary text-xs font-bold tracking-widest border border-primary/30 bg-primary/10 rounded-full px-4 py-1.5 mb-6">
            Earnings that scale
          </span>
          <h2 className="text-3xl md:text-4xl font-bold gradient-heading mb-4">See What You Can Earn</h2>
          <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
            From small local services to high-ticket contracts, your earnings scale with every referral. Get paid when any service is completed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {earningsCards.map((card, i) => (
            <div key={i} className="bg-surface-raised rounded-xl p-6 border border-slate-700/40">
              {earnIconComponents[i]}
              <p className="text-slate-400 text-sm font-medium mb-1">{card.label}</p>
              <p className="text-white font-medium mb-3">{card.service}</p>
              <p className="text-green-400 font-semibold text-sm">
                {card.commission} {card.emoji}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Service Categories */}
      <section className="px-4 md:px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-xl font-bold gradient-heading">Popular Service Categories</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollCats('left')}
              className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => scrollCats('right')}
              className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div ref={catScrollRef} className="overflow-x-auto scrollbar-hide">
          <div className="flex flex-nowrap gap-6 md:gap-10 pb-2 pt-4">
          {categories.map(({ name, Icon }, i) => (
            <Link
              key={i}
              to={`/search?category=${encodeURIComponent(name)}`}
              className="flex flex-col items-center group cursor-pointer flex-shrink-0 px-2"
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-surface-raised flex items-center justify-center mb-3 transition-transform transform group-hover:scale-105 group-hover:bg-surface-raised-hover">
                <Icon className="w-8 h-8 md:w-10 md:h-10 text-primary" strokeWidth={1.5} />
              </div>
              <span className="text-base font-medium text-slate-300 group-hover:text-white transition-colors whitespace-nowrap">
                {name}
              </span>
            </Link>
          ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-12 py-24 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold gradient-heading mb-10">Frequently asked questions</h2>
        <div>
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
                <p className="text-slate-400 text-sm leading-relaxed pr-8">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
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

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold gradient-heading mb-10 leading-tight">
          Join hundreds of affiliates earning big <span style={{ WebkitTextFillColor: 'initial' }}>💰</span><br />
          with Gigspace
        </h2>
        <Link
          to={ctaHref}
          className="inline-flex items-center px-5 py-2 text-sm bg-white text-background font-semibold rounded-full hover:bg-slate-200 transition-colors"
        >
          {ctaLabel} <ArrowRight className="w-4 h-4 ml-2 text-blue-500" />
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

export default AffiliateLanding;
