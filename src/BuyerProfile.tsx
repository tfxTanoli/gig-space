import { useState, useRef, type ChangeEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set, get, push, update, increment } from 'firebase/database';
import { storage, database, auth } from './firebase';
import { useAuth } from './AuthContext';
import UsernameField from './UsernameField';
import { normalizeUsername, validateUsername, claimUsername } from './username';
import { useUsernameAvailability } from './useUsernameAvailability';

const BuyerProfile = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState('');
  const { status: usernameStatus, message: usernameMessage } = useUsernameAvailability(
    username,
    user?.uid,
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photoURL ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
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
    setPhotoFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
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
      if (photoFile) {
        try {
          const imgRef = storageRef(storage, `profilePhotos/${user.uid}`);
          await uploadBytes(imgRef, photoFile);
          photoURL = await getDownloadURL(imgRef);
        } catch {
          // Storage upload failed; fall back to Google photo or empty
        }
      }

      const existingRoleSnap = await get(dbRef(database, `users/${user.uid}/role`));
      const existingRole = (existingRoleSnap.val() as string | null) ?? 'user';

      // Check for affiliate referral before saving the user record
      const referralCode = localStorage.getItem('pendingReferral');
      let referredByAffiliate: string | undefined;
      if (referralCode) {
        try {
          const codeSnap = await get(dbRef(database, `affiliateCodes/${referralCode}`));
          if (codeSnap.exists()) {
            referredByAffiliate = codeSnap.val() as string;
          }
        } catch { /* ignore lookup errors */ }
      }

      const now = Date.now();
      await set(dbRef(database, `users/${user.uid}`), {
        name: name.trim(),
        username: uname,
        photoURL,
        accountType: 'buyer',
        email: user.email ?? '',
        createdAt: now,
        role: existingRole,
        ...(referredByAffiliate ? { referredBy: referredByAffiliate } : {}),
      });

      // Record referral in Firebase and increment affiliate counter
      if (referredByAffiliate) {
        try {
          const referralRef = push(dbRef(database, 'affiliateReferrals'));
          await set(referralRef, {
            affiliateId: referredByAffiliate,
            referredUserId: user.uid,
            referredUserName: name.trim(),
            referredUserEmail: user.email ?? '',
            status: 'signed_up',
            createdAt: now,
          });
          await update(dbRef(database, `affiliates/${referredByAffiliate}`), {
            totalReferrals: increment(1),
          });
          localStorage.removeItem('pendingReferral');
        } catch { /* don't fail profile creation if referral tracking fails */ }
      }

      // Fire-and-forget welcome email
      auth.currentUser?.getIdToken().then(token =>
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/email/welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accountType: 'buyer' }),
        })
      ).catch(() => {});

      navigate('/buyer-dashboard');
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
          Create your buyer profile
        </h2>

        {error && (
          <div className="w-full mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="w-full flex items-center gap-5 mb-7">
          <div className="w-20 h-20 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {photoPreview ? (
              <img src={photoPreview} alt="Profile photo preview" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 80 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="29" r="11" fill="#94A3B8"/>
                <circle cx="40" cy="72" r="25" fill="#94A3B8"/>
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

export default BuyerProfile;
