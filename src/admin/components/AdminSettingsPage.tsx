import { useState, useEffect, useCallback } from 'react';
import {
  Globe, DollarSign, UserPlus, Save,
  CheckCircle2, AlertTriangle, Loader2,
  Info, FileText, Shield, Plus, Pencil, Trash2, X,
} from 'lucide-react';
import { ref as dbRef, get, update, set } from 'firebase/database';
import { database } from '../../firebase';
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

interface FaqItem { id: string; question: string; answer: string }
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
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const FieldLabel = ({ label, hint, htmlFor }: { label: string; hint?: string; htmlFor?: string }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-white">{label}</label>
    {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

const TextInput = ({ id, value, onChange, placeholder = '', type = 'text' }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) => (
  <input
    id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full bg-surface-raised border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors"
  />
);

const NumberInput = ({ id, value, onChange, min, max, step = 1, prefix, suffix }: {
  id: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; prefix?: string; suffix?: string;
}) => (
  <div className="relative flex items-center">
    {prefix && <span className="absolute left-3 text-slate-400 text-sm select-none">{prefix}</span>}
    <input
      id={id} type="number" value={value} min={min} max={max} step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={`w-full bg-surface-raised border border-slate-700/60 rounded-lg py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors ${prefix ? 'pl-7 pr-3' : suffix ? 'pl-3 pr-9' : 'px-3'}`}
    />
    {suffix && <span className="absolute right-3 text-slate-400 text-sm select-none">{suffix}</span>}
  </div>
);

const SettingRow = ({ label, hint, htmlFor, children, last = false }: {
  label: string; hint?: string; htmlFor?: string; children: React.ReactNode; last?: boolean;
}) => (
  <div className={`flex items-center justify-between gap-6 ${!last ? 'pb-5 border-b border-slate-800/70' : ''}`}>
    <FieldLabel label={label} hint={hint} htmlFor={htmlFor} />
    <div className="flex-shrink-0 w-56">{children}</div>
  </div>
);

interface CardProps {
  icon: React.ElementType; iconColor: string; title: string; description: string;
  children: React.ReactNode; status: SectionStatus; onSave: () => void;
}

const SettingCard = ({ icon: Icon, iconColor, title, description, children, status, onSave }: CardProps) => (
  <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
    <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon style={{ width: '1.1rem', height: '1.1rem' }} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
    <div className="px-6 py-5 space-y-5">{children}</div>
    <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
      <div className="h-5">
        {status.error && (
          <span className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />{status.error}
          </span>
        )}
        {status.saved && !status.error && (
          <span className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />Changes saved
          </span>
        )}
      </div>
      <button
        onClick={onSave} disabled={status.saving}
        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {status.saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save</>}
      </button>
    </div>
  </div>
);

const SkeletonCard = () => (
  <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden animate-pulse">
    <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-slate-800" />
      <div className="space-y-1.5"><div className="h-3.5 bg-slate-800 rounded w-32" /><div className="h-3 bg-slate-800 rounded w-52" /></div>
    </div>
    <div className="px-6 py-5 space-y-6">
      {[1,2,3].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="space-y-1.5"><div className="h-3.5 bg-slate-800 rounded w-28" /><div className="h-3 bg-slate-800 rounded w-44" /></div>
          <div className="h-9 bg-slate-800 rounded-lg w-56" />
        </div>
      ))}
    </div>
  </div>
);

// ─── Tab types ────────────────────────────────────────────────────────────────

type SettingsTab = 'platform' | 'cms' | 'admin';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'platform', label: 'Platform' },
  { key: 'cms',      label: 'CMS' },
  { key: 'admin',    label: 'Admin' },
];

// ─── CMS Tab ──────────────────────────────────────────────────────────────────

function CmsTab() {
  const { user } = useAuth();
  const [faqs,    setFaqs]    = useState<FaqItem[]>([]);
  const [terms,   setTerms]   = useState('');
  const [privacy, setPrivacy] = useState('');
  const [loading, setLoading] = useState(true);
  const [faqSaving, setFaqSaving]     = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [privSaving, setPrivSaving]   = useState(false);
  const [faqSaved, setFaqSaved]       = useState(false);
  const [termsSaved, setTermsSaved]   = useState(false);
  const [privSaved, setPrivSaved]     = useState(false);

  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await get(dbRef(database, 'cms'));
        if (cancelled) return;
        const d = snap.val() ?? {};
        if (d.faqs) setFaqs(Object.entries(d.faqs as Record<string, { question: string; answer: string }>).map(([id, v]) => ({ id, ...v })));
        if (d.terms)   setTerms(d.terms);
        if (d.privacy) setPrivacy(d.privacy);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const saveFaq = async () => {
    if (!faqQ.trim() || !faqA.trim()) return;
    setFaqSaving(true);
    try {
      if (editingFaq) {
        await update(dbRef(database, `cms/faqs/${editingFaq.id}`), { question: faqQ.trim(), answer: faqA.trim() });
        setFaqs((prev) => prev.map((f) => f.id === editingFaq.id ? { ...f, question: faqQ.trim(), answer: faqA.trim() } : f));
      } else {
        const newRef = dbRef(database, `cms/faqs/${Date.now()}`);
        await set(newRef, { question: faqQ.trim(), answer: faqA.trim() });
        setFaqs((prev) => [...prev, { id: String(Date.now()), question: faqQ.trim(), answer: faqA.trim() }]);
      }
      setFaqQ(''); setFaqA(''); setEditingFaq(null);
      setFaqSaved(true);
      setTimeout(() => setFaqSaved(false), 3000);
    } finally { setFaqSaving(false); }
  };

  const deleteFaq = async (id: string) => {
    await set(dbRef(database, `cms/faqs/${id}`), null);
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  };

  const saveText = async (key: 'terms' | 'privacy', value: string, setSaving: (v: boolean) => void, setSaved: (v: boolean) => void) => {
    setSaving(true);
    try {
      await set(dbRef(database, `cms/${key}`), value);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* FAQs */}
      <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">
            <FileText style={{ width: '1.1rem', height: '1.1rem' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">FAQs</h3>
            <p className="text-xs text-slate-500 mt-0.5">Manage frequently asked questions</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          {faqs.map((f) => (
            <div key={f.id} className="bg-surface-raised rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{f.question}</p>
                  <p className="text-xs text-slate-500 mt-1">{f.answer}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditingFaq(f); setFaqQ(f.question); setFaqA(f.answer); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteFaq(f.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-slate-400">{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</p>
            <input value={faqQ} onChange={(e) => setFaqQ(e.target.value)} placeholder="Question…" className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors" />
            <textarea value={faqA} onChange={(e) => setFaqA(e.target.value)} placeholder="Answer…" rows={3} className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors resize-none" />
            <div className="flex gap-2">
              <button onClick={saveFaq} disabled={faqSaving} className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {faqSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {editingFaq ? 'Update' : 'Add'}
              </button>
              {editingFaq && (
                <button onClick={() => { setEditingFaq(null); setFaqQ(''); setFaqA(''); }} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
              )}
              {faqSaved && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <FileText style={{ width: '1.1rem', height: '1.1rem' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Terms &amp; Conditions</h3>
            <p className="text-xs text-slate-500 mt-0.5">Displayed on /terms</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={10} placeholder="Enter your Terms & Conditions…" className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors resize-none" />
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          {termsSaved ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span> : <span />}
          <button onClick={() => saveText('terms', terms, setTermsSaving, setTermsSaved)} disabled={termsSaving} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {termsSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
      </div>

      {/* Privacy Policy */}
      <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Shield style={{ width: '1.1rem', height: '1.1rem' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Privacy Policy</h3>
            <p className="text-xs text-slate-500 mt-0.5">Displayed on /privacy</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <textarea value={privacy} onChange={(e) => setPrivacy(e.target.value)} rows={10} placeholder="Enter your Privacy Policy…" className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors resize-none" />
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          {privSaved ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span> : <span />}
          <button onClick={() => saveText('privacy', privacy, setPrivSaving, setPrivSaved)} disabled={privSaving} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {privSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const BLANK_STATUS: SectionStatus = { saving: false, saved: false, error: '' };

const AdminSettingsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('platform');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [general, setGeneral] = useState<GeneralSettings>({
    platformName: 'Gigspace', tagline: '', supportEmail: '', maintenanceMode: false,
  });
  const [fees, setFees] = useState<FeeSettings>({ platformFeePercent: 5, minimumWithdrawal: 10 });
  const [registration, setRegistration] = useState<RegistrationSettings>({
    allowNewSignups: true, allowSellerRegistrations: true, requireEmailVerification: false,
  });
  const [status, setStatus] = useState<Record<SectionKey, SectionStatus>>({
    general: { ...BLANK_STATUS }, fees: { ...BLANK_STATUS }, registration: { ...BLANK_STATUS },
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await get(dbRef(database, 'settings'));
        if (cancelled) return;
        const data = (snap.val() ?? {}) as Partial<{ general: GeneralSettings; fees: FeeSettings; registration: RegistrationSettings }>;
        if (data.general)      setGeneral((g) => ({ ...g, ...data.general }));
        if (data.fees)         setFees((f) => ({ ...f, ...data.fees }));
        if (data.registration) setRegistration((r) => ({ ...r, ...data.registration }));
      } catch { if (!cancelled) setFetchError('Failed to load settings. Showing defaults.'); }
      finally  { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const saveSection = useCallback(async (section: SectionKey, data: object) => {
    if (!user) return;
    if (section === 'fees') {
      const f = data as FeeSettings;
      if (isNaN(f.platformFeePercent) || f.platformFeePercent < 0 || f.platformFeePercent > 50) {
        setStatus((s) => ({ ...s, fees: { saving: false, saved: false, error: 'Platform fee must be 0–50%' } }));
        return;
      }
      if (isNaN(f.minimumWithdrawal) || f.minimumWithdrawal < 1) {
        setStatus((s) => ({ ...s, fees: { saving: false, saved: false, error: 'Minimum withdrawal must be at least $1' } }));
        return;
      }
    }
    setStatus((s) => ({ ...s, [section]: { saving: true, saved: false, error: '' } }));
    try {
      const sectionRef = dbRef(database, `settings/${section}`);
      await update(sectionRef, data as Record<string, unknown>);
      const fresh = (await get(sectionRef)).val() ?? {};
      if (section === 'general')      setGeneral((g) => ({ ...g, ...(fresh as Partial<GeneralSettings>) }));
      if (section === 'fees')         setFees((f) => ({ ...f, ...(fresh as Partial<FeeSettings>) }));
      if (section === 'registration') setRegistration((r) => ({ ...r, ...(fresh as Partial<RegistrationSettings>) }));
      setStatus((s) => ({ ...s, [section]: { saving: false, saved: true, error: '' } }));
      setTimeout(() => setStatus((s) => ({ ...s, [section]: { ...s[section], saved: false } })), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setStatus((s) => ({ ...s, [section]: { saving: false, saved: false, error: msg } }));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="mb-6"><div className="h-5 bg-slate-800 rounded w-24 animate-pulse" /><div className="h-3.5 bg-slate-800 rounded w-56 mt-2 animate-pulse" /></div>
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="mb-2">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage platform-wide configuration</p>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg px-4 py-3 border border-amber-500/20 mb-2">
          <Info className="w-4 h-4 flex-shrink-0" />{fetchError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Platform tab */}
      {activeTab === 'platform' && (
        <div className="space-y-5">
          <SettingCard icon={Globe} iconColor="bg-blue-500/10 text-blue-400" title="Platform Information" description="General details shown across the platform" status={status.general} onSave={() => saveSection('general', general)}>
            <SettingRow label="Platform Name" hint="Displayed in the browser tab and emails" htmlFor="platformName">
              <TextInput id="platformName" value={general.platformName} onChange={(v) => setGeneral((g) => ({ ...g, platformName: v }))} placeholder="Gigspace" />
            </SettingRow>
            <SettingRow label="Tagline" hint="Short description shown on the landing page hero" htmlFor="tagline">
              <TextInput id="tagline" value={general.tagline} onChange={(v) => setGeneral((g) => ({ ...g, tagline: v }))} placeholder="Find the perfect freelance service" />
            </SettingRow>
            <SettingRow label="Support Email" hint="Where users can reach your support team" htmlFor="supportEmail">
              <TextInput id="supportEmail" type="email" value={general.supportEmail} onChange={(v) => setGeneral((g) => ({ ...g, supportEmail: v }))} placeholder="support@gigspace.com" />
            </SettingRow>
            <SettingRow label="Maintenance Mode" hint="Blocks access for non-admin users while you make updates" last>
              <div className="flex items-center gap-3">
                <Toggle id="maintenanceMode" checked={general.maintenanceMode} onChange={(v) => setGeneral((g) => ({ ...g, maintenanceMode: v }))} />
                <span className={`text-xs font-medium ${general.maintenanceMode ? 'text-amber-400' : 'text-slate-500'}`}>{general.maintenanceMode ? 'Active' : 'Off'}</span>
              </div>
            </SettingRow>
          </SettingCard>

          <SettingCard icon={DollarSign} iconColor="bg-emerald-500/10 text-emerald-400" title="Fees &amp; Payments" description="Controls how the platform charges on each transaction" status={status.fees} onSave={() => saveSection('fees', fees)}>
            <SettingRow label="Platform Fee" hint="Percentage deducted from each completed payment (0–50%)" htmlFor="platformFee">
              <NumberInput id="platformFee" value={fees.platformFeePercent} onChange={(v) => setFees((f) => ({ ...f, platformFeePercent: v }))} min={0} max={50} step={0.5} suffix="%" />
            </SettingRow>
            <SettingRow label="Minimum Withdrawal" hint="Smallest amount a seller can withdraw at once" htmlFor="minWithdrawal" last>
              <NumberInput id="minWithdrawal" value={fees.minimumWithdrawal} onChange={(v) => setFees((f) => ({ ...f, minimumWithdrawal: v }))} min={1} step={1} prefix="$" />
            </SettingRow>
          </SettingCard>

          <SettingCard icon={UserPlus} iconColor="bg-purple-500/10 text-purple-400" title="User Registration" description="Control how new users can join the platform" status={status.registration} onSave={() => saveSection('registration', registration)}>
            <SettingRow label="Allow New Signups" hint="When off, no new accounts can be created">
              <div className="flex items-center gap-3">
                <Toggle id="allowNewSignups" checked={registration.allowNewSignups} onChange={(v) => setRegistration((r) => ({ ...r, allowNewSignups: v }))} />
                <span className={`text-xs font-medium ${registration.allowNewSignups ? 'text-emerald-400' : 'text-slate-500'}`}>{registration.allowNewSignups ? 'Enabled' : 'Disabled'}</span>
              </div>
            </SettingRow>
            <SettingRow label="Allow Seller Registrations" hint="When off, new users can only sign up as buyers">
              <div className="flex items-center gap-3">
                <Toggle id="allowSellerRegistrations" checked={registration.allowSellerRegistrations} onChange={(v) => setRegistration((r) => ({ ...r, allowSellerRegistrations: v }))} disabled={!registration.allowNewSignups} />
                <span className={`text-xs font-medium ${registration.allowSellerRegistrations && registration.allowNewSignups ? 'text-emerald-400' : 'text-slate-500'}`}>{registration.allowSellerRegistrations ? 'Enabled' : 'Disabled'}</span>
              </div>
            </SettingRow>
            <SettingRow label="Require Email Verification" hint="New accounts must verify their email before accessing the platform" last>
              <div className="flex items-center gap-3">
                <Toggle id="requireEmailVerification" checked={registration.requireEmailVerification} onChange={(v) => setRegistration((r) => ({ ...r, requireEmailVerification: v }))} />
                <span className={`text-xs font-medium ${registration.requireEmailVerification ? 'text-emerald-400' : 'text-slate-500'}`}>{registration.requireEmailVerification ? 'Required' : 'Optional'}</span>
              </div>
            </SettingRow>
          </SettingCard>
        </div>
      )}

      {/* CMS tab */}
      {activeTab === 'cms' && <CmsTab />}

      {/* Admin tab */}
      {activeTab === 'admin' && (
        <div className="bg-surface rounded-xl border border-slate-800 px-6 py-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-slate-800/60 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-slate-400" style={{ width: '1.1rem', height: '1.1rem' }} />
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
      )}
    </div>
  );
};

export default AdminSettingsPage;
