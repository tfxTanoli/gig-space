import LocationIcon from './LocationIcon';
import { Link, useNavigate } from 'react-router-dom';

const VerifyEmail = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col pt-8 px-8 lg:px-16 items-center">
      <div className="w-full max-w-7xl flex items-center mb-16 lg:mb-32">
        <LocationIcon className="w-6 h-6 mr-1" />
        <span className="text-xl font-bold tracking-tight text-white">igspace</span>
      </div>

      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-4">
          Verify your email
        </h1>
        <p className="text-slate-300 text-sm mb-8 leading-relaxed">
          To continue, please enter the 6-digit verification code sent to your email address.
        </p>

        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); navigate('/account-type'); }}>
          <div className="space-y-4">
            <label className="text-sm font-medium text-white" htmlFor="verification-code">
              Verification Code
            </label>
            <div className="flex gap-3 justify-between">
              {['5', '6', '3', '2', '', ''].map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  value={digit}
                  readOnly
                  className={`w-12 h-14 text-center text-xl font-semibold bg-[#1A2035] rounded-md text-white focus:outline-none transition-colors ${
                    digit ? 'border border-primary/50 ring-1 ring-primary/20' : 'border border-slate-700/50'
                  }`}
                />
              ))}
            </div>
            
            <p className="text-sm text-slate-400">
              Didn't receive a code? <button type="button" className="underline hover:text-slate-300 transition-colors">Resend</button>
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-md transition-colors"
          >
            Submit
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-400">
          Wrong email?{' '}
          <Link to="/signin" className="text-primary hover:text-blue-400 font-semibold transition-colors">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
