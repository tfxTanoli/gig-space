import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import HeaderUserMenu from './HeaderUserMenu';

const PrivacyPolicy = () => {
  const { user } = useAuth();

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
          Privacy Policy
        </h1>
        <p className="text-slate-500 text-sm mb-12">Last updated: {new Date().getFullYear()}</p>

        <div className="space-y-10 text-slate-400 leading-relaxed text-[15px]">
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>We collect information you provide when creating an account, posting a service, or making a purchase. This includes name, email address, payment information, and any content you upload to the platform.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use your information to operate and improve the platform, process transactions, send relevant communications, and provide customer support. We do not sell your personal data to third parties.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Sharing</h2>
            <p>We may share information with trusted service providers (e.g., payment processors) who assist us in operating the platform. These providers are bound by confidentiality obligations.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">4. Cookies</h2>
            <p>We use cookies and similar technologies to keep you signed in, remember preferences, and understand how users interact with the platform. You can manage cookie settings in your browser.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide our services. You may request deletion of your account and associated data at any time.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">6. Security</h2>
            <p>We implement industry-standard security measures to protect your information. However, no online platform can guarantee absolute security, and you use Gigspace at your own risk.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data. Contact us to exercise these rights.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
            <p>For privacy-related questions, please contact us at <span className="text-slate-300">privacy@gigspace.com</span>.</p>
          </div>
        </div>
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

export default PrivacyPolicy;
