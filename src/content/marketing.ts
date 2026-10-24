// Copy for the public marketing pages, in one place so the React pages and the
// server renderer (api/page.ts, GIG-77) show visitors and crawlers the same
// words. Plain data only: no React, no DOM, no firebase.

export interface Feature { title: string; description: string }
export interface Faq { question: string; answer: string }
export interface Stat { value: string; label: string }
export interface Step { title: string; description: string; link: string }

export const FOOTER_LINKS: { to: string; label: string }[] = [
  { to: '/about', label: 'About Us' },
  { to: '/for-sellers', label: 'For Sellers' },
  { to: '/', label: 'For Buyers' },
  { to: '/affiliate', label: 'Affiliate Program' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/privacy', label: 'Privacy Policy' },
];

export const COPYRIGHT = '© Gigspace, LLC. All rights reserved.';

/** The categories the landing pages feature, by name (also the category key). */
export const POPULAR_CATEGORIES = [
  'Automotive', 'Graphics & Design', 'Home & Garden', 'Labor & Moving', 'Programming & Tech',
  'Skilled Trade', 'Business', 'Lessons', 'Marketing', 'Legal', 'Real Estate',
];

export const POPULAR_CATEGORIES_HEADING = 'Popular Service Categories';

export const MISSION = {
  heading: 'Our mission',
  paragraphs: [
    "At Gigspace, our mission is to connect talented professionals with the people and businesses who need them—whether it's a hands-on home project, a virtual task, or anything in between. We empower sellers to turn their skills into income, while giving buyers a simple, reliable, and transparent way to hire the right pro for the job.",
    'By combining the flexibility of digital freelance platforms with the reach of local service marketplaces, we make hiring faster, safer, and more efficient for everyone. Our platform is built to remove unnecessary fees, streamline communication, and provide secure transactions, so professionals can focus on what they do best and buyers can get their work done with confidence.',
  ],
  stats: [
    { value: '$1.95 trillion', label: 'Spent annually on services worldwide' },
    { value: '62%', label: 'People who prefer hiring local talent' },
    { value: '$20 - $100K', label: 'Price range sellers can set' },
  ] as Stat[],
};

export const FAQ_HEADING = 'Frequently asked questions';

export const HOME = {
  h1: ['Local talent.', 'On demand.'],
  intro: ['Hire talented pros for in-person services or remote experts for digital work.', 'One marketplace for everything you need.'],
  searchPlaceholder: 'Search for a service',
  featuresEyebrow: 'Everything you need, all in one place',
  featuresHeading: 'Hire the right pro for any project',
  featuresIntro: 'Find trusted professionals for any project — home repairs, digital tasks, and everything in between.',
  features: [
    { title: 'Instant search results.', description: 'Find local or remote pros in seconds — no scrolling through irrelevant listings.' },
    { title: 'Real-time messaging.', description: 'Chat instantly without filling out forms, sharing personal details, or waiting for bids.' },
    { title: 'Transparent profiles.', description: 'See upfront rates and service areas before reaching out.' },
    { title: 'Secure escrow payments.', description: 'Transact with confidence and only pay when services are completed and fully approved.' },
    { title: 'Photo & video portfolios.', description: "Preview real work quality so you know exactly who you're hiring and how talented they are." },
    { title: '0% buyer fees.', description: 'Skip the added fees other platforms sneak in — your budget should go to the work, not the platform.' },
  ] as Feature[],
  ctaHeading: ['Work smarter, not harder.', 'Get more done with Gigspace today.'],
  ctaText: "See why we're the #1 platform that helps you move from planning to done in a fraction of the time.",
  ctaButton: 'Get started for free',
};

export const SELLERS = {
  badge: 'Stripe integration is now live 💸',
  h1: ['Get Discovered. Get Hired.', 'Get Paid.'],
  intro: ['From home repairs to digital work and everything in between.', 'Turn any skill into income and earn doing what you do best.'],
  heroButton: 'Become a Seller',
  howHeading: 'How it works',
  howIntro: 'Gigspace makes selling your services easy. With simple tools for posting, messaging, and payments, you can scale your business faster than ever.',
  steps: [
    { title: '1. Create a post', description: 'Sign up for free, create your first post, and start showcasing your skills to a growing audience.', link: 'Create your first post' },
    { title: '2. Deliver excellent work', description: 'Get order notifications, chat with customers, and track everything via your dashboard.', link: 'Get your first order' },
    { title: '3. Get paid', description: 'Accept payments directly through Stripe and funds remit to your bank account.', link: 'Start getting paid' },
  ] as Step[],
  featuresEyebrow: 'Finally, a marketplace built for sellers',
  featuresHeading: 'A better way to sell your services',
  featuresIntro: 'We remove the limits of traditional freelance platforms by giving you control and flexibility to scale your business on your terms.',
  features: [
    { title: 'Photo & video portfolios.', description: 'Show off your best work with clean portfolios that help build trust with buyers.' },
    { title: 'Custom pricing.', description: "Send tailored quotes for each customer's project and charge exactly what your work is worth." },
    { title: 'Real-time messaging.', description: 'Chat instantly with customers to answer questions, confirm details, and close deals without delays.' },
    { title: 'Secure escrow payments.', description: 'Transact with confidence knowing funds are locked in and released when the job is approved.' },
    { title: 'Fair, low seller fees.', description: "Keep more of what you earn with a simple fee structure that's lower than every other marketplace." },
    { title: 'Performance insights.', description: "Track views, messages, orders, and earnings to see what's working and optimize your growth." },
  ] as Feature[],
  defaultFaqs: [
    { question: 'What can I sell?', answer: 'You can offer any service that falls inside our diverse categories ranging from digital professional services to localized trade work.' },
    { question: 'How much money can I make?', answer: 'Your earning potential is entirely up to you. You set your own prices and determine how much work you want to take on.' },
    { question: 'How much does it cost?', answer: 'Joining and setting up your primary listing is completely free. We charge a flat platform fee on completed orders and optional subscriptions for multiple local reach.' },
    { question: 'How much time will I need to invest?', answer: 'It is highly flexible. You can freelance part-time or scale it to a full-time business. Setup usually takes under 15 minutes.' },
    { question: 'How do I price my service?', answer: 'We recommend reviewing similar services to gauge local/remote market rates. You can always adjust your prices as your profile grows.' },
    { question: 'How do I get paid?', answer: 'Payments are securely held in escrow and released to you upon project approval. You can withdraw directly to your bank account.' },
  ] as Faq[],
  ctaHeading: ['Work smarter, not harder.', 'Earn more with Gigspace today.'],
  ctaButton: 'Get started for free',
};

export const ABOUT = {
  badge: 'About Us',
  h1: ['Changing the way people', 'work together'],
  intro: 'From home services to digital work, Gigspace brings people together to collaborate, create, and accomplish any project big or small.',
  image: { src: '/Gigspace office.jpg', alt: 'Gigspace office' },
  valuesHeading: 'About Us',
  valuesIntro: 'Every feature, design, and interaction on Gigspace is built to accomplish one thing: help people succeed.',
  values: [
    { title: 'Trust first.', description: 'We built a platform where transparency, safety, and reliability come before everything else.' },
    { title: 'Simplicity wins.', description: 'From posting a service to hiring a pro, every step is designed to be fast, intuitive, and frustration-free.' },
    { title: 'Opportunity for everyone.', description: "Whether you're a local pro or a digital expert, Gigspace gives you a fair shot to earn what you're worth." },
    { title: 'Fairness & transparency.', description: "We're honest with our pricing, our policies, and our promises — no hidden fees, no surprises." },
    { title: 'Every interaction matters.', description: 'We treat every project and connection with care—because real people depend on the work done here.' },
    { title: 'Strength in community.', description: "We're building a space where pros and customers succeed together." },
  ] as Feature[],
  ctaHeading: ['Gigspace makes it easier to hire, sell,', 'and get things done faster.'],
  ctaButton: 'Get started for free',
};

export const AFFILIATE = {
  badge: 'The Gigspace affiliate program is now live!',
  h1: ['Earn Big Commissions for', 'Every Job Booked'],
  intro: ['Get paid every time someone hires a service through your link.', 'Earn 50% of our platform fee on every completed job.'],
  heroButton: 'Become an Affiliate',
  howHeading: 'How it works',
  howIntro: 'Sign up in minutes, share your link, and earn commissions every time someone books a service through Gigspace.',
  steps: [
    { title: '1. Sign Up as an Affiliate', description: 'Create your free affiliate account in minutes and get instant access to your unique referral link and tracking dashboard.', link: 'Get started for free' },
    { title: '2. Share Your Link', description: 'Promote Gigspace anywhere — social media, your audience, or direct outreach. Every click and referral is tracked automatically.', link: 'Get your referral link' },
    { title: '3. Get paid', description: 'When someone books a service through your link, you earn 50% of our platform fee once the job is completed.', link: 'Start getting paid' },
  ] as Step[],
  earningsEyebrow: 'Earnings that scale',
  earningsHeading: 'See What You Can Earn',
  earningsIntro: 'From small local services to high-ticket contracts, your earnings scale with every referral. Get paid when any service is completed.',
  earnings: [
    { label: 'Small Job', service: '$100 local repair job', commission: '+ $5 commission', emoji: '🔥' },
    { label: 'Medium Job', service: '$1,000 home service project', commission: '+ $50 commission', emoji: '⚡' },
    { label: 'High-Ticket Job', service: '$10,000 renovation project', commission: '+ $500 commission', emoji: '🌟' },
    { label: 'Large Project (top-end example)', service: '$100,000 commercial contract', commission: '+ $5,000 commission', emoji: '💰' },
  ],
  defaultFaqs: [
    { question: 'Who can become a Gigspace affiliate?', answer: "Anyone can become a Gigspace affiliate. Whether you're a content creator, blogger, business owner, or just someone with a network, you can earn commissions by referring new clients to Gigspace." },
    { question: 'Do I need to be a Gigspace customer?', answer: "No, you don't need to be a Gigspace customer to join the affiliate program. Simply sign up for a free affiliate account and start sharing your unique referral link." },
    { question: 'How do I join the program?', answer: 'Click the "Become an Affiliate" button, create your free account, and you\'ll get instant access to your unique referral link and a real-time tracking dashboard.' },
    { question: 'What promotion methods are accepted?', answer: 'You can promote Gigspace through social media, blogs, email newsletters, YouTube, podcasts, or any platform where you have an audience. Spam and misleading promotions are not permitted.' },
    { question: 'How do I track my referrals?', answer: 'Your affiliate dashboard provides real-time tracking of clicks, referrals, and earnings so you can see exactly how your link is performing at all times.' },
    { question: 'How do I get paid?', answer: 'Commissions are paid out once the referred job is completed and payment is released. You can withdraw your earnings directly to your bank account.' },
  ] as Faq[],
  ctaHeading: ['Join hundreds of affiliates earning big 💰', 'with Gigspace'],
};

/** CMS FAQ nodes (`cms/faqs`, `cms/affiliateFaqs`) as a list, or null when unusable. */
export function cmsFaqList(value: unknown): Faq[] | null {
  if (!value || typeof value !== 'object') return null;
  const list = Object.values(value as Record<string, { question?: unknown; answer?: unknown }>)
    .filter((f) => f?.question && f?.answer)
    .map((f) => ({ question: String(f.question), answer: String(f.answer) }));
  return list.length ? list : null;
}
