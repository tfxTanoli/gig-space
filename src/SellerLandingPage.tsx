import { useState } from 'react';
import { ArrowRight, PenTool, MessageSquare, CreditCard, ChevronDown, CheckCircle2 } from 'lucide-react';
import LocationIcon from './LocationIcon';
import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Post in 5 minutes or less.',
    description: 'Create a free front page profile. Showcase photos, add a video, and list your prices.'
  },
  {
    title: 'Custom pricing.',
    description: "Set multiple package levels or a basic hourly rate so there's an option for everyone's budget."
  },
  {
    title: 'Real-time messaging.',
    description: 'Chat instantly and exchange files right from your inbox before accepting new jobs.'
  },
  {
    title: 'Secure escrow payments.',
    description: 'Stop chasing down clients for your hard-earned cash. We guarantee payment upfront so you are protected.'
  },
  {
    title: 'No phantom booking.',
    description: "We don't take a percentage from sellers like other platforms. The full price you set is what you earn."
  },
  {
    title: 'Performance insights.',
    description: 'Track views, clicks, and earnings inside your seller dashboard to see how to boost your growth.'
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

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-6 lg:px-12 flex justify-between items-center">
        <div className="flex items-center">
          <LocationIcon className="w-6 h-6 mr-1" />
          <span className="text-xl font-bold tracking-tight text-white">igspace</span>
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link to="/" className="text-white hover:text-slate-300 transition-colors">For Buyers</Link>
          <Link to="/signin" className="text-white hover:text-slate-300 transition-colors">Log in</Link>
          <Link to="/signup" className="flex items-center text-white px-4 py-2 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors">
            Sign up <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center pt-24 pb-20 px-4 text-center">
        <div className="inline-flex flex-row items-center bg-[#1A2035] text-white border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold mb-8 space-x-2">
          <span>✨</span>
          <span>A global marketplace for talent</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight leading-tight max-w-4xl mx-auto">
          Get Discovered. Get Hired.<br/>Get Paid.
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Reach thousands of buyers searching for local and remote gigs.<br className="hidden md:block" />
          Turn your skills into a booming business without the guesswork.
        </p>

        <Link to="/signup" className="inline-flex flex-row items-center bg-white hover:bg-slate-200 text-[#0E1422] font-semibold py-3 px-6 rounded-full transition-colors">
          Become a Seller <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </section>

      {/* How it works */}
      <section className="px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-bold text-white mb-4">How it works</h2>
          <p className="text-slate-400 leading-relaxed">
            Gigspace makes running your own business easy. We handle the tools, the marketing, the invoicing, and payments so you can spend your time doing the work you love.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="flex flex-col items-start bg-transparent">
            <div className="bg-primary/20 p-3 rounded-lg border border-primary/30 mb-6">
              <PenTool className="text-primary w-6 h-6" />
            </div>
            <h3 className="text-white font-bold mb-3">1. Create a post</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Sign up for free, create your first post, and start showcasing your skills to a growing audience.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Create your first post <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="flex flex-col items-start bg-transparent">
            <div className="bg-primary/20 p-3 rounded-lg border border-primary/30 mb-6">
              <MessageSquare className="text-primary w-6 h-6" />
            </div>
            <h3 className="text-white font-bold mb-3">2. Deliver excellent work</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Get order notifications, chat with customers, and track everything via your dashboard.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Explore features <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="flex flex-col items-start bg-transparent">
            <div className="bg-primary/20 p-3 rounded-lg border border-primary/30 mb-6">
              <CreditCard className="text-primary w-6 h-6" />
            </div>
            <h3 className="text-white font-bold mb-3">3. Get paid</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Accept payments directly through Stripe and funds remit to your bank account.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Start selling now <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="px-6 lg:px-12 py-24 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl font-bold text-white mb-6">Our mission</h2>
            <div className="space-y-6 text-slate-400 leading-relaxed text-[15px]">
              <p>
                At Gigspace, our mission is to connect independent professionals with the people and businesses who need them—whether it's parents on home projects, entrepreneurs, or small businesses, we empower sellers to work independently, securely, and freely. Because when local experts thrive, so do their communities.
              </p>
              <p>
                Current platforms suffer from high fees, limited support, and a lack of local reach. Gigspace aims to fix that. We're building a marketplace that works for freelancers, completely removing platform fees locally so that professionals can focus on what they do best and buyers can get their work done with confidence.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col justify-center space-y-10 lg:pl-12">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">$1.95 trillion</div>
              <div className="text-slate-500 text-sm">Freelance GDP in the US annually</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">62%</div>
              <div className="text-slate-500 text-sm">Proportion of gen-Z working independent</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">$5 - $100K</div>
              <div className="text-slate-500 text-sm">Price range sellers can earn</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-12 py-24 border-t border-slate-800/80 max-w-7xl mx-auto w-full">
        <div className="mb-16 max-w-2xl">
          <span className="text-primary text-xs font-bold tracking-widest uppercase block mb-3">
            Finally, a marketplace built for sellers
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            A better way to sell your services
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            We remove the limits of traditional freelance platforms by giving you control and flexibility to scale your business on your terms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
          {features.map((feature, i) => (
            <div key={i} className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div className="ml-4">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white mr-1">{feature.title}</span> 
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-12 py-24 border-t border-slate-800/80 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-white mb-10 text-center md:text-left">
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
      <section className="py-24 px-6 text-center border-t border-slate-800/80">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-10 leading-tight">
          Work smarter, not harder.<br />
          Earn more with Gigspace today.
        </h2>
        
        <Link to="/signup" className="inline-flex items-center px-6 py-3 bg-white text-[#0E1422] font-semibold rounded-full hover:bg-slate-200 transition-colors">
          Get started for free <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-6 lg:px-12 text-center text-sm text-slate-500">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 mb-8">
          <Link to="#" className="hover:text-slate-300 transition-colors">About Us</Link>
          <Link to="/for-sellers" className="hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="/" className="hover:text-slate-300 transition-colors">For Buyers</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Affiliate Program</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Terms & Conditions</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
        </div>
        <p>© {new Date().getFullYear()} Gigspace, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default SellerLandingPage;
