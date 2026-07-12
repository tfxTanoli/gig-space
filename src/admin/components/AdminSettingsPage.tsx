import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe, DollarSign, UserPlus, Save,
  CheckCircle2, AlertTriangle, Loader2,
  Info, FileText, Shield, Plus, Pencil, Trash2, X,
  Mail, KeyRound, Clock, Users, List, ListOrdered,
} from 'lucide-react';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import { toast } from 'sonner';
import { ref as dbRef, get, update, set } from 'firebase/database';
import { database, auth } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { sanitizeHtml } from '../../utils/sanitize';
import { adminGetAdmins, adminInviteAdmin, adminRevokeAdmin, type AdminInvite } from '../adminApi';

// Map a Firebase reauth error to a friendly message.
const credError = (err: unknown, fallback: string) => {
  const m = err instanceof Error ? err.message : '';
  if (m.includes('wrong-password') || m.includes('invalid-credential') || m.includes('INVALID_LOGIN_CREDENTIALS')) {
    return 'Current password is incorrect.';
  }
  if (m.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
  if (m.includes('email-already-in-use')) return 'That email is already in use by another account.';
  return fallback;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneralSettings {
  platformName: string;
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
}) => {
  // Hold the raw text so the field can be transiently empty (e.g. while the user
  // clears "5" to type "10"). The numeric prop is only pushed up for valid values.
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  // Adopt external changes (load/save/reset) only when the user isn't editing,
  // so live typing is never clobbered.
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    if (raw === '' || raw === '-' || raw === '.') return; // transient — keep last valid number
    const n = parseFloat(raw);
    if (!isNaN(n)) onChange(n);
  };

  const handleBlur = () => {
    focused.current = false;
    const n = parseFloat(text);
    setText(isNaN(n) ? String(value) : String(n)); // revert empty/invalid to last valid value
  };

  return (
    <div className="relative flex items-center">
      {prefix && <span className="absolute left-3 text-slate-400 text-sm select-none">{prefix}</span>}
      <input
        id={id} type="number" inputMode="decimal" value={text} min={min} max={max} step={step}
        onFocus={() => { focused.current = true; }}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full bg-surface-raised border border-slate-700/60 rounded-lg py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors ${prefix ? 'pl-7 pr-3' : suffix ? 'pl-3 pr-9' : 'px-3'}`}
      />
      {suffix && <span className="absolute right-3 text-slate-400 text-sm select-none">{suffix}</span>}
    </div>
  );
};

const SettingRow = ({ label, hint, htmlFor, children, last = false, wide = false }: {
  label: string; hint?: string; htmlFor?: string; children: React.ReactNode; last?: boolean; wide?: boolean;
}) => (
  <div className={`flex items-center justify-between gap-6 ${!last ? 'pb-5 border-b border-slate-800/70' : ''}`}>
    <FieldLabel label={label} hint={hint} htmlFor={htmlFor} />
    <div className={`flex-shrink-0 ${wide ? 'w-72 sm:w-96' : 'w-56'}`}>{children}</div>
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
        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
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

// FAQs are split by audience: the seller landing page reads cms/faqs and the
// affiliate landing page reads cms/affiliateFaqs, so editing one no longer
// changes the other. Each list has its own default seed matching its page.
const SELLER_DEFAULT_FAQS: { question: string; answer: string }[] = [
  { question: 'What can I sell?', answer: 'You can offer any service that falls inside our diverse categories ranging from digital professional services to localized trade work.' },
  { question: 'How much money can I make?', answer: 'Your earning potential is entirely up to you. You set your own prices and determine how much work you want to take on.' },
  { question: 'How much does it cost?', answer: 'Joining and setting up your primary listing is completely free. We charge a flat platform fee on completed orders and optional subscriptions for multiple local reach.' },
  { question: 'How much time will I need to invest?', answer: 'It is highly flexible. You can freelance part-time or scale it to a full-time business. Setup usually takes under 15 minutes.' },
  { question: 'How do I price my service?', answer: 'We recommend reviewing similar services to gauge local/remote market rates. You can always adjust your prices as your profile grows.' },
  { question: 'How do I get paid?', answer: 'Payments are securely held in escrow and released to you upon project approval. You can withdraw directly to your bank account.' },
];

const AFFILIATE_DEFAULT_FAQS: { question: string; answer: string }[] = [
  { question: 'Who can become a Gigspace affiliate?', answer: "Anyone can become a Gigspace affiliate. Whether you're a content creator, blogger, business owner, or just someone with a network, you can earn commissions by referring new clients to Gigspace." },
  { question: 'Do I need to be a Gigspace customer?', answer: "No, you don't need to be a Gigspace customer to join the affiliate program. Simply sign up for a free affiliate account and start sharing your unique referral link." },
  { question: 'How do I join the program?', answer: 'Click the "Become an Affiliate" button, create your free account, and you\'ll get instant access to your unique referral link and a real-time tracking dashboard.' },
  { question: 'What promotion methods are accepted?', answer: 'You can promote Gigspace through social media, blogs, email newsletters, YouTube, podcasts, or any platform where you have an audience. Spam and misleading promotions are not permitted.' },
  { question: 'How do I track my referrals?', answer: 'Your affiliate dashboard provides real-time tracking of clicks, referrals, and earnings so you can see exactly how your link is performing at all times.' },
  { question: 'How do I get paid?', answer: 'Commissions are paid out once the referred job is completed and payment is released. You can withdraw your earnings directly to your bank account.' },
];

type FaqAudience = 'seller' | 'affiliate';
const FAQ_AUDIENCES: { key: FaqAudience; label: string; path: string; hint: string; defaults: { question: string; answer: string }[] }[] = [
  { key: 'seller',    label: 'Seller FAQs',    path: 'cms/faqs',          hint: 'Shown on the seller landing page',    defaults: SELLER_DEFAULT_FAQS },
  { key: 'affiliate', label: 'Affiliate FAQs', path: 'cms/affiliateFaqs', hint: 'Shown on the affiliate landing page', defaults: AFFILIATE_DEFAULT_FAQS },
];

// ─── Rich text editor (CMS Terms / Privacy) ──────────────────────────────────
// Lightweight contentEditable editor with bold / italic / underline / bullet /
// numbered-list controls and a native drag handle (bottom edge) to resize.

// Legacy CMS content was saved as plain text — convert it for the editor.
const textToHtml = (v: string) =>
  /<\/?[a-z][^>]*>/i.test(v)
    ? v
    : v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

const RICH_TEXT_COMMANDS = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];

function RichTextEditor({
  value, onChange, placeholder,
}: { value: string; onChange: (html: string) => void; placeholder: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Set<string>>(new Set());

  // Sync the incoming value into the (uncontrolled) editable div — on the async
  // CMS load finishing, but never while the admin is typing in it.
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const html = textToHtml(value);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const updateActive = () => {
    const s = new Set<string>();
    RICH_TEXT_COMMANDS.forEach((cmd) => {
      try { if (document.queryCommandState(cmd)) s.add(cmd); } catch { /* unsupported */ }
    });
    setActive(s);
  };

  // A cleared contentEditable keeps a stray <br> — normalize that to '' so the
  // public pages correctly fall back to their default copy.
  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange((el.textContent ?? '').trim() ? sanitizeHtml(el.innerHTML) : '');
  };

  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, undefined);
    emit();
    updateActive();
  };

  return (
    <div>
      <div className="flex items-center gap-1 bg-slate-900 border border-b-0 border-slate-700/50 rounded-t-lg px-2 py-1.5">
        {[
          { label: <strong>B</strong>, cmd: 'bold', tip: 'Bold' },
          { label: <em>I</em>, cmd: 'italic', tip: 'Italic' },
          { label: <u>U</u>, cmd: 'underline', tip: 'Underline' },
          { label: <List className="w-4 h-4" />, cmd: 'insertUnorderedList', tip: 'Bullet list' },
          { label: <ListOrdered className="w-4 h-4" />, cmd: 'insertOrderedList', tip: 'Numbered list' },
        ].map(({ label, cmd, tip }) => (
          <button
            key={cmd}
            type="button"
            title={tip}
            onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
            className={`px-2.5 py-1 rounded hover:text-white hover:bg-slate-700 transition-colors text-sm font-mono select-none ${active.has(cmd) ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onKeyUp={updateActive}
        onMouseUp={updateActive}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
          emit();
        }}
        className="w-full min-h-[240px] bg-surface-raised border border-slate-700/50 rounded-b-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 empty:before:content-[attr(data-placeholder)] before:text-slate-500 before:pointer-events-none"
        style={{ resize: 'vertical', overflow: 'auto' }}
      />
    </div>
  );
}

function CmsTab() {
  const { user } = useAuth();
  const [audience, setAudience] = useState<FaqAudience>('seller');
  const [faqsByAudience, setFaqsByAudience] = useState<Record<FaqAudience, FaqItem[]>>({ seller: [], affiliate: [] });
  const [terms,   setTerms]   = useState('');
  const [privacy, setPrivacy] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [faqSaving, setFaqSaving]     = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [privSaving, setPrivSaving]   = useState(false);
  const [faqSaved, setFaqSaved]       = useState(false);
  const [termsSaved, setTermsSaved]   = useState(false);
  const [privSaved, setPrivSaved]     = useState(false);

  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');

  const activeCfg = FAQ_AUDIENCES.find((a) => a.key === audience)!;
  const faqs = faqsByAudience[audience];
  const setFaqs = (updater: (prev: FaqItem[]) => FaqItem[]) =>
    setFaqsByAudience((prev) => ({ ...prev, [audience]: updater(prev[audience]) }));

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const toList = (v: unknown) =>
      v && typeof v === 'object'
        ? Object.entries(v as Record<string, { question: string; answer: string }>).map(([id, f]) => ({ id, ...f }))
        : [];
    (async () => {
      try {
        const snap = await get(dbRef(database, 'cms'));
        if (cancelled) return;
        const d = snap.val() ?? {};
        setFaqsByAudience({ seller: toList(d.faqs), affiliate: toList(d.affiliateFaqs) });
        if (d.terms)   setTerms(d.terms);
        if (d.privacy) setPrivacy(d.privacy);
      } catch (err) {
        if (!cancelled) {
          setLoadError('Failed to load CMS content — check your connection and reload the page.');
          toast.error(err instanceof Error ? err.message : 'Failed to load CMS content');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Switching audience clears any half-finished add/edit so it can't be saved to the wrong list.
  const switchAudience = (key: FaqAudience) => {
    setAudience(key); setEditingFaq(null); setFaqQ(''); setFaqA('');
  };

  const saveFaq = async () => {
    if (!faqQ.trim() || !faqA.trim()) return;
    setFaqSaving(true);
    try {
      if (editingFaq) {
        await update(dbRef(database, `${activeCfg.path}/${editingFaq.id}`), { question: faqQ.trim(), answer: faqA.trim() });
        setFaqs((prev) => prev.map((f) => f.id === editingFaq.id ? { ...f, question: faqQ.trim(), answer: faqA.trim() } : f));
      } else {
        const id = String(Date.now());
        await set(dbRef(database, `${activeCfg.path}/${id}`), { question: faqQ.trim(), answer: faqA.trim() });
        setFaqs((prev) => [...prev, { id, question: faqQ.trim(), answer: faqA.trim() }]);
      }
      setFaqQ(''); setFaqA(''); setEditingFaq(null);
      setFaqSaved(true);
      setTimeout(() => setFaqSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save FAQ');
    } finally { setFaqSaving(false); }
  };

  const deleteFaq = async (id: string) => {
    try {
      await set(dbRef(database, `${activeCfg.path}/${id}`), null);
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete FAQ');
    }
  };

  const seedDefaults = async () => {
    const updates: Record<string, { question: string; answer: string }> = {};
    const seeded: FaqItem[] = [];
    activeCfg.defaults.forEach((f, i) => {
      const id = `${Date.now()}${i}`;
      updates[id] = { question: f.question, answer: f.answer };
      seeded.push({ id, ...f });
    });
    try {
      await update(dbRef(database, activeCfg.path), updates);
      setFaqs((prev) => [...prev, ...seeded]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load default FAQs');
    }
  };

  const saveText = async (key: 'terms' | 'privacy', value: string, setSaving: (v: boolean) => void, setSaved: (v: boolean) => void) => {
    setSaving(true);
    try {
      // Stamp the edit time so the public page can show a real "Last updated" date.
      await update(dbRef(database, 'cms'), { [key]: value, [`${key}UpdatedAt`]: Date.now() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed — check your connection and try again');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-10 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {loadError && (
        <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg px-4 py-3 border border-amber-500/20">
          <Info className="w-4 h-4 flex-shrink-0" />{loadError}
        </div>
      )}

      {/* FAQs */}
      <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">
              <FileText style={{ width: '1.1rem', height: '1.1rem' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">FAQs</h3>
              <p className="text-xs text-slate-500 mt-0.5">{activeCfg.hint}</p>
            </div>
          </div>
          {/* Audience switch — seller vs affiliate FAQs are separate lists. */}
          <div className="flex gap-1 bg-surface-raised border border-slate-800 rounded-lg p-1">
            {FAQ_AUDIENCES.map((a) => (
              <button
                key={a.key}
                onClick={() => switchAudience(a.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  audience === a.key ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {a.label}
              </button>
            ))}
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
          {faqs.length === 0 && (
            <button onClick={seedDefaults} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-sm transition-colors">
              <Plus className="w-3.5 h-3.5" /> Load default FAQs
            </button>
          )}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-slate-400">{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</p>
            <input value={faqQ} onChange={(e) => setFaqQ(e.target.value)} placeholder="Question…" className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors" />
            <textarea value={faqA} onChange={(e) => setFaqA(e.target.value)} placeholder="Answer…" rows={3} className="w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors resize-none" />
            <div className="flex gap-2">
              <button onClick={saveFaq} disabled={faqSaving} className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
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
          <RichTextEditor value={terms} onChange={setTerms} placeholder="Enter your Terms & Conditions…" />
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          {termsSaved ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span> : <span />}
          <button onClick={() => saveText('terms', terms, setTermsSaving, setTermsSaved)} disabled={termsSaving} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
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
          <RichTextEditor value={privacy} onChange={setPrivacy} placeholder="Enter your Privacy Policy…" />
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          {privSaved ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span> : <span />}
          <button onClick={() => saveText('privacy', privacy, setPrivSaving, setPrivSaved)} disabled={privSaving} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {privSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin credentials (Admin tab) ──────────────────────────────────────────────

function AdminCredentialsCard() {
  const current = auth.currentUser;
  const isPasswordProvider = current?.providerData.some((p) => p.providerId === 'password') ?? false;

  const [newEmail, setNewEmail]   = useState(current?.email ?? '');
  const [emailPw,  setEmailPw]    = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  const [curPw,     setCurPw]     = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving,  setPwSaving]  = useState(false);

  const handleEmailUpdate = async () => {
    if (!current?.email) return;
    const email = newEmail.trim().toLowerCase();
    if (!email || email === current.email) { toast.error('Enter a new email address.'); return; }
    if (!emailPw) { toast.error('Enter your current password to confirm.'); return; }
    setEmailSaving(true);
    try {
      const credential = EmailAuthProvider.credential(current.email, emailPw);
      await reauthenticateWithCredential(current, credential);

      // Sends our branded Resend template (not Firebase's default email); the
      // change applies once the recipient clicks the link in it.
      const token = await current.getIdToken();
      const verifyRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/send-email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newEmail: email }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to send verification email.');

      await update(dbRef(database, `users/${current.uid}`), { email, emailVerified: false });
      setEmailPw('');
      toast.success(`Verification email sent to ${email}. Click the link to confirm the change.`);
    } catch (err) {
      const fallback = err instanceof Error && err.message ? err.message : 'Failed to update email. Please try again.';
      toast.error(credError(err, fallback));
    } finally { setEmailSaving(false); }
  };

  const handlePasswordUpdate = async () => {
    if (!current?.email) return;
    if (newPw.length < 6) { toast.error('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { toast.error('New passwords do not match.'); return; }
    setPwSaving(true);
    try {
      const credential = EmailAuthProvider.credential(current.email, curPw);
      await reauthenticateWithCredential(current, credential);
      await updatePassword(current, newPw);
      setCurPw(''); setNewPw(''); setConfirmPw('');
      toast.success('Password updated successfully.');
    } catch (err) {
      toast.error(credError(err, 'Failed to update password. Please try again.'));
    } finally { setPwSaving(false); }
  };

  if (!isPasswordProvider) {
    return (
      <div className="bg-surface rounded-xl border border-slate-800 px-6 py-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          You're signed in with Google, so email/password can't be edited here. Manage your credentials through your Google account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Email */}
      <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Mail style={{ width: '1.1rem', height: '1.1rem' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Admin Email</h3>
            <p className="text-xs text-slate-500 mt-0.5">A confirmation link is sent to the new address before it changes</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 max-w-md">
          <div>
            <label htmlFor="adminEmail" className="block text-xs font-medium text-slate-400 mb-1.5">New email</label>
            <TextInput id="adminEmail" type="email" value={newEmail} onChange={setNewEmail} placeholder="admin@gigspace.com" />
          </div>
          <div>
            <label htmlFor="adminEmailPw" className="block text-xs font-medium text-slate-400 mb-1.5">Current password</label>
            <TextInput id="adminEmailPw" type="password" value={emailPw} onChange={setEmailPw} placeholder="••••••••" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button onClick={handleEmailUpdate} disabled={emailSaving} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {emailSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Save className="w-3.5 h-3.5" /> Update Email</>}
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <KeyRound style={{ width: '1.1rem', height: '1.1rem' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Admin Password</h3>
            <p className="text-xs text-slate-500 mt-0.5">Choose a strong password of at least 6 characters</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 max-w-md">
          <div>
            <label htmlFor="adminCurPw" className="block text-xs font-medium text-slate-400 mb-1.5">Current password</label>
            <TextInput id="adminCurPw" type="password" value={curPw} onChange={setCurPw} placeholder="••••••••" />
          </div>
          <div>
            <label htmlFor="adminNewPw" className="block text-xs font-medium text-slate-400 mb-1.5">New password</label>
            <TextInput id="adminNewPw" type="password" value={newPw} onChange={setNewPw} placeholder="••••••••" />
          </div>
          <div>
            <label htmlFor="adminConfirmPw" className="block text-xs font-medium text-slate-400 mb-1.5">Confirm new password</label>
            <TextInput id="adminConfirmPw" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="••••••••" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button onClick={handlePasswordUpdate} disabled={pwSaving} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {pwSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Update Password</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin invites (Admin tab) ──────────────────────────────────────────────────

function AdminInvitesCard() {
  const [invites, setInvites] = useState<AdminInvite[] | null>(null);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = () => {
    adminGetAdmins()
      .then(({ invites }) => setInvites(invites))
      .catch(() => setInvites([]));
  };
  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) { toast.error('Enter a valid email address.'); return; }
    setInviting(true);
    try {
      const invite = await adminInviteAdmin(e);
      setInvites((prev) => {
        const rest = (prev ?? []).filter((i) => i.email !== invite.email);
        return [invite, ...rest];
      });
      setEmail('');
      toast.success(invite.status === 'accepted'
        ? 'That account already existed — admin access granted immediately.'
        : 'Invite sent. They become an admin the next time they sign in.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally { setInviting(false); }
  };

  const revoke = async (inv: AdminInvite) => {
    if (!window.confirm(`Revoke admin access/invite for ${inv.email}?`)) return;
    try {
      await adminRevokeAdmin(inv.id);
      setInvites((prev) => prev?.filter((i) => i.id !== inv.id) ?? null);
      toast.success('Revoked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke');
    }
  };

  const fmtDate = (ts: number) => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="bg-surface rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
          <Users style={{ width: '1.1rem', height: '1.1rem' }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Admin Users</h3>
          <p className="text-xs text-slate-500 mt-0.5">Invite additional admins by email — they're granted access on their next sign-in</p>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-end gap-2 max-w-lg mb-5">
          <div className="flex-1">
            <label htmlFor="inviteEmail" className="block text-xs font-medium text-slate-400 mb-1.5">Email address</label>
            <input
              id="inviteEmail" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
              placeholder="teammate@gigspace.com"
              className="w-full bg-surface-raised border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors"
            />
          </div>
          <button onClick={handleInvite} disabled={inviting} className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Invite
          </button>
        </div>

        {invites === null ? (
          <div className="py-6 flex justify-center"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : invites.length === 0 ? (
          <p className="text-slate-500 text-sm">No admin invites yet.</p>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-background/40">
                  {['Email', 'Status', 'Invited', ''].map((h) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide ${h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2.5 text-white">{inv.email}</td>
                    <td className="px-4 py-2.5">
                      {inv.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Accepted</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400"><Clock className="w-3 h-3" /> Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{fmtDate(inv.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => revoke(inv)} title="Revoke" className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    platformName: 'Gigspace', supportEmail: '', maintenanceMode: false,
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
            <SettingRow label="Platform Name" hint="Displayed in the browser tab and emails" htmlFor="platformName" wide>
              <TextInput id="platformName" value={general.platformName} onChange={(v) => setGeneral((g) => ({ ...g, platformName: v }))} placeholder="Gigspace" />
            </SettingRow>
            <SettingRow label="Support Email" hint="Where users can reach your support team" htmlFor="supportEmail" wide>
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
            <SettingRow label="Require Email Verification" hint="Email/password sign-ups must verify before access. Google sign-ups are already verified by Google, so they bypass this." last>
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
        <div className="space-y-5">
          <AdminCredentialsCard />
          <AdminInvitesCard />

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
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;
