import { Link, useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight, KeyRound } from 'lucide-react';

const ResetPasswordEmail = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0E1422] flex flex-col items-center py-16 px-4 font-sans text-slate-300">
      
      {/* Logo Header */}
      <div className="mb-12">
        <Link to="/" className="flex items-center">
          <MapPin className="text-primary w-8 h-8 mr-1.5" fill="currentColor" />
          <span className="text-3xl font-bold tracking-tight text-white">igspace</span>
        </Link>
      </div>

      {/* Email Container */}
      <div className="max-w-2xl w-full">
        
        {/* Header Title with Icon */}
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white ml-5">
            Reset Your Password
          </h1>
        </div>

        {/* Content Paragraphs */}
        <div className="space-y-6 text-[15px] leading-relaxed">
          <p>Hello,</p>
          
          <p>
            We received a request to reset your Gigspace password.
          </p>
          
          <p>
            If you made this request, just click the button below to create a new password. This link will expire in 60 minutes.
          </p>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={() => navigate('/reset-password')}
              className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center"
            >
              Reset password
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>

          <hr className="border-slate-800 my-8" />

          <div>
            <p className="mb-3">Here are some <span className="font-semibold text-white">tips</span> for creating a strong password:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use a mix of letters, numbers, and symbols.</li>
              <li>Avoid common words and phrases.</li>
              <li>Don't reuse passwords from other sites.</li>
            </ul>
          </div>

          <hr className="border-slate-800 my-8" />

          <p>
            If you didn't request a password reset, you can safely ignore this email — your current password will remain unchanged.
          </p>

          <p className="pt-2">
            Stay safe,<br />
            The Gigspace Team
          </p>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-slate-500">
          Too many emails? <a href="#" className="underline hover:text-slate-400 transition-colors">Unsubscribe</a>
        </div>
      </div>

    </div>
  );
};

export default ResetPasswordEmail;
