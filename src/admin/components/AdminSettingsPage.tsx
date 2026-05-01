import { useState, useEffect, useCallback } from 'react';
import {
  Globe, DollarSign, UserPlus, Save,
  CheckCircle2, AlertTriangle, Loader2,
  Info, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneralSettings {
  platformName: string;
  tagline: string;
  supportEmail: string;
  maintenanceMode: boolean;
}

interface FeeSettings {
  platformFeePercent: number;
  minimumWithdrawal: number;
}

interface RegistrationSettings {
  allowNewSignups: boolean;
  allowSellerRegistrations: boolean;
  requireEmailVerification: boolean;
}

type SectionKey = 'general' | 'fees' | 'registration';
interface SectionStatus { saving: boolean; saved: boolean; error: string }

// ─── Primitives ───────────────────────────────────────────────────────────────

const Toggle = ({
  id, checked, onChange, disabled = false,
}: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      checked ? 'bg-blue-600' : 'bg-slate-700'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const FieldLabel = ({
  label, hint, htmlFor,
}: { label: string; hint?: string; htmlFor?: string }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-white">
      {label}
    </label>
    {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

const TextInput = ({
  id, value, onChange, placeholder = '', type = 'text',
}: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
  <input
    id={id}
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full bg-[#1A2035] border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors"
  />
);

const NumberInput = ({
  id, value, onChange, min, max, step = 1, prefix, suffix,
}: {
  id: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; prefix?: string; suffix?: string;
}) => (
  <div className="relative flex items-center">
    {prefix && (
      <span className="absolute left-3 text-slate-400 text-sm select-none">{prefix}</span>
    )}
    <input
      id={id}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full bg-[#1A2035] border border-slate-700/60 rounded-lg py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors ${
        prefix ? 'pl-7 pr-3' : suffix ? 'pl-3 pr-9' : 'px-3'
      }`}
    />
    {suffix && (
      <span className="absolute right-3 text-slate-400 text-sm select-none">{suffix}</span>
    )}
  </div>
);

// ─── Section Row ─────────────────────────────────────────────────────────────

const SettingRow = ({
  label, hint, htmlFor, children, last = false,
}: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode; last?: boolean }) => (
  <div className={`flex items-center justify-between gap-6 ${!last ? 'pb-5 border-b border-slate-800/70' : ''}`}>
    <FieldLabel label={label} hint={hint} htmlFor={htmlFor} />
    <div className="flex-shrink-0 w-56">{children}</div>
  </div>
);

// ─── Section Card ─────────────────────────────────────────────────────────────

interface CardProps {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  children: React.ReactNode;
  status: SectionStatus;
  onSave: () => void;
}

const SettingCard = ({ icon: Icon, iconColor, title, description, children, status, onSave }: CardProps) => (
  <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
    {/* Card header */}
    <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon className="w-4.5 h-4.5" style={{ width: '1.1rem', height: '1.1rem' }} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>

    {/* Fields */}
    <div className="px-6 py-5 space-y-5">{children}</div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
      <div className="h-5">
        {status.error && (
          <span className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {status.error}
          </span>
        )}
        {status.saved && !status.error && (
          <span className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Changes saved
          </span>
        )}
      </div>

      <button
        onClick={onSave}
        disabled={status.saving}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {status.saving
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
          : <><Save className="w-3.5 h-3.5" /> Save</>}
      </button>
    </div>
  </div>
);

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden animate-pulse">
    <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-slate-800" />
      <div className="space-y-1.5">
        <div className="h-3.5 bg-slate-800 rounded w-32" />
        <div className="h-3 bg-slate-800 rounded w-52" />
      </div>
    </div>
    <div className="px-6 py-5 space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-3.5 bg-slate-800 rounded w-28" />
            <div className="h-3 bg-slate-800 rounded w-44" />
          </div>
          <div className="h-9 bg-slate-800 rounded-lg w-56" />
        </div>
      ))}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const BLANK_STATUS: SectionStatus = { saving: false, saved: false, error: '' };

const AdminSettingsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [general,      setGeneral]      = useState<GeneralSettings>({
    platformName: 'Gigspace', tagline: '', supportEmail: '', maintenanceMode: false,
  });
  const [fees,         setFees]         = useState<FeeSettings>({ platformFeePercent: 5, minimumWithdrawal: 10 });
  const [registration, setRegistration] = useState<RegistrationSettings>({
    allowNewSignups: true, allowSellerRegistrations: true, requireEmailVerification: false,
  });

  const [status, setStatus] = useState<Record<SectionKey, SectionStatus>>({
    general:      { ...BLANK_STATUS },
    fees:         { ...BLANK_STATUS },
    registration: { ...BLANK_STATUS },
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.general)      setGeneral(data.general);
        if (data.fees)         setFees(data.fees);
        if (data.registration) setRegistration(data.registration);
      } catch (err) {
        if (!cancelled) setFetchError('Failed to load settings. Showing defaults.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Save section ───────────────────────────────────────────────────────────
  const saveSection = useCallback(async (section: SectionKey, data: object) => {
    if (!user) return;
    setStatus((s) => ({ ...s, [section]: { saving: true, saved: false, error: '' } }));
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section, data }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus((s) => ({ ...s, [section]: { saving: false, saved: false, error: json.error ?? 'Save failed' } }));
        return;
      }
      // Update state from server response
      if (json.general)      setGeneral(json.general);
      if (json.fees)         setFees(json.fees);
      if (json.registration) setRegistration(json.registration);

      setStatus((s) => ({ ...s, [section]: { saving: false, saved: true, error: '' } }));
      // Clear "saved" badge after 4 s
      setTimeout(() => setStatus((s) => ({ ...s, [section]: { ...s[section], saved: false } })), 4000);
    } catch {
      setStatus((s) => ({ ...s, [section]: { saving: false, saved: false, error: 'Network error. Try again.' } }));
    }
  }, [user]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="mb-6">
          <div className="h-5 bg-slate-800 rounded w-24 animate-pulse" />
          <div className="h-3.5 bg-slate-800 rounded w-56 mt-2 animate-pulse" />
        </div>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage platform-wide configuration</p>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg px-4 py-3 border border-amber-500/20 mb-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          {fetchError}
        </div>
      )}

      {/* ── Section 1: Platform Information ── */}
      <SettingCard
        icon={Globe}
        iconColor="bg-blue-500/10 text-blue-400"
        title="Platform Information"
        description="General details shown across the platform"
        status={status.general}
        onSave={() => saveSection('general', general)}
      >
        <SettingRow label="Platform Name" hint="Displayed in the browser tab and emails" htmlFor="platformName">
          <TextInput
            id="platformName"
            value={general.platformName}
            onChange={(v) => setGeneral((g) => ({ ...g, platformName: v }))}
            placeholder="Gigspace"
          />
        </SettingRow>

        <SettingRow label="Tagline" hint="Short description shown on the landing page" htmlFor="tagline">
          <TextInput
            id="tagline"
            value={general.tagline}
            onChange={(v) => setGeneral((g) => ({ ...g, tagline: v }))}
            placeholder="Find the perfect freelance service"
          />
        </SettingRow>

        <SettingRow label="Support Email" hint="Where users can reach your support team" htmlFor="supportEmail">
          <TextInput
            id="supportEmail"
            type="email"
            value={general.supportEmail}
            onChange={(v) => setGeneral((g) => ({ ...g, supportEmail: v }))}
            placeholder="support@gigspace.com"
          />
        </SettingRow>

        <SettingRow
          label="Maintenance Mode"
          hint="Blocks access for non-admin users while you make updates"
          last
        >
          <div className="flex items-center gap-3">
            <Toggle
              id="maintenanceMode"
              checked={general.maintenanceMode}
              onChange={(v) => setGeneral((g) => ({ ...g, maintenanceMode: v }))}
            />
            <span className={`text-xs font-medium ${general.maintenanceMode ? 'text-amber-400' : 'text-slate-500'}`}>
              {general.maintenanceMode ? 'Active' : 'Off'}
            </span>
          </div>
        </SettingRow>
      </SettingCard>

      {/* ── Section 2: Fees & Payments ── */}
      <SettingCard
        icon={DollarSign}
        iconColor="bg-emerald-500/10 text-emerald-400"
        title="Fees & Payments"
        description="Controls how the platform charges on each transaction"
        status={status.fees}
        onSave={() => saveSection('fees', fees)}
      >
        <SettingRow
          label="Platform Fee"
          hint="Percentage deducted from each completed payment"
          htmlFor="platformFee"
        >
          <NumberInput
            id="platformFee"
            value={fees.platformFeePercent}
            onChange={(v) => setFees((f) => ({ ...f, platformFeePercent: v }))}
            min={0}
            max={50}
            step={0.5}
            suffix="%"
          />
        </SettingRow>

        <SettingRow
          label="Minimum Withdrawal"
          hint="Smallest amount a seller can withdraw at once"
          htmlFor="minWithdrawal"
          last
        >
          <NumberInput
            id="minWithdrawal"
            value={fees.minimumWithdrawal}
            onChange={(v) => setFees((f) => ({ ...f, minimumWithdrawal: v }))}
            min={1}
            step={1}
            prefix="$"
          />
        </SettingRow>
      </SettingCard>

      {/* ── Section 3: User Registration ── */}
      <SettingCard
        icon={UserPlus}
        iconColor="bg-purple-500/10 text-purple-400"
        title="User Registration"
        description="Control how new users can join the platform"
        status={status.registration}
        onSave={() => saveSection('registration', registration)}
      >
        <SettingRow
          label="Allow New Signups"
          hint="When off, no new accounts can be created"
        >
          <div className="flex items-center gap-3">
            <Toggle
              id="allowNewSignups"
              checked={registration.allowNewSignups}
              onChange={(v) => setRegistration((r) => ({ ...r, allowNewSignups: v }))}
            />
            <span className={`text-xs font-medium ${registration.allowNewSignups ? 'text-emerald-400' : 'text-slate-500'}`}>
              {registration.allowNewSignups ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingRow>

        <SettingRow
          label="Allow Seller Registrations"
          hint="When off, new users can only sign up as buyers"
        >
          <div className="flex items-center gap-3">
            <Toggle
              id="allowSellerRegistrations"
              checked={registration.allowSellerRegistrations}
              onChange={(v) => setRegistration((r) => ({ ...r, allowSellerRegistrations: v }))}
              disabled={!registration.allowNewSignups}
            />
            <span className={`text-xs font-medium ${registration.allowSellerRegistrations && registration.allowNewSignups ? 'text-emerald-400' : 'text-slate-500'}`}>
              {registration.allowSellerRegistrations ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </SettingRow>

        <SettingRow
          label="Require Email Verification"
          hint="New accounts must verify their email before accessing the platform"
          last
        >
          <div className="flex items-center gap-3">
            <Toggle
              id="requireEmailVerification"
              checked={registration.requireEmailVerification}
              onChange={(v) => setRegistration((r) => ({ ...r, requireEmailVerification: v }))}
            />
            <span className={`text-xs font-medium ${registration.requireEmailVerification ? 'text-emerald-400' : 'text-slate-500'}`}>
              {registration.requireEmailVerification ? 'Required' : 'Optional'}
            </span>
          </div>
        </SettingRow>
      </SettingCard>

      {/* ── Read-only info card ── */}
      <div className="bg-[#111827] rounded-xl border border-slate-800 px-6 py-5 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-slate-800/60 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-slate-400" style={{ width: '1.1rem', height: '1.1rem' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Security &amp; Access</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Admin access is controlled via the <code className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded text-[11px]">role</code> field on user records in the database.
            Set <code className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded text-[11px]">role: "admin"</code> using the Users tab above or via the
            <code className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded text-[11px] mx-1">set-admin</code> script.
            Firebase Auth tokens are verified on every admin API request.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
