import { useState, useRef } from 'react';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set } from 'firebase/database';
import { storage, database } from './firebase';
import { useAuth } from './AuthContext';

const SellerProfile = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError('Image must be under 1MB.');
      return;
    }
    setLogoFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleContinue = async () => {
    if (!user) return;
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!username.trim()) { setError('Please enter a username.'); return; }

    setLoading(true);
    setError('');

    try {
      let photoURL = '';
      if (logoFile) {
        const imgRef = storageRef(storage, `profilePhotos/${user.uid}`);
        await uploadBytes(imgRef, logoFile);
        photoURL = await getDownloadURL(imgRef);
      }

      await set(dbRef(database, `users/${user.uid}`), {
        name: name.trim(),
        username: username.trim(),
        photoURL,
        accountType: 'seller',
        email: user.email ?? '',
        createdAt: Date.now(),
      });

      navigate('/post-service');
    } catch {
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#818791] p-4">
      <div className="bg-[#0E1422] rounded-xl shadow-2xl p-8 lg:p-12 w-full max-w-[500px] flex flex-col items-center">

        <div className="w-12 h-12 bg-[#0C4A26] rounded-full flex items-center justify-center mb-6">
          <User strokeWidth={2} className="text-[#2EEA60] w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-white mb-8">
          Create your seller profile
        </h2>

        {error && (
          <div className="w-full mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="w-full flex items-center gap-5 mb-7">
          <div className="w-20 h-20 rounded-full bg-[#1A2035] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
            ) : (
              <svg width="44" height="50" viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 0C10.4 0 1 9.4 1 21C1 32.5 22 50 22 50C22 50 43 32.5 43 21C43 9.4 33.6 0 22 0Z" fill="#2D3748" />
                <text x="22" y="26" textAnchor="middle" fill="#94A3B8" fontSize="15" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">G</text>
              </svg>
            )}
          </div>

          <div className="flex flex-col items-start gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#1e293b] hover:bg-[#263347] text-white font-medium py-2 px-5 rounded-lg border border-slate-600/60 transition-colors text-sm"
            >
              Upload logo
            </button>
            <p className="text-slate-500 text-sm">JPG or PNG. 1MB max.</p>
          </div>
        </div>

        <div className="w-full mb-4">
          <label className="block text-white text-sm font-medium mb-2">Name / Business Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#1A2035] border border-slate-700/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="w-full mb-8">
          <label className="block text-white text-sm font-medium mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#1A2035] border border-slate-700/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="w-full flex items-center justify-between">
          <button
            onClick={() => navigate('/account-type')}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← Switch account type
          </button>
          <button
            onClick={handleContinue}
            disabled={loading}
            className="bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-colors"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SellerProfile;
