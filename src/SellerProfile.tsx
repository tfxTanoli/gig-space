import { useState, useRef, type ChangeEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set, get } from 'firebase/database';
import { storage, database, auth } from './firebase';
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

      // Fire-and-forget welcome email
      auth.currentUser?.getIdToken().then(token =>
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/email/welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accountType: 'seller' }),
        })
      ).catch(() => {});

      navigate('/post-service?new=true');
    } catch {
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-surface rounded-xl shadow-2xl p-8 lg:p-12 w-full max-w-[500px] flex flex-col items-center">

        <div className="mb-6">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="24" fill="#004F3B"/>
            <path d="M24 25C26.7614 25 29 22.7614 29 20C29 17.2386 26.7614 15 24 15C21.2386 15 19 17.2386 19 20C19 22.7614 21.2386 25 24 25Z" stroke="#00D492" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M32 33C32 30.8783 31.1571 28.8434 29.6569 27.3431C28.1566 25.8429 26.1217 25 24 25C21.8783 25 19.8434 25.8429 18.3431 27.3431C16.8429 28.8434 16 30.8783 16 33" stroke="#00D492" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
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
          <div className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 72 72" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 36C0 16.1178 16.1178 0 36 0C55.8823 0 72 16.1178 72 36C72 55.8823 55.8823 72 36 72C16.1178 72 0 55.8823 0 36Z" fill="#314158"/>
                <path d="M53 32.0126C53.0007 32.9018 52.9213 33.7892 52.7628 34.6641C50.6921 46.3264 36.0071 57.9934 36.0071 57.9934C36.0071 57.9934 19 46.3335 19 32.0126C19.0004 29.0335 19.7825 26.1067 21.2679 23.5249C22.7533 20.9431 24.89 18.7969 27.4644 17.3009C30.0387 15.8049 32.9605 15.0115 35.9373 15.0001C38.9142 14.9887 41.8419 15.7597 44.4277 17.236C44.9014 17.5048 45.3068 17.8795 45.6122 18.3307C45.9177 18.782 46.1149 19.2977 46.1886 19.8377C46.2623 20.3778 46.2104 20.9275 46.037 21.4442C45.8637 21.9609 45.5735 22.4306 45.1891 22.8167C44.6352 23.3627 43.918 23.7121 43.1469 23.8116C42.3759 23.911 41.5936 23.755 40.9195 23.3674C39.1221 22.3408 37.0492 21.9016 34.9903 22.1111C32.9313 22.3206 30.9892 23.1685 29.4351 24.5362C27.8811 25.9039 26.7926 27.7232 26.3219 29.74C25.8511 31.7568 26.0215 33.8704 26.8093 35.7855C27.5971 37.7007 28.9629 39.3219 30.716 40.4225C32.469 41.5232 34.5219 42.0485 36.5877 41.925C38.6536 41.8015 40.6293 41.0353 42.239 39.7336C43.8487 38.4319 45.0119 36.6595 45.5662 34.6641H39.5343C38.5994 34.6641 37.7026 34.2934 37.0402 33.6332C36.3778 32.973 36.0038 32.077 36 31.1415C36 30.2034 36.3724 29.3038 37.0352 28.6405C37.698 27.9772 38.5969 27.6046 39.5343 27.6046H48.5644C49.7313 27.5995 50.8527 28.0567 51.6838 28.8764C52.5149 29.6961 52.9881 30.8117 53 31.9794V32.0126Z" fill="#62748E"/>
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
              className="bg-card hover:bg-card-hover text-white font-medium py-2 px-5 rounded-lg transition-colors text-sm focus:outline-none focus-visible:outline-none"
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
            className="w-full h-9 bg-surface-raised border border-slate-600 rounded-lg px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
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
            <ArrowLeft className="inline w-3.5 h-3.5 mr-1.5" /> Switch account type
          </button>
          <button
            onClick={handleContinue}
            disabled={loading}
            className="bg-[#2b7fff] hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold h-9 px-6 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SellerProfile;
