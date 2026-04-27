import { useState, useRef } from 'react';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set } from 'firebase/database';
import { storage, database } from './firebase';
import { useAuth } from './AuthContext';

const BuyerProfile = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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
    setPhotoFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
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
      if (photoFile) {
        const imgRef = storageRef(storage, `profilePhotos/${user.uid}`);
        await uploadBytes(imgRef, photoFile);
        photoURL = await getDownloadURL(imgRef);
      }

      await set(dbRef(database, `users/${user.uid}`), {
        name: name.trim(),
        username: username.trim(),
        photoURL,
        accountType: 'buyer',
        email: user.email ?? '',
        createdAt: Date.now(),
      });

      navigate('/buyer-dashboard');
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
          Create your buyer profile
        </h2>

        {error && (
          <div className="w-full mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="w-full flex items-center gap-5 mb-7">
          <div className="w-20 h-20 rounded-full bg-[#4B5563] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {photoPreview ? (
              <img src={photoPreview} alt="Profile photo preview" className="w-full h-full object-cover" />
            ) : (
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="28" cy="21" r="10" fill="#6B7280" />
                <ellipse cx="28" cy="52" rx="22" ry="12" fill="#6B7280" />
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
              Upload profile photo
            </button>
            <p className="text-slate-500 text-sm">JPG or PNG. 1MB max.</p>
          </div>
        </div>

        <div className="w-full mb-4">
          <label className="block text-white text-sm font-medium mb-2">Name</label>
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

export default BuyerProfile;
