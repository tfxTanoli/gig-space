import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Camera, Shield, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import {
  updateProfile,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
} from 'firebase/auth';
import { ref, update, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from './firebase';
import { useAuth } from './AuthContext';
import { useUsernameAvailability } from './useUsernameAvailability';
import { normalizeUsername, validateUsername, claimUsername } from './username';
import { useNavigate } from 'react-router-dom';

type Section = 'profile' | 'security';


const SettingsTab = ({ mode }: { mode: 'buyer' | 'seller' | 'affiliate' }) => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState<Section>('profile');

  // Profile fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Track original values to detect changes
  const [originalUsername, setOriginalUsername] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');

  // Email change: require current password to reauthenticate
  const [emailConfirmPassword, setEmailConfirmPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteShowPassword, setDeleteShowPassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Security fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // Sync form when profile data loads
  useEffect(() => {
    if (userProfile) {
      const u = userProfile.username ?? '';
      const e = userProfile.email ?? user?.email ?? '';
      setName(userProfile.name ?? '');
      setUsername(u);
      setOriginalUsername(u);
      setEmail(e);
      setOriginalEmail(e);
    }
  }, [userProfile, user]);

  const isEmailProvider =
    user?.providerData.some((p) => p.providerId === 'password') ?? false;

  const usernameChanged = username !== originalUsername;
  const emailChanged = email !== originalEmail;

  const { status: usernameStatus, message: usernameMessage } = useUsernameAvailability(
    username,
    user?.uid,
  );

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate type: JPG/PNG only
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Only JPG or PNG images are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    // Validate size: max 1MB
    if (file.size > 1024 * 1024) {
      toast.error('Image must be 1 MB or smaller.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPhotoUploading(true);
    try {
      const sr = storageRef(storage, `avatars/${user.uid}`);
      await uploadBytes(sr, file);
      const url = await getDownloadURL(sr);
      await updateProfile(user, { photoURL: url });
      await update(ref(database, `users/${user.uid}`), { photoURL: url });
    } catch {
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProfileSave = async () => {
    if (!user) return;
    const trimName = name.trim();
    const trimUsername = normalizeUsername(username);
    const trimEmail = email.trim().toLowerCase();

    if (!trimName) {
      setProfileMsg('Name cannot be empty.');
      return;
    }
    if (!trimUsername) {
      setProfileMsg('Username cannot be empty.');
      return;
    }
    const usernameError = validateUsername(trimUsername);
    if (usernameError) {
      setProfileMsg(usernameError);
      return;
    }
    if (usernameChanged && usernameStatus === 'taken') {
      setProfileMsg('This username is already taken.');
      return;
    }

    // Email change requires reauthentication
    if (emailChanged) {
      if (!isEmailProvider) {
        setProfileMsg('Email cannot be changed for Google-linked accounts.');
        return;
      }
      if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
        setProfileMsg('Please enter a valid email address.');
        return;
      }
      if (!emailConfirmPassword) {
        setProfileMsg('Enter your current password to change your email.');
        return;
      }
    }

    setProfileSaving(true);
    setProfileMsg(null);

    try {
      // Claim new username if changed
      if (usernameChanged) {
        try {
          await claimUsername(user.uid, trimUsername, userProfile?.username);
        } catch {
          setProfileMsg('This username is already taken.');
          setProfileSaving(false);
          return;
        }
      }

      // Update name
      await updateProfile(user, { displayName: trimName });
      const dbUpdates: Record<string, unknown> = {
        name: trimName,
        username: trimUsername,
      };

      // Update email if changed
      if (emailChanged && isEmailProvider && user.email) {
        try {
          const credential = EmailAuthProvider.credential(user.email, emailConfirmPassword);
          await reauthenticateWithCredential(user, credential);

          // Sends our branded Resend template (not Firebase's default email) and
          // generates a link that verifies + swaps the primary email once clicked.
          const token = await user.getIdToken();
          const verifyRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/send-email-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ newEmail: trimEmail }),
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to send verification email.');

          // Update DB immediately but mark as unverified pending confirmation
          dbUpdates.email = trimEmail;
          dbUpdates.emailVerified = false;
          setEmailConfirmPassword('');
          await update(ref(database, `users/${user.uid}`), dbUpdates);
          setOriginalUsername(trimUsername);
          setOriginalEmail(trimEmail);
          toast.success(`Verification email sent to ${trimEmail}. Click the link to confirm.`);
          return;
        } catch (err: unknown) {
          const isWrongPassword =
            err instanceof Error &&
            (err.message.includes('wrong-password') ||
              err.message.includes('invalid-credential') ||
              err.message.includes('INVALID_LOGIN_CREDENTIALS'));
          setProfileMsg(
            isWrongPassword
              ? 'Current password is incorrect.'
              : err instanceof Error && err.message
              ? err.message
              : 'Failed to update email. Please try again.',
          );
          setProfileSaving(false);
          return;
        }
      }

      await update(ref(database, `users/${user.uid}`), dbUpdates);
      setOriginalUsername(trimUsername);
      toast.success('Profile updated successfully.');
    } catch {
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user || !user.email) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success('Password updated successfully.');
      // Fire-and-forget "password updated" confirmation email
      user.getIdToken().then((token) =>
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/email/password-updated`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        })
      ).catch(() => { /* non-fatal — password was still updated */ });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const isWrongPassword =
        err instanceof Error &&
        (err.message.includes('wrong-password') ||
          err.message.includes('invalid-credential') ||
          err.message.includes('INVALID_LOGIN_CREDENTIALS'));
      setPasswordMsg(
        isWrongPassword
          ? 'Current password is incorrect.'
          : 'Failed to update password. Please try again.',
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const openDeleteCard = async () => {
    setDeleteOpen(true);
    setDeleteMsg(null);
    setDeleteConfirmText('');
    setDeletePassword('');
    if (user) {
      try {
        const snap = await get(ref(database, `wallets/${user.uid}`));
        const w = snap.val() as { availableBalance?: number; pendingBalance?: number } | null;
        const total = (w?.availableBalance ?? 0) + (w?.pendingBalance ?? 0);
        setWalletBalance(total > 0 ? total : 0);
      } catch {
        setWalletBalance(0);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== 'DELETE') {
      setDeleteMsg('Type DELETE exactly to confirm.');
      return;
    }

    setDeleteLoading(true);
    setDeleteMsg(null);

    try {
      // Re-authenticate before deletion
      if (isEmailProvider) {
        if (!deletePassword) {
          setDeleteMsg('Enter your current password to confirm.');
          setDeleteLoading(false);
          return;
        }
        if (!user.email) throw new Error('No email on account');
        const credential = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        const errMsg = body.error ?? 'Failed to delete account';
        if (res.status === 400 && errMsg.toLowerCase().includes('active order')) {
          toast.error(
            mode === 'affiliate'
              ? 'Unable to delete your account. Please contact support.'
              : 'You have an active order that must be completed before you can delete your account.',
          );
          setDeleteLoading(false);
          return;
        }
        throw new Error(errMsg);
      }

      // Auth user is now deleted on the server — sign out locally and go home
      await logout();
      navigate('/');
    } catch (err: unknown) {
      const isWrongPassword =
        err instanceof Error &&
        (err.message.includes('wrong-password') ||
          err.message.includes('invalid-credential') ||
          err.message.includes('INVALID_LOGIN_CREDENTIALS'));
      setDeleteMsg(
        isWrongPassword
          ? 'Incorrect password.'
          : err instanceof Error ? err.message : 'Failed to delete account.',
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* Section switcher */}
      <div className="flex gap-1 bg-surface border border-slate-800 rounded-xl p-1 w-fit">
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
        <div className="bg-surface border border-slate-800 rounded-xl p-6 space-y-5">
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
              <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <Camera className="w-4 h-4" />
                {photoUploading ? 'Uploading…' : (mode === 'seller' ? 'Change logo' : 'Change photo')}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                />
              </label>
              <p className="text-slate-500 text-xs mt-1.5">JPG or PNG · max 1 MB</p>
            </div>
          </div>

          {/* Name — max-w keeps field comfortable but card fills full width */}
          <div className="max-w-lg">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-500"
              placeholder="Your name"
            />
          </div>

          {/* Username */}
          <div className="max-w-lg">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
            <div
              className={`flex items-center bg-slate-700 border rounded-lg overflow-hidden focus-within:ring-1 transition-colors ${
                usernameChanged && usernameStatus === 'available'
                  ? 'border-green-500/60'
                  : usernameChanged && (usernameStatus === 'taken' || usernameStatus === 'invalid')
                    ? 'border-red-500/60'
                    : 'border-slate-600 focus-within:border-primary focus-within:ring-primary/50'
              }`}
            >
              <span className="border-r border-slate-600 text-slate-400 text-sm px-3 py-2 select-none">
                @
              </span>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  className="w-full bg-transparent text-white text-sm px-4 py-2 pr-10 focus:outline-none placeholder-slate-500"
                  placeholder="username"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameChanged && usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                  {usernameChanged && usernameStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {usernameChanged && (usernameStatus === 'taken' || usernameStatus === 'invalid') && <AlertCircle className="w-4 h-4 text-red-500" />}
                </span>
              </div>
            </div>
            {usernameChanged && (usernameStatus === 'taken' || usernameStatus === 'invalid') && usernameMessage && (
              <p className="text-red-400 text-sm mt-1.5">{usernameMessage}</p>
            )}
            {usernameChanged && usernameStatus === 'available' && (
              <p className="text-green-500 text-sm mt-1.5">Username is available.</p>
            )}
          </div>

          {/* Email */}
          <div className="max-w-lg">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email address
            </label>
            {isEmailProvider ? (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-500"
                  placeholder="your@email.com"
                />
                {emailChanged && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Current password (required to change email)
                    </label>
                    <div className="relative">
                      <input
                        type={showEmailPassword ? 'text' : 'password'}
                        value={emailConfirmPassword}
                        onChange={(e) => setEmailConfirmPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 pr-11 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-500"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-amber-400 text-xs mt-1.5">
                      A verification link will be sent to your new email. Your email updates once you click it.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  type="email"
                  value={userProfile?.email ?? user?.email ?? ''}
                  disabled
                  className="w-full bg-slate-700 border border-slate-600 text-slate-500 text-sm px-4 py-2 rounded-lg cursor-not-allowed"
                />
                <p className="text-slate-500 text-xs mt-1">Email is managed by your Google account</p>
              </>
            )}
          </div>

          {/* Validation errors */}
          {profileMsg && (
            <p className="text-sm text-red-400">{profileMsg}</p>
          )}

          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
          >
            {profileSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {/* ── Security ── */}
      {section === 'security' && (
        <>
        <div className="bg-surface border border-slate-800 rounded-xl p-6 space-y-5">
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
              <div className="max-w-lg">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 pr-11 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-500"
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
              <div className="max-w-lg">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 pr-11 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-500"
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
              <div className="max-w-lg">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 pr-11 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder-slate-500"
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
                <p className="text-sm text-red-400">{passwordMsg}</p>
              )}

              <button
                onClick={handlePasswordChange}
                disabled={
                  passwordSaving || !currentPassword || !newPassword || !confirmPassword
                }
                className="bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
              >
                {passwordSaving ? 'Updating…' : 'Update password'}
              </button>
            </>
          ) : (
            <div className="max-w-lg bg-background border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm">
                To manage your password, visit your{' '}
                <span className="text-white font-medium">Google Account</span> settings at
                myaccount.google.com.
              </p>
            </div>
          )}
        </div>

        {/* ── Delete Account ── */}
        <div className="bg-surface border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Delete account</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Permanently remove your account and all associated data. This cannot be undone.
              </p>
            </div>
          </div>

          {!deleteOpen ? (
            <button
              onClick={openDeleteCard}
              className="text-sm font-medium px-5 py-2 rounded-lg border border-red-700/50 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete my account
            </button>
          ) : (
            <div className="space-y-4 max-w-lg">
              {/* Wallet warning */}
              {walletBalance !== null && walletBalance > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-amber-400 text-sm font-medium">Wallet balance will be forfeited</p>
                  <p className="text-amber-300/80 text-xs mt-1">
                    You have <span className="font-semibold">${walletBalance.toFixed(2)}</span> in your wallet.
                    These funds will be returned to the platform when your account is deleted.
                    Please withdraw before proceeding.
                  </p>
                </div>
              )}

              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-300 text-xs leading-relaxed">
                  {mode === 'affiliate'
                    ? 'All your data will be permanently deleted — including your profile and affiliate link. Any unpaid commissions will be forfeited upon deletion.'
                    : mode === 'seller'
                    ? 'All your data will be permanently deleted — profile, active posts, and wallet history. Active orders must be completed before deletion.'
                    : 'All your data will be permanently deleted — profile, order history, and saved items. Active orders must be completed before deletion.'}
                </p>
              </div>

              {/* Password re-auth (email users) */}
              {isEmailProvider && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      type={deleteShowPassword ? 'text' : 'password'}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 pr-11 rounded-lg focus:outline-none focus:border-red-500/60 transition-colors placeholder-slate-500"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setDeleteShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {deleteShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Type DELETE */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Type <span className="text-white font-mono">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-4 py-2 rounded-lg focus:outline-none focus:border-red-500/60 transition-colors placeholder-slate-500"
                  placeholder="DELETE"
                />
              </div>

              {deleteMsg && (
                <p className="text-sm text-red-400">{deleteMsg}</p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || deleteConfirmText !== 'DELETE' || (isEmailProvider && !deletePassword)}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                >
                  {deleteLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Permanently delete account</>
                  )}
                </button>
                <button
                  onClick={() => { setDeleteOpen(false); setDeleteMsg(null); }}
                  disabled={deleteLoading}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
};

export default SettingsTab;
