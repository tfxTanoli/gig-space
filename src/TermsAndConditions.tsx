import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ref as dbRef, get } from 'firebase/database';
import { database } from './firebase';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';
import { sanitizeHtml } from './utils/sanitize';

const TermsAndConditions = () => {
  const { user } = useAuth();
  // Admin-managed content from the CMS overrides the default copy when present.
  const [cmsContent, setCmsContent] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  useEffect(() => {
    Promise.all([
      get(dbRef(database, 'cms/terms')),
      get(dbRef(database, 'cms/termsUpdatedAt')),
    ]).then(([contentSnap, tsSnap]) => {
      const v = contentSnap.val();
      // The CMS editor stores HTML — only treat it as content if it has visible text.
      if (typeof v === 'string' && v.replace(/<[^>]*>/g, '').trim()) setCmsContent(v);
      const ts = tsSnap.val();
      if (typeof ts === 'number' && ts > 0) setUpdatedAt(ts);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-white font-sans flex flex-col">
      {/* Header */}
      <header className="w-full px-4 md:px-6 lg:px-12 h-16 flex justify-between items-center">
        <div className="flex items-center">
          <Logo className="h-6" />
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
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
      </header>

      {/* Content */}
      <section className="flex-1 px-6 lg:px-12 py-16 max-w-4xl mx-auto w-full">
        <div className="inline-block border border-slate-700 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-300 mb-8 tracking-wide">
          Legal
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
          Terms &amp; Conditions
        </h1>
        <p className="text-slate-500 text-sm mb-12">
          Last updated: {updatedAt
            ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : new Date().getFullYear()}
        </p>

        {cmsContent ? (
          /<\/?[a-z][^>]*>/i.test(cmsContent) ? (
            <div
              className="text-slate-300 leading-relaxed text-[15px] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3 [&_li]:mb-1 [&_b]:text-white [&_strong]:text-white"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(cmsContent) }}
            />
          ) : (
            <div className="text-slate-300 leading-relaxed text-[15px] whitespace-pre-wrap">{cmsContent}</div>
          )
        ) : (
        <div className="space-y-10 text-slate-400 leading-relaxed text-[15px]">
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Gigspace, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the platform.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">2. Use of the Platform</h2>
            <p>Gigspace provides a marketplace connecting buyers and sellers of services. You are responsible for ensuring that your use of the platform complies with all applicable laws and regulations.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">3. User Accounts</h2>
            <p>You must provide accurate information when creating an account. You are solely responsible for maintaining the confidentiality of your credentials and all activity under your account.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">4. Payments &amp; Fees</h2>
            <p>All transactions are processed securely through our platform. Gigspace charges a flat platform fee on completed orders. Detailed fee schedules are available in your account settings.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">5. Prohibited Conduct</h2>
            <p>You agree not to engage in fraudulent activity, harassment, spam, or any behavior that violates the rights of others or disrupts the platform's operation.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">6. Limitation of Liability</h2>
            <p>Gigspace is not liable for disputes between buyers and sellers, loss of earnings, or any indirect damages arising from use of the platform. We provide mediation services as a courtesy.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">7. Changes to Terms</h2>
            <p>We reserve the right to update these terms at any time. Continued use of the platform after changes constitutes your acceptance of the revised terms.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
            <p>For questions about these Terms, please contact us at <span className="text-slate-300">support@gigspace.com</span>.</p>
          </div>
        </div>
        )}
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

export default TermsAndConditions;
