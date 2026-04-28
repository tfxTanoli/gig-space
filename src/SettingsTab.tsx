import { useState, useEffect, useRef } from 'react';
import { Camera, Shield, Eye, EyeOff } from 'lucide-react';
import {
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from './firebase';
import { useAuth } from './AuthContext';

type Section = 'profile' | 'security';

interface Msg {
  text: string;
  ok: boolean;
}

const SettingsTab = ({ mode }: { mode: 'buyer' | 'seller' }) => {
  const { user, userProfile } = useAuth();

  const [section, setSection] = useState<Section>('profile');

  // Profile fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<Msg | null>(null);

  // Sync form when profile data loads
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name ?? '');
      setUsername(userProfile.username ?? '');
    }
  }, [userProfile]);

  const isEmailProvider =
    user?.providerData.some((p) => p.providerId === 'password') ?? false;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setPhotoUploading(true);
    try {
      const sr = storageRef(storage, `avatars/${user.uid}`);
      await uploadBytes(sr, file);
      const url = await getDownloadURL(sr);
      await updateProfile(user, { photoURL: url });
      await update(ref(database, `users/${user.uid}`), { photoURL: url });
    } catch {
      // photo stays unchanged on error
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProfileSave = async () => {
    if (!user) return;
    const trimName = name.trim();
    const trimUsername = username.trim();
    if (!trimName) {
      setProfileMsg({ text: 'Name cannot be empty.', ok: false });
      return;
    }
    if (!trimUsername) {
      setProfileMsg({ text: 'Username cannot be empty.', ok: false });
      return;
    }
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateProfile(user, { displayName: trimName });
      await update(ref(database, `users/${user.uid}`), {
        name: trimName,
        username: trimUsername,
      });
      setProfileMsg({ text: 'Profile updated successfully.', ok: true });
    } catch {
      setProfileMsg({ text: 'Failed to update profile. Please try again.', ok: false });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user || !user.email) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match.', ok: false });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'Password must be at least 6 characters.', ok: false });
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordMsg({ text: 'Password updated successfully.', ok: true });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const isWrongPassword =
        err instanceof Error &&
        (err.message.includes('wrong-password') ||
          err.message.includes('invalid-credential') ||
          err.message.includes('INVALID_LOGIN_CREDENTIALS'));
      setPasswordMsg({
        text: isWrongPassword
          ? 'Current password is incorrect.'
          : 'Failed to update password. Please try again.',
        ok: false,
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* Section switcher */}
      <div className="flex gap-1 bg-[#111827] border border-slate-800 rounded-xl p-1 w-fit">
        {(['profile', 'security'] as Section[]).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`text-sm px-5 py-2 rounded-lg font-medium transition-colors capitalize ${
              section === s ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {s === 'profile' ? 'Profile' : 'Security'}
          </button>
        ))}
      </div>

      {/* ── Profile ── */}
      {section === 'profile' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          {/* Avatar row */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt="avatar"
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
                  {userProfile?.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}
              {photoUploading && (
                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <Camera className="w-4 h-4" />
                {photoUploading ? 'Uploading…' : 'Change photo'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                />
              </label>
              <p className="text-slate-500 text-xs mt-1.5">JPG, PNG or WebP · max 5 MB</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0E1422] border border-slate-700 text-white text-sm px-4 py-2.5 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-600"
              placeholder="Your name"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
            <div className="flex items-center">
              <span className="bg-[#0E1422] border border-r-0 border-slate-700 text-slate-500 text-sm px-3 py-2.5 rounded-l-lg select-none">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())
                }
                className="flex-1 bg-[#0E1422] border border-slate-700 text-white text-sm px-4 py-2.5 rounded-r-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-600"
                placeholder="username"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={userProfile?.email ?? user?.email ?? ''}
              disabled
              className="w-full bg-[#0E1422] border border-slate-700 text-slate-500 text-sm px-4 py-2.5 rounded-lg cursor-not-allowed"
            />
            <p className="text-slate-600 text-xs mt-1">Email cannot be changed</p>
          </div>

          {/* Account type badge */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Account type
            </label>
            <span
              className={`inline-block text-xs px-3 py-1.5 rounded-full font-medium ${
                mode === 'seller'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              {mode === 'seller' ? 'Seller' : 'Buyer'}
            </span>
          </div>

          {/* Feedback */}
          {profileMsg && (
            <p className={`text-sm ${profileMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {profileMsg.text}
            </p>
          )}

          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {profileSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {/* ── Security ── */}
      {section === 'security' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Change password</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                {isEmailProvider
                  ? 'Update your account password. Minimum 6 characters.'
                  : 'Your account is connected via Google — password management is handled there.'}
              </p>
            </div>
          </div>

          {isEmailProvider ? (
            <>
              {/* Current password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#0E1422] border border-slate-700 text-white text-sm px-4 py-2.5 pr-11 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-600"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#0E1422] border border-slate-700 text-white text-sm px-4 py-2.5 pr-11 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-600"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#0E1422] border border-slate-700 text-white text-sm px-4 py-2.5 pr-11 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-600"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {passwordMsg.text}
                </p>
              )}

              <button
                onClick={handlePasswordChange}
                disabled={
                  passwordSaving || !currentPassword || !newPassword || !confirmPassword
                }
                className="bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                {passwordSaving ? 'Updating…' : 'Update password'}
              </button>
            </>
          ) : (
            <div className="bg-[#0E1422] border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm">
                To manage your password, visit your{' '}
                <span className="text-white font-medium">Google Account</span> settings at
                myaccount.google.com.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
