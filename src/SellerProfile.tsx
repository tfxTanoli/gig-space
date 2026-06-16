import { useState, useRef, type ChangeEvent } from 'react';
import { UserRound, ArrowLeftRight } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-background-deep p-4">
      <div className="bg-card rounded-xl shadow-2xl p-8 lg:p-12 w-full max-w-[500px] flex flex-col items-center">

        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <UserRound strokeWidth={2} className="text-primary w-6 h-6" />
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
              <svg viewBox="0 0 18.67 24.61" className="w-9 h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.67 10.3419C18.6704 10.8302 18.6268 11.3175 18.5397 11.7979C17.4027 18.2019 9.33891 24.6084 9.33891 24.6084C9.33891 24.6084 0 18.2058 0 10.3419C0.000236174 8.70603 0.429663 7.09887 1.24533 5.68118C2.061 4.26349 3.23432 3.08496 4.64794 2.26347C6.06156 1.44198 7.66593 1.00632 9.3006 1.00007C10.9353 0.993812 12.5429 1.41718 13.9628 2.22782C14.2229 2.37544 14.4455 2.58116 14.6133 2.82896C14.781 3.07676 14.8893 3.35995 14.9297 3.65649C14.9702 3.95303 14.9417 4.25492 14.8465 4.53864C14.7513 4.82237 14.592 5.08027 14.3809 5.29228C14.0768 5.59209 13.6829 5.78397 13.2595 5.83859C12.8361 5.8932 12.4065 5.80753 12.0364 5.59469C11.0494 5.03095 9.91113 4.78977 8.78054 4.90483C7.64994 5.01989 6.58349 5.48545 5.73012 6.23649C4.87675 6.98752 4.27907 7.98653 4.02057 9.09399C3.76206 10.2014 3.85563 11.3621 4.28821 12.4137C4.7208 13.4654 5.47079 14.3556 6.43344 14.96C7.39609 15.5644 8.52333 15.8528 9.65773 15.785C10.7921 15.7172 11.877 15.2965 12.7609 14.5817C13.6448 13.8668 14.2836 12.8936 14.588 11.7979H11.2757C10.7624 11.7979 10.2699 11.5944 9.90618 11.2318C9.54245 10.8693 9.33707 10.3773 9.335 9.86356C9.335 9.34846 9.53947 8.85446 9.90342 8.49023C10.2674 8.12601 10.761 7.92139 11.2757 7.92139H16.2343C16.8751 7.9186 17.4909 8.16968 17.9473 8.6198C18.4036 9.06991 18.6635 9.68248 18.67 10.3237V10.3419Z" fill="#64748B"/>
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
            className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
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
            <ArrowLeftRight className="inline w-3.5 h-3.5 mr-1.5" /> Switch account type
          </button>
          <button
            onClick={handleContinue}
            disabled={loading}
            className="bg-primary hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-colors"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SellerProfile;
