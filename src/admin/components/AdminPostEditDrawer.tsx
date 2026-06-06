import { useEffect, useState, useRef } from 'react';
import { X, Plus, Trash2, Upload, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { ref as dbRef, get, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from '../../firebase';
import { type AdminService } from './AdminServicesTable';
import { useCategories } from '../../CategoriesContext';

interface Props {
  service: AdminService;
  onClose: () => void;
  onSuccess: (updated: AdminService) => void;
}

const PRICE_TYPES = [
  { value: 'per_project', label: 'Per Project' },
  { value: 'per_hour',    label: 'Per Hour' },
] as const;

const STATUS_OPTIONS = [
  { value: 'active',  label: 'Active' },
  { value: 'paused',  label: 'Paused' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-medium text-slate-400 mb-1.5">{children}</label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors ${props.className ?? ''}`}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors appearance-none ${props.className ?? ''}`}
  />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`w-full bg-surface-raised border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors resize-none ${props.className ?? ''}`}
  />
);

export default function AdminPostEditDrawer({ service, onClose, onSuccess }: Props) {
  const { categoryOptions, subcategoryMap } = useCategories();

  const [title,          setTitle]          = useState(service.title ?? '');
  const [description,    setDescription]    = useState(service.description ?? '');
  const [category,       setCategory]       = useState(service.category ?? '');
  const [subcategory,    setSubcategory]    = useState(service.subcategory ?? '');
  const [priceMin,       setPriceMin]       = useState(String(service.priceMin ?? service.price ?? ''));
  const [priceMax,       setPriceMax]       = useState(service.priceMax != null ? String(service.priceMax) : '');
  const [priceType,      setPriceType]      = useState<'per_project' | 'per_hour'>(service.priceType ?? 'per_project');
  const [status,         setStatus]         = useState(service.status ?? 'active');
  const [existingImages, setExistingImages] = useState<string[]>(service.images ?? (service.imageUrl ? [service.imageUrl] : []));
  const [primaryLocation, setPrimaryLocation] = useState(service.primaryLocation ?? '');
  const [extraLocations, setExtraLocations]   = useState<string[]>(service.extraLocations ?? []);
  const [offeredRemotely, setOfferedRemotely] = useState(service.offeredRemotely ?? false);
  const [languages,      setLanguages]      = useState<string[]>(service.languages ?? []);

  const [locationInput, setLocationInput]   = useState('');
  const [languageInput, setLanguageInput]   = useState('');
  const [newFiles,      setNewFiles]        = useState<File[]>([]);
  const [newPreviews,   setNewPreviews]     = useState<string[]>([]);
  const [saving,        setSaving]          = useState(false);
  const [error,         setError]           = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawerRef    = useRef<HTMLDivElement>(null);

  const subcategoryOptions = subcategoryMap[category] ?? [];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setNewFiles((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setNewPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const removeExisting = (url: string) => setExistingImages((prev) => prev.filter((u) => u !== url));
  const removeNew      = (i: number) => {
    setNewFiles((prev) => prev.filter((_, idx) => idx !== i));
    setNewPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addLocation = () => {
    const v = locationInput.trim();
    if (v && !extraLocations.includes(v)) setExtraLocations((prev) => [...prev, v]);
    setLocationInput('');
  };

  const addLanguage = () => {
    const v = languageInput.trim();
    if (v && !languages.includes(v)) setLanguages((prev) => [...prev, v]);
    setLanguageInput('');
  };

  const handleSave = async () => {
    const parsedMin = parseFloat(priceMin);
    const parsedMax = priceMax ? parseFloat(priceMax) : null;

    if (!title.trim()) { setError('Title is required.'); return; }
    if (isNaN(parsedMin) || parsedMin < 0) { setError('Price Min must be a valid non-negative number.'); return; }
    if (parsedMax !== null && parsedMax < parsedMin) { setError('Price Max must be greater than Price Min.'); return; }

    setError(null);
    setSaving(true);

    try {
      // Upload new images
      const uploadedURLs: string[] = [];
      for (const file of newFiles) {
        const path = `services/${service.id}/${Date.now()}_${file.name}`;
        const snap = await uploadBytes(storageRef(storage, path), file);
        const url  = await getDownloadURL(snap.ref);
        uploadedURLs.push(url);
      }

      const allImages = [...existingImages, ...uploadedURLs];

      await update(dbRef(database, `services/${service.id}`), {
        title:          title.trim(),
        description:    description.trim(),
        category,
        subcategory,
        priceMin:       parsedMin,
        priceMax:       parsedMax,
        priceType,
        status,
        images:         allImages,
        primaryLocation: primaryLocation.trim(),
        extraLocations,
        offeredRemotely,
        languages,
      });

      const fresh = (await get(dbRef(database, `services/${service.id}`))).val() as Record<string, unknown>;
      const imgs  = Array.isArray(fresh?.images) ? (fresh.images as string[]) : [];

      onSuccess({
        ...service,
        title:          String(fresh?.title         ?? ''),
        description:    String(fresh?.description   ?? ''),
        category:       String(fresh?.category      ?? ''),
        subcategory:    String(fresh?.subcategory   ?? ''),
        price:          Number(fresh?.priceMin      ?? fresh?.price ?? 0),
        priceMin:       Number(fresh?.priceMin      ?? 0),
        priceMax:       fresh?.priceMax != null ? Number(fresh.priceMax) : null,
        priceType:      (fresh?.priceType as 'per_project' | 'per_hour') ?? 'per_project',
        status:         String(fresh?.status        ?? 'active'),
        images:         imgs,
        imageUrl:       imgs[0] ?? null,
        primaryLocation: String(fresh?.primaryLocation ?? ''),
        extraLocations: Array.isArray(fresh?.extraLocations) ? (fresh.extraLocations as string[]) : [],
        offeredRemotely: Boolean(fresh?.offeredRemotely),
        languages:      Array.isArray(fresh?.languages) ? (fresh.languages as string[]) : [],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-screen w-full max-w-xl bg-surface border-l border-slate-700 z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Edit Post</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[340px]">{service.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Category / Subcategory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Category</FieldLabel>
              <div className="relative">
                <Select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}>
                  <option value="">Select…</option>
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <FieldLabel>Subcategory</FieldLabel>
              <div className="relative">
                <Select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category}>
                  <option value="">Select…</option>
                  {subcategoryOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <FieldLabel>Title</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Post title…" />
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description</FieldLabel>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the service…" />
          </div>

          {/* Pricing */}
          <div>
            <FieldLabel>Pricing</FieldLabel>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Input type="number" min="0" step="0.01" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Min $" />
              </div>
              <div>
                <Input type="number" min="0" step="0.01" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Max $ (opt)" />
              </div>
              <div className="relative">
                <Select value={priceType} onChange={(e) => setPriceType(e.target.value as 'per_project' | 'per_hour')}>
                  {PRICE_TYPES.map((pt) => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                </Select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <FieldLabel>Status</FieldLabel>
            <div className="relative">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Images */}
          <div>
            <FieldLabel>Images / Video</FieldLabel>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {existingImages.map((url) => (
                <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeExisting(url)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
              {newPreviews.map((prev, i) => (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-blue-500/40">
                  <img src={prev} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeNew(i)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-slate-700 hover:border-blue-500/50 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors"
              >
                <Upload className="w-5 h-5" />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
            <p className="text-xs text-slate-600">Hover an image and click the trash icon to remove it.</p>
          </div>

          {/* Primary Location */}
          <div>
            <FieldLabel>Primary Location</FieldLabel>
            <Input value={primaryLocation} onChange={(e) => setPrimaryLocation(e.target.value)} placeholder="City, State or full address…" />
          </div>

          {/* Extra Locations */}
          <div>
            <FieldLabel>Additional Locations</FieldLabel>
            <div className="flex gap-2 mb-2">
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLocation()}
                placeholder="Add a location…"
              />
              <button
                onClick={addLocation}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {extraLocations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {extraLocations.map((loc) => (
                  <span key={loc} className="flex items-center gap-1.5 text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                    {loc}
                    <button onClick={() => setExtraLocations((p) => p.filter((l) => l !== loc))} className="hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Offered Remotely */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-white">Offered Remotely</p>
              <p className="text-xs text-slate-500 mt-0.5">Can this service be done online?</p>
            </div>
            <button
              type="button"
              onClick={() => setOfferedRemotely((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${offeredRemotely ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${offeredRemotely ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Languages */}
          <div>
            <FieldLabel>Languages</FieldLabel>
            <div className="flex gap-2 mb-2">
              <Input
                value={languageInput}
                onChange={(e) => setLanguageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLanguage()}
                placeholder="e.g. English, Spanish…"
              />
              <button
                onClick={addLanguage}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {languages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {languages.map((lang) => (
                  <span key={lang} className="flex items-center gap-1.5 text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                    {lang}
                    <button onClick={() => setLanguages((p) => p.filter((l) => l !== lang))} className="hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-800 bg-surface flex-shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
