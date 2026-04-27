import { Link, useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';

const WelcomeEmail = () => {
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
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-xl shrink-0">
            🎉
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white ml-5">
            Welcome to Gigspace. We're glad you're here!
          </h1>
        </div>

        {/* Content Paragraphs */}
        <div className="space-y-6 text-[15px] leading-relaxed">
          <p>
            Your account is ready. Now lets create your first post so buyers can find you.
          </p>
          <p>
            Once your post is live, it will be visible to people searching for services in your area. You can edit it anytime, create additional posts for other services, or expand to more locations whenever you're ready.
          </p>
          <p className="font-medium text-white flex items-center">
            <span className="mr-2">👇</span> Click below to create your first post.
          </p>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={() => navigate('/post-service')}
              className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center"
            >
              Create post
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>

          <p className="pt-4">
            If you have any questions, our support team is just an email away.
          </p>

          <p className="pt-2">
            Cheers,<br />
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

export default WelcomeEmail;
