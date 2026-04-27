import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import LocationIcon from './LocationIcon';

const PasswordUpdatedEmail = () => {
  return (
    <div className="min-h-screen bg-[#0E1422] flex flex-col items-center py-16 px-4 font-sans text-slate-300">
      
      {/* Logo Header */}
      <div className="mb-12">
        <Link to="/" className="flex items-center">
          <LocationIcon className="w-8 h-8 mr-1.5" />
          <span className="text-3xl font-bold tracking-tight text-white">igspace</span>
        </Link>
      </div>

      {/* Email Container */}
      <div className="max-w-2xl w-full">
        
        {/* Header Title with Icon */}
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 border border-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-emerald-100" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white ml-5">
            Password Updated!
          </h1>
        </div>

        {/* Content Paragraphs */}
        <div className="space-y-6 text-[15px] leading-relaxed">
          <p>Hello,</p>
          
          <p>
            Your Gigspace password has been changed successfully. If you did not initiate this change, please <a href="#" className="text-white underline hover:text-slate-300 transition-colors">contact us</a> immediately to ensure the security of your account.
          </p>

          <hr className="border-slate-800 my-8" />

          <p>
            Your security is our top priority!
          </p>

          <p className="pt-2">
            Stay safe,<br />
            The Gigspace Team
          </p>

          <div className="pt-4">
            <Link
              to="/signin"
              className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center"
            >
              Sign in to your account
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-slate-500">
          Too many emails? <a href="#" className="underline hover:text-slate-400 transition-colors">Unsubscribe</a>
        </div>
      </div>

    </div>
  );
};

export default PasswordUpdatedEmail;
