import { useState } from 'react';
import { ArrowRight, UserPlus, Share2, DollarSign, Car, Palette, Home, Package, Code2, Wrench, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import LocationIcon from './LocationIcon';

const faqs = [
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
  { label: 'Large Project (top-end example)', service: '$100,000 service contract', commission: '+ $5,000 commission', emoji: '💰' },
];

const categories = [
  { name: 'Automotive', Icon: Car },
  { name: 'Graphics & Design', Icon: Palette },
  { name: 'Home & Garden', Icon: Home },
  { name: 'Labor & Moving', Icon: Package },
  { name: 'Programming & Tech', Icon: Code2 },
  { name: 'Skilled Trade', Icon: Wrench },
];

const AffiliateLanding = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col">

      {/* Header */}
      <header className="w-full px-6 py-6 lg:px-12 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <LocationIcon className="w-6 h-6 mr-1" />
          <span className="text-xl font-bold tracking-tight text-white">igspace</span>
        </Link>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link to="/signin" className="text-white hover:text-slate-300 transition-colors">
            Affiliate Log In
          </Link>
          <Link
            to="/signup"
            className="flex items-center text-white px-4 py-2 border border-slate-600 rounded-full hover:bg-slate-800 transition-colors"
          >
            Become an Affiliate <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center pt-20 pb-28 px-4 text-center">
        <p className="text-slate-400 text-sm mb-8">The Gigspace affiliate program is now live!</p>
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-cyan-400 mb-6 tracking-tight leading-tight max-w-4xl mx-auto">
          Earn Big Commissions for<br />Every Job Booked
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Get paid every time someone hires a service through your link.
          Earn 50% of our platform fee on every completed job.
        </p>
        <Link
          to="/signup"
          className="inline-flex items-center px-6 py-3 border border-slate-500 text-white font-semibold rounded-full hover:bg-slate-800 transition-colors"
        >
          Become an Affiliate <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </section>

      {/* How It Works */}
      <section className="px-6 lg:px-12 py-20 max-w-7xl mx-auto w-full">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-bold text-white mb-4">How it works</h2>
          <p className="text-slate-400 leading-relaxed">
            Sign up in minutes, share your link, and earn commissions every time someone books a service through Gigspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="flex flex-col items-start">
            <div className="bg-primary/20 p-3 rounded-lg border border-primary/30 mb-6">
              <UserPlus className="text-primary w-6 h-6" />
            </div>
            <h3 className="text-white font-bold mb-3">1. Sign Up as an Affiliate</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Create your free affiliate account in minutes and get instant access to your unique referral link and tracking dashboard.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Get started for free <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="flex flex-col items-start">
            <div className="bg-primary/20 p-3 rounded-lg border border-primary/30 mb-6">
              <Share2 className="text-primary w-6 h-6" />
            </div>
            <h3 className="text-white font-bold mb-3">2. Share Your Link</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              Promote Gigspace anywhere — social media, your audience, or direct outreach. Every click and referral is tracked automatically.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Get your referral link <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="flex flex-col items-start">
            <div className="bg-primary/20 p-3 rounded-lg border border-primary/30 mb-6">
              <DollarSign className="text-primary w-6 h-6" />
            </div>
            <h3 className="text-white font-bold mb-3">3. Get paid</h3>
            <p className="text-slate-400 text-sm mb-6 flex-grow leading-relaxed">
              When someone books a service through your link, you earn 50% of our platform fee once the job is completed.
            </p>
            <Link to="/signup" className="text-primary text-sm font-semibold flex items-center hover:text-blue-400 transition-colors">
              Start getting paid <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Earnings Section */}
      <section className="px-6 lg:px-12 py-24 border-t border-slate-800/80 max-w-7xl mx-auto w-full">
        <div className="mb-16 text-center">
          <span className="inline-block text-primary text-xs font-bold tracking-widest uppercase border border-primary/30 bg-primary/10 rounded-full px-4 py-1.5 mb-6">
            Earnings that scale
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">See What You Can Earn</h2>
          <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
            From small local services to high-ticket contracts, your earnings scale with every referral. Get paid when any service is completed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {earningsCards.map((card, i) => (
            <div key={i} className="bg-[#1A2035] rounded-xl p-6 border border-slate-700/40">
              <div className="bg-primary/20 p-2.5 rounded-lg border border-primary/30 w-fit mb-5">
                <DollarSign className="text-primary w-5 h-5" />
              </div>
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
      <section className="px-6 lg:px-12 py-20 border-t border-slate-800/80 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-xl font-bold text-white">Popular Service Categories</h2>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <button className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-10 overflow-x-auto pb-2">
          {categories.map(({ name, Icon }, i) => (
            <div key={i} className="flex flex-col items-center gap-3 flex-shrink-0 cursor-pointer group">
              <div className="w-16 h-16 rounded-full bg-[#1A2035] border border-slate-700/60 flex items-center justify-center group-hover:border-primary/50 transition-colors">
                <Icon className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-slate-400 text-xs text-center group-hover:text-white transition-colors whitespace-nowrap">
                {name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-12 py-24 border-t border-slate-800/80 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-white mb-10">Frequently asked questions</h2>
        <div>
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-slate-800/80 overflow-hidden">
              <button
                onClick={() => toggleFaq(index)}
                className="w-full py-5 flex justify-between items-center text-left focus:outline-none group"
              >
                <span className="font-medium text-white text-sm group-hover:text-primary transition-colors pr-8">
                  {faq.question}
                </span>
                <span className="text-slate-400 text-xl flex-shrink-0 leading-none select-none">
                  {openFaqIndex === index ? '−' : '+'}
                </span>
              </button>
              <div
                className={`transition-all duration-300 ease-in-out ${
                  openFaqIndex === index ? 'max-h-40 opacity-100 pb-5' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-slate-400 text-sm leading-relaxed pr-8">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="px-6 lg:px-12 py-24 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl font-bold text-white mb-6">Our mission</h2>
            <div className="space-y-6 text-slate-400 leading-relaxed text-[15px]">
              <p>
                At Gigspace, our mission is to connect talented professionals with the people and businesses who need them—whether it's a hands-on home project, a virtual task, or anything in between. We empower sellers to turn their skills into income, while giving buyers a simple, reliable, and transparent way to hire the right pro for the job.
              </p>
              <p>
                By combining the flexibility of digital freelance platforms with the reach of local service marketplaces, we make hiring faster, safer, and more efficient for everyone. Our platform is built to remove unnecessary fees, streamline communication, and provide secure transactions, so professionals can focus on what they do best and buyers can get their work done with confidence.
              </p>
            </div>
          </div>

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

      {/* CTA */}
      <section className="py-24 px-6 text-center border-t border-slate-800/80">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-10 leading-tight">
          Join hundreds of affiliates earning big<br />
          💰 with Gigspace
        </h2>
        <Link
          to="/signup"
          className="inline-flex items-center px-6 py-3 border border-slate-500 text-white font-semibold rounded-full hover:bg-slate-800 transition-colors"
        >
          Become an Affiliate <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-6 lg:px-12 text-center text-sm text-slate-500">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 mb-8">
          <Link to="/about" className="hover:text-slate-300 transition-colors">About Us</Link>
          <Link to="/for-sellers" className="hover:text-slate-300 transition-colors">For Sellers</Link>
          <Link to="/" className="hover:text-slate-300 transition-colors">For Buyers</Link>
          <Link to="/affiliate" className="hover:text-slate-300 transition-colors">Affiliate Program</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Terms & Conditions</Link>
          <Link to="#" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
        </div>
        <p>© {new Date().getFullYear()} Gigspace, LLC. All rights reserved.</p>
      </footer>

    </div>
  );
};

export default AffiliateLanding;
