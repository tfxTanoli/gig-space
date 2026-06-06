import { useState, useRef, type ChangeEvent } from 'react';
import { User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set, get } from 'firebase/database';
import { storage, database } from './firebase';
import { useAuth } from './AuthContext';
import UsernameField from './UsernameField';
import { normalizeUsername, validateUsername, claimUsername } from './username';
import { useUsernameAvailability } from './useUsernameAvailability';

const SellerProfile = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState('');
  const { status: usernameStatus, message: usernameMessage } = useUsernameAvailability(
    username,
    user?.uid,
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(user?.photoURL ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
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
    const uname = normalizeUsername(username);
    if (!uname) { setError('Please enter a username.'); return; }
    const usernameError = validateUsername(uname);
    if (usernameError) { setError(usernameError); return; }
    if (usernameStatus === 'taken') { setError('This username is already taken.'); return; }

    setLoading(true);
    setError('');

    try {
      await claimUsername(user.uid, uname);
    } catch {
      setError('This username is already taken.');
      setLoading(false);
      return;
    }

    try {
      let photoURL = user.photoURL ?? '';
      if (logoFile) {
        try {
          const imgRef = storageRef(storage, `profilePhotos/${user.uid}`);
          await uploadBytes(imgRef, logoFile);
          photoURL = await getDownloadURL(imgRef);
        } catch {
          // Storage upload failed; fall back to Google photo or empty
        }
      }

      const existingRoleSnap = await get(dbRef(database, `users/${user.uid}/role`));
      const existingRole = (existingRoleSnap.val() as string | null) ?? 'user';

      await set(dbRef(database, `users/${user.uid}`), {
        name: name.trim(),
        username: uname,
        photoURL,
        accountType: 'seller',
        email: user.email ?? '',
        createdAt: Date.now(),
        role: existingRole,
      });

      navigate('/post-service?new=true');
    } catch {
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-deep p-4">
      <div className="bg-card rounded-xl shadow-2xl p-8 lg:p-12 w-full max-w-[500px] flex flex-col items-center">

        <div className="w-12 h-12 bg-brand-green-bg rounded-full flex items-center justify-center mb-6">
          <User strokeWidth={2} className="text-brand-green w-6 h-6" />
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
          <div className="w-20 h-20 rounded-full bg-surface-raised flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" decoding="async" className="w-full h-full object-cover" />
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
              className="bg-card hover:bg-card-hover text-white font-medium py-2 px-5 rounded-lg border border-slate-600/60 transition-colors text-sm"
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
            className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="w-full mb-8">
          <UsernameField
            value={username}
            onChange={setUsername}
            status={usernameStatus}
            message={usernameMessage}
          />
        </div>

        <div className="w-full flex items-center justify-between">
          <button
            onClick={() => navigate('/account-type')}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            â† Switch account type
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
