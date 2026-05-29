import {
  useState,
  useEffect,
  useRef,
  useCallback,
  startTransition,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  ChevronDown,
  Video as VideoIcon,
  UploadCloud,
  Search,
  X,
  Check,
  List,
  Loader2,
  Eye,
  Pencil,
} from 'lucide-react';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import Logo from './Logo';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, push, set, get } from 'firebase/database';
import { storage, database } from './firebase';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';
import { useCategories } from './CategoriesContext';
import { geocodeLocation, searchLocations, type LocationResult } from './photon';
import { createListingSubscription } from './stripe/paymentHelpers';
import { LANGUAGES } from './data/languages';
import { sanitizeHtml } from './utils/sanitize';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

const TOTAL_STEPS = 9;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

type MediaItem =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File; previewUrl: string };

// ── Stripe card input section rendered inside <Elements> ──────────────────────
const CARD_STYLE = {
  style: {
    base: {
      color: '#e2e8f0',
      fontSize: '14px',
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      '::placeholder': { color: '#475569' },
    },
    invalid: { color: '#f87171' },
  },
};

interface Step8PaymentSectionProps {
  extraLocationCount: number;
  serviceId: string;
  onBack: () => void;
  onSuccess: (subscriptionId: string) => Promise<void>;
}

function Step8PaymentSection({ extraLocationCount, serviceId, onBack, onSuccess }: Step8PaymentSectionProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardName, setCardName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState('');
  const [cardComplete, setCardComplete] = useState({ number: false, expiry: false, cvc: false });

  const total = extraLocationCount * 5;

  const handlePublish = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setPayError('');
    try {
      const { clientSecret, subscriptionId } = await createListingSubscription({
        extraLocationCount,
        serviceId,
      });
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) throw new Error('Card element missing.');
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: { name: cardName },
        },
      });
      if (error) { setPayError(error.message ?? 'Payment failed.'); return; }
      await onSuccess(subscriptionId);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const fieldClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm text-white';
  const stripeWrapClass = 'bg-slate-800 border border-slate-700 rounded-lg px-4 py-3.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors';
  const canPublish = !processing && !!stripe && cardName.trim().length > 0 && cardComplete.number && cardComplete.expiry && cardComplete.cvc;

  return (
    <>
      <div className="w-full h-px bg-slate-800/80 my-8" />
      <div className="space-y-6">
        <div>
          <h2 className="text-white font-semibold mb-2">Payment</h2>
          <p className="text-slate-400 text-sm mb-4">
            Enter your billing information. Your subscription will renew monthly.
          </p>
          <p className="text-white font-semibold mb-6">
            Total: <span className="text-primary">${total}/mo</span>
          </p>
        </div>

        <div>
          <label className="text-white text-sm font-medium block mb-2">Name on card</label>
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder=""
            className={fieldClass}
          />
        </div>

        <div>
          <label className="text-white text-sm font-medium block mb-2">Card number</label>
          <div className={stripeWrapClass}>
            <CardNumberElement options={CARD_STYLE} onChange={e => setCardComplete(p => ({ ...p, number: e.complete }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-white text-sm font-medium block mb-2">Expiration date</label>
            <div className={stripeWrapClass}>
              <CardExpiryElement options={CARD_STYLE} onChange={e => setCardComplete(p => ({ ...p, expiry: e.complete }))} />
            </div>
          </div>
          <div>
            <label className="text-white text-sm font-medium block mb-2">CVC</label>
            <div className={stripeWrapClass}>
              <CardCvcElement options={CARD_STYLE} onChange={e => setCardComplete(p => ({ ...p, cvc: e.complete }))} />
            </div>
          </div>
        </div>

        {payError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            {payError}
          </div>
        )}

        <div className="w-full h-px bg-slate-800 my-6" />
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={onBack}
            disabled={processing}
            className="px-6 py-2.5 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors text-sm"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors text-sm"
          >
            {processing ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</> : 'Publish'}
          </button>
        </div>
      </div>
    </>
  );
}


// ── Main PostService component ────────────────────────────────────────────────
const PostService = () => {
  const { user, userProfile, logout } = useAuth();
  const { categoryOptions, subcategoryMap } = useCategories();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [editId, setEditId] = useState<string | null>(null);
  const [originalCreatedAt, setOriginalCreatedAt] = useState<number>(0);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Step 1 — Category
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const subcategoryRef = useRef<HTMLDivElement>(null);

  // Step 2 — Title & Description (description stored as HTML)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const descriptionRef = useRef<HTMLDivElement>(null);

  // Step 3 — Pricing
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceType, setPriceType] = useState<'per_project' | 'per_hour'>('per_project');

  // Step 4 — Media
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewURL, setVideoPreviewURL] = useState('');
  const [existingVideoURL, setExistingVideoURL] = useState('');
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Step 5 — Primary Location (moved from old step 7)
  const [primaryLocation, setPrimaryLocation] = useState('');
  const [primaryLocationInput, setPrimaryLocationInput] = useState('');
  const [primaryLocationSuggestions, setPrimaryLocationSuggestions] = useState<LocationResult[]>([]);
  const [primaryLocationLoading, setPrimaryLocationLoading] = useState(false);
  const [primaryLocationDropdownOpen, setPrimaryLocationDropdownOpen] = useState(false);
  const primaryLocationContainerRef = useRef<HTMLDivElement>(null);
  const [offeredRemotely, setOfferedRemotely] = useState(false);
  const [primaryLocationIsCountry, setPrimaryLocationIsCountry] = useState(false);

  // Step 6 — Extra Locations
  const [extraLocations, setExtraLocations] = useState<string[]>([]);
  const [extraLocationInput, setExtraLocationInput] = useState('');
  const [extraLocationSuggestions, setExtraLocationSuggestions] = useState<LocationResult[]>([]);
  const [extraLocationLoading, setExtraLocationLoading] = useState(false);
  const [extraLocationDropdownOpen, setExtraLocationDropdownOpen] = useState(false);
  const extraLocationContainerRef = useRef<HTMLDivElement>(null);

  // Step 7 — Languages (moved from old step 5)
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState('');
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const languageContainerRef = useRef<HTMLDivElement>(null);

  // ── Close dropdowns on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
      if (subcategoryRef.current && !subcategoryRef.current.contains(e.target as Node)) setSubcategoryOpen(false);
      if (primaryLocationContainerRef.current && !primaryLocationContainerRef.current.contains(e.target as Node)) setPrimaryLocationDropdownOpen(false);
      if (extraLocationContainerRef.current && !extraLocationContainerRef.current.contains(e.target as Node)) setExtraLocationDropdownOpen(false);
      if (languageContainerRef.current && !languageContainerRef.current.contains(e.target as Node)) setLanguageDropdownOpen(false);
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) setAvatarMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Sync description contenteditable on step enter ─────────────────────────
  useEffect(() => {
    if (step !== 2 || !descriptionRef.current) return;
    descriptionRef.current.innerHTML = description;
    setDescriptionLength(descriptionRef.current.textContent?.length ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Primary location Photon autocomplete ───────────────────────────────────
  useEffect(() => {
    const q = primaryLocationInput.trim();
    if (q.length < 2) { setPrimaryLocationSuggestions([]); setPrimaryLocationLoading(false); return; }
    setPrimaryLocationLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await searchLocations(q, controller.signal);
      if (!controller.signal.aborted) { setPrimaryLocationSuggestions(found); setPrimaryLocationLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [primaryLocationInput]);

  // ── Extra location Photon autocomplete ─────────────────────────────────────
  useEffect(() => {
    const q = extraLocationInput.trim();
    if (q.length < 2) { setExtraLocationSuggestions([]); setExtraLocationLoading(false); return; }
    setExtraLocationLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await searchLocations(q, controller.signal);
      if (!controller.signal.aborted) { setExtraLocationSuggestions(found); setExtraLocationLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [extraLocationInput]);

  // ── Load existing post (edit mode) ─────────────────────────────────────────
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id || !user) return;

    setEditId(id);
    setLoadingEdit(true);

    get(dbRef(database, `services/${id}`))
      .then((snap) => {
        if (!snap.exists()) { navigate('/seller-dashboard'); return; }
        const d = snap.val() as Record<string, unknown>;
        if (d.sellerId !== user.uid) { navigate('/seller-dashboard'); return; }

        setOriginalCreatedAt(Number(d.createdAt ?? 0));
        setCategory(String(d.category ?? ''));
        setSubcategory(String(d.subcategory ?? ''));
        setTitle(String(d.title ?? ''));
        setDescription(String(d.description ?? ''));
        setPriceMin(String(d.priceMin ?? ''));
        setPriceMax(d.priceMax ? String(d.priceMax) : '');
        setPriceType((d.priceType as 'per_project' | 'per_hour') ?? 'per_project');
        setMediaItems(Array.isArray(d.images) ? (d.images as string[]).map((url) => ({ kind: 'existing' as const, url })) : []);
        setExistingVideoURL(String(d.video ?? ''));
        setLanguages(Array.isArray(d.languages) ? (d.languages as string[]) : []);
        setExtraLocations(Array.isArray(d.extraLocations) ? (d.extraLocations as string[]) : []);
        setPrimaryLocation(String(d.primaryLocation ?? ''));
        setOfferedRemotely(Boolean(d.offeredRemotely ?? false));
        setPrimaryLocationIsCountry(Boolean(d.offeredRemotely ?? false));
      })
      .catch(() => navigate('/seller-dashboard'))
      .finally(() => setLoadingEdit(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Media handlers ─────────────────────────────────────────────────────────
  const handleMediaSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const hasExistingVideo = !!(videoPreviewURL || existingVideoURL);
    const totalExisting = mediaItems.length + (hasExistingVideo ? 1 : 0);
    const slotsLeft = 12 - totalExisting;
    if (slotsLeft <= 0) return;

    let newVideo: File | null = null;
    const newImages: File[] = [];
    for (const f of files) {
      if (f.type.startsWith('video/') && !hasExistingVideo && newVideo === null) {
        if (f.size > MAX_VIDEO_BYTES) { setStepError('Video must be under 50 MB.'); continue; }
        newVideo = f;
      } else if (!f.type.startsWith('video/')) {
        newImages.push(f);
      }
    }
    const imageSlots = slotsLeft - (newVideo ? 1 : 0);
    const imagesToAdd = newImages.slice(0, imageSlots);

    startTransition(() => {
      if (newVideo) {
        if (videoPreviewURL) URL.revokeObjectURL(videoPreviewURL);
        setVideoFile(newVideo);
        setVideoPreviewURL(URL.createObjectURL(newVideo));
      }
      if (imagesToAdd.length > 0) {
        setMediaItems((prev) => [
          ...prev,
          ...imagesToAdd.map((f) => ({ kind: 'new' as const, file: f, previewUrl: URL.createObjectURL(f) })),
        ]);
      }
    });
    e.target.value = '';
  };

  const removeMediaItem = (index: number) => {
    setMediaItems((prev) => {
      const item = prev[index];
      if (item.kind === 'new') URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeVideo = () => {
    if (videoPreviewURL) URL.revokeObjectURL(videoPreviewURL);
    setVideoFile(null);
    setVideoPreviewURL('');
    setExistingVideoURL('');
  };

  const handleDragStart = (index: number) => { dragIndexRef.current = index; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (index: number) => {
    if (dragIndexRef.current === null || dragIndexRef.current === index) return;
    setMediaItems((prev) => {
      const next = [...prev];
      const [dragged] = next.splice(dragIndexRef.current!, 1);
      next.splice(index, 0, dragged);
      return next;
    });
    dragIndexRef.current = null;
  };

  // ── Language handlers ──────────────────────────────────────────────────────
  const filteredLanguages = languageInput.trim()
    ? LANGUAGES.filter((l) => l.toLowerCase().includes(languageInput.toLowerCase()) && !languages.includes(l))
    : [];

  const addLanguage = useCallback((lang: string) => {
    setLanguages((prev) => (prev.includes(lang) ? prev : [...prev, lang]));
    setLanguageInput('');
    setLanguageDropdownOpen(false);
  }, []);

  const handleLanguageKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredLanguages.length > 0) addLanguage(filteredLanguages[0]);
    }
    if (e.key === 'Escape') setLanguageDropdownOpen(false);
  };

  // ── Primary location handlers ──────────────────────────────────────────────
  const addPrimaryLocation = (label: string, isCountry = false) => {
    setPrimaryLocation(label);
    setPrimaryLocationIsCountry(isCountry);
    if (!isCountry) setOfferedRemotely(false);
    setPrimaryLocationInput('');
    setPrimaryLocationSuggestions([]);
    setPrimaryLocationDropdownOpen(false);
  };

  const handlePrimaryLocationKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = primaryLocationInput.trim();
      if (val) addPrimaryLocation(val);
    }
    if (e.key === 'Escape') setPrimaryLocationDropdownOpen(false);
  };

  // ── Extra location handlers ────────────────────────────────────────────────
  const addExtraLocation = (label: string) => {
    if (!extraLocations.includes(label)) setExtraLocations((prev) => [...prev, label]);
    setExtraLocationInput('');
    setExtraLocationSuggestions([]);
    setExtraLocationDropdownOpen(false);
  };

  const handleAddExtraLocation = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && extraLocationInput.trim()) {
      e.preventDefault();
      addExtraLocation(extraLocationInput.trim());
    }
  };

  // ── WYSIWYG helpers ────────────────────────────────────────────────────────
  const updateFormats = () => {
    const s = new Set<string>();
    ['bold', 'italic', 'underline', 'insertUnorderedList'].forEach((cmd) => {
      try { if (document.queryCommandState(cmd)) s.add(cmd); } catch {}
    });
    setActiveFormats(s);
  };

  const execFormat = (command: string) => {
    descriptionRef.current?.focus();
    document.execCommand(command, false, undefined);
    updateFormats();
  };

  // ── Upload all media ───────────────────────────────────────────────────────
  const uploadAllMedia = async (): Promise<{ imageUrls: string[]; videoUrl: string | null }> => {
    const imageUrls: string[] = [];
    for (const item of mediaItems) {
      if (item.kind === 'existing') {
        imageUrls.push(item.url);
      } else {
        const ref = storageRef(storage, `serviceImages/${user!.uid}/${Date.now()}_${item.file.name}`);
        await uploadBytes(ref, item.file);
        imageUrls.push(await getDownloadURL(ref));
      }
    }
    let videoUrl: string | null = existingVideoURL || null;
    if (videoFile) {
      const ref = storageRef(storage, `serviceVideos/${user!.uid}/${Date.now()}_${videoFile.name}`);
      await uploadBytes(ref, videoFile);
      videoUrl = await getDownloadURL(ref);
    }
    return { imageUrls, videoUrl };
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    setStepError('');
    if (step === 1 && !category) { setStepError('Please select a category.'); return false; }
    if (step === 2) {
      if (title.trim().length < 20) { setStepError('Title must be at least 20 characters.'); return false; }
      const descText = descriptionRef.current?.textContent?.trim() ?? description.replace(/<[^>]*>/g, '').trim();
      if (descText.length < 150) { setStepError('Please add a description (at least 150 characters).'); return false; }
      if (descText.length > 1000) { setStepError('Description must be 1,000 characters or less.'); return false; }
    }
    if (step === 3) {
      const min = parseInt(priceMin);
      const max = priceMax ? parseInt(priceMax) : null;
      if (!priceMin || isNaN(min) || min < 5) { setStepError('Minimum price must be at least $5.'); return false; }
      if (min > 100000) { setStepError('Minimum price cannot exceed $100,000.'); return false; }
      if (max !== null && !isNaN(max) && max > 100000) { setStepError('Maximum price cannot exceed $100,000.'); return false; }
      if (max !== null && !isNaN(max) && max < min) { setStepError('Maximum price must be greater than or equal to the minimum.'); return false; }
    }
    if (step === 4) {
      const hasVideo = !!(videoPreviewURL || existingVideoURL);
      if (mediaItems.length === 0 && !hasVideo) { setStepError('Please upload at least one image or video.'); return false; }
    }
    if (step === 5 && !primaryLocation.trim()) { setStepError('Please enter a primary location.'); return false; }
    return true;
  };

  // ── Build payload ──────────────────────────────────────────────────────────
  const buildPayload = async (status: 'draft' | 'active', subscriptionId?: string) => {
    let currentDescription = description;
    if (descriptionRef.current) {
      currentDescription = sanitizeHtml(descriptionRef.current.innerHTML);
      setDescription(currentDescription);
    }

    const { imageUrls, videoUrl } = await uploadAllMedia();
    setMediaItems(imageUrls.map((url) => ({ kind: 'existing' as const, url })));
    if (videoUrl && videoUrl !== existingVideoURL) {
      setExistingVideoURL(videoUrl);
      setVideoFile(null);
      if (videoPreviewURL) { URL.revokeObjectURL(videoPreviewURL); setVideoPreviewURL(''); }
    }

    let primaryLocationLat: number | null = null;
    let primaryLocationLng: number | null = null;
    if (primaryLocation.trim()) {
      const coords = await geocodeLocation(primaryLocation.trim());
      if (coords) { primaryLocationLat = coords.lat; primaryLocationLng = coords.lng; }
    }

    return {
      sellerId: user!.uid,
      sellerName: userProfile!.name,
      sellerUsername: userProfile!.username,
      sellerPhotoURL: userProfile!.photoURL,
      title: title.trim(),
      description: currentDescription,
      category,
      subcategory,
      priceMin: parseInt(priceMin) || 0,
      priceMax: priceMax ? (parseInt(priceMax) || null) : null,
      priceType,
      images: imageUrls,
      video: videoUrl,
      languages,
      primaryLocation: primaryLocation.trim(),
      primaryLocationLat,
      primaryLocationLng,
      offeredRemotely,
      extraLocations,
      subscriptionId: subscriptionId ?? null,
      status,
      updatedAt: Date.now(),
    };
  };

  // ── Save step (draft) ──────────────────────────────────────────────────────
  const saveStep = async (andExit = false) => {
    if (!validate()) return;
    if (!user || !userProfile) return;
    setSaving(true);
    setStepError('');
    try {
      const payload = await buildPayload('draft');

      if (editId) {
        await set(dbRef(database, `services/${editId}`), { ...payload, status: 'active', createdAt: originalCreatedAt });
      } else if (draftId) {
        await set(dbRef(database, `services/${draftId}`), { ...payload, createdAt: originalCreatedAt });
      } else {
        const now = Date.now();
        const newRef = push(dbRef(database, 'services'));
        await set(newRef, { ...payload, createdAt: now });
        const id = newRef.key!;
        setDraftId(id);
        setOriginalCreatedAt(now);
        await set(dbRef(database, `users/${user.uid}/posts/${id}`), true);
      }

      if (andExit) navigate('/seller-dashboard');
      else setStep((s) => Math.min(s + 1, 8));
    } catch {
      setStepError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const prevStep = () => {
    setStepError('');
    if (step === 2 && descriptionRef.current) {
      setDescription(sanitizeHtml(descriptionRef.current.innerHTML));
    }
    if (step > 1) setStep((s) => s - 1);
  };

  // ── Publish (called from step 8 — no extra locations, or after Stripe success) ──
  const doPublish = async (subscriptionId?: string) => {
    if (!user || !userProfile) return;
    setPublishing(true);
    setStepError('');
    try {
      const payload = await buildPayload('active', subscriptionId);
      const currentPostId = editId ?? draftId;
      if (currentPostId) {
        await set(dbRef(database, `services/${currentPostId}`), { ...payload, createdAt: originalCreatedAt || Date.now() });
      } else {
        const newPostRef = push(dbRef(database, 'services'));
        await set(newPostRef, { ...payload, createdAt: Date.now() });
        if (newPostRef.key) await set(dbRef(database, `users/${user.uid}/posts/${newPostRef.key}`), true);
      }
      setStep(9);
    } catch {
      setStepError(editId ? 'Failed to update. Please try again.' : 'Failed to publish. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Render steps ───────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ── STEP 1: Category ──────────────────────────────────────────────────
      case 1: {
        const selectedCatLabel = categoryOptions.find((o) => o.value === category)?.label;
        const selectedSubLabel = (subcategoryMap[category] ?? []).find((o) => o.value === subcategory)?.label;
        const subcatOptions = subcategoryMap[category] ?? [];

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-white font-semibold mb-2">Category</h2>
              <p className="text-slate-400 text-sm mb-6">Choose the category and subcategory most suitable for your service.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category dropdown */}
                <div ref={categoryRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryOpen((v) => !v)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm px-4 py-3 flex items-center justify-between focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  >
                    <span className={selectedCatLabel ? 'text-slate-200' : (categoryOpen ? 'text-slate-400' : 'text-slate-500')}>{selectedCatLabel ?? 'Category'}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {categoryOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                      {categoryOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => { setCategory(o.value); setSubcategory(''); setCategoryOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${category === o.value ? 'text-slate-100 bg-slate-700' : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700'}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subcategory dropdown */}
                <div ref={subcategoryRef} className="relative">
                  <button
                    type="button"
                    disabled={!category}
                    onClick={() => setSubcategoryOpen((v) => !v)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm px-4 py-3 flex items-center justify-between focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className={selectedSubLabel ? 'text-slate-200' : (subcategoryOpen ? 'text-slate-400' : 'text-slate-500')}>{selectedSubLabel ?? 'Subcategory'}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${subcategoryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {subcategoryOpen && subcatOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                      {subcatOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => { setSubcategory(o.value); setSubcategoryOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${subcategory === o.value ? 'text-slate-100 bg-slate-700' : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700'}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      // ── STEP 2: Title & Description ───────────────────────────────────────
      case 2:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Post Title</h2>
              <p className="text-slate-400 text-sm mb-4">Write a clear, descriptive title that helps buyers instantly understand what you offer.</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg text-slate-100 px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
              />
              <div className="text-right text-slate-500 text-xs mt-1">{title.length}/80 max</div>
            </div>

            <div className="w-full h-px bg-slate-800/80" />

            <div>
              <h2 className="text-white font-semibold mb-2">Description</h2>
              <p className="text-slate-400 text-sm mb-4">Add a detailed description of your service. Do not include any URLs or web addresses.</p>

              {/* WYSIWYG toolbar */}
              <div className="flex items-center gap-1 mb-0 bg-slate-900 border border-b-0 border-slate-700 rounded-t-lg px-2 py-1.5">
                {[
                  { label: <strong>B</strong>, cmd: 'bold', title: 'Bold' },
                  { label: <em>I</em>, cmd: 'italic', title: 'Italic' },
                  { label: <u>U</u>, cmd: 'underline', title: 'Underline' },
                  { label: <List className="w-4 h-4" />, cmd: 'insertUnorderedList', title: 'Bullet list' },
                ].map(({ label, cmd, title: t }) => (
                  <button
                    key={cmd}
                    type="button"
                    title={t}
                    onMouseDown={(e) => { e.preventDefault(); execFormat(cmd); }}
                    className={`px-2.5 py-1 rounded hover:text-white hover:bg-slate-700 transition-colors text-sm font-mono select-none ${activeFormats.has(cmd) ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Contenteditable description */}
              <div
                ref={descriptionRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => {
                  setDescriptionLength(descriptionRef.current?.textContent?.length ?? 0);
                }}
                onKeyUp={updateFormats}
                onMouseUp={updateFormats}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text/plain');
                  document.execCommand('insertText', false, text);
                  setDescriptionLength(descriptionRef.current?.textContent?.length ?? 0);
                }}
                className="w-full min-h-[180px] bg-slate-800 border border-slate-700 rounded-b-lg text-slate-100 px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                style={{ resize: 'vertical', overflow: 'auto', outline: 'none' }}
              />
              <div className={`text-right text-xs mt-1 ${descriptionLength > 1000 ? 'text-red-400' : 'text-slate-500'}`}>
                {descriptionLength}/1,000 max
              </div>
            </div>
          </div>
        );

      // ── STEP 3: Pricing ───────────────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center mb-2">
                <h2 className="text-white font-semibold mr-2">Price Range</h2>
                {/* Tooltip */}
                <div className="relative group">
                  <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center text-slate-400 text-[10px] cursor-help select-none">i</div>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-300 leading-relaxed shadow-xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    This is your starting price. You can send custom offers to buyers later based on the specific scope and requirements of their project.
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-slate-800 border-b border-r border-slate-700 rotate-45 -mt-1" />
                  </div>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-6">Enter what you would typically charge for this type of service.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Min</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white pl-8 pr-12 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">USD</span>
                  </div>
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Max (optional)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white pl-8 pr-12 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">USD</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {(['per_project', 'per_hour'] as const).map((pt) => (
                  <label key={pt} className="flex items-center cursor-pointer group" onClick={() => setPriceType(pt)}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${priceType === pt ? 'border-primary' : 'border-slate-700 group-hover:border-slate-500'}`}>
                      {priceType === pt && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <span className="text-slate-300 text-sm font-medium group-hover:text-white transition-colors">
                      {pt === 'per_project' ? 'Per Project' : 'Per Hour'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      // ── STEP 4: Media ─────────────────────────────────────────────────────
      case 4: {
        const hasVideo = !!(videoPreviewURL || existingVideoURL);
        const videoSrc = videoPreviewURL || existingVideoURL;
        const totalAssets = mediaItems.length + (hasVideo ? 1 : 0);
        const canAdd = totalAssets < 12;

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-white font-semibold mb-2">Images &amp; Video</h2>
              <p className="text-slate-400 text-sm mb-4">
                Upload up to 12 assets total (images + 1 video) that showcase your services.
              </p>
              <div className="space-y-2 mb-8">
                <div className="flex items-start gap-2 text-slate-400 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Images: ideal 4:3 ratio · Min 500×500 px · Max 100 MB each</span>
                </div>
                <div className="flex items-start gap-2 text-slate-400 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Video: max 1 file · max 50 MB</span>
                </div>
              </div>

              <input ref={mediaInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleMediaSelect} />

              {/* Upload area — shown while slots remain */}
              {canAdd && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    className="w-full border border-dashed border-slate-700 rounded-xl bg-slate-900/50 py-10 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/50 transition-colors"
                  >
                    <UploadCloud className="w-8 h-8 text-primary mb-2" strokeWidth={1.5} />
                    <p className="text-slate-400 text-xs mt-1">
                      <span className="text-primary font-semibold">Upload media</span>
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">{totalAssets}/12 assets used</p>
                  </button>
                </div>
              )}

              {/* Media grid */}
              {(hasVideo || mediaItems.length > 0) && (
                <div className="grid grid-cols-3 gap-3">
                  {/* Video tile — always first, not draggable */}
                  {hasVideo && (
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-black col-span-1">
                      <video src={videoSrc} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <VideoIcon className="w-6 h-6 text-white/70" />
                      </div>
                      <div className="absolute top-1.5 left-1.5 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">Cover</div>
                      <button
                        type="button"
                        onClick={removeVideo}
                        className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  )}

                  {/* Image tiles — draggable, with set-as-cover */}
                  {mediaItems.map((item, i) => {
                    const src = item.kind === 'existing' ? item.url : item.previewUrl;
                    const isCover = !hasVideo && i === 0;
                    return (
                      <div
                        key={i}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(i)}
                        className="group relative aspect-square rounded-lg overflow-hidden bg-slate-800 cursor-grab active:cursor-grabbing"
                      >
                        <img src={src} alt={`media ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover pointer-events-none" />
                        {isCover ? (
                          <div className="absolute top-1.5 left-1.5 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">Cover</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setMediaItems((prev) => {
                              const next = [...prev];
                              const [moved] = next.splice(i, 1);
                              next.unshift(moved);
                              return next;
                            })}
                            className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                          >
                            Set cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeMediaItem(i)}
                          className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition"
                        >
                          <X className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      }

      // ── STEP 5: Primary Location (was step 7) ─────────────────────────────
      case 5:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Primary Location</h2>
              <p className="text-slate-400 text-sm mb-4">
                Add your primary location. Select a country to enable the Remote service toggle.
              </p>

              {/* Remote toggle — only enabled when a country is selected */}
              <div className={`flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg mb-4 ${!primaryLocationIsCountry ? 'opacity-60' : ''}`}>
                <div>
                  <p className="text-white text-sm font-medium">Remote service</p>
                  <p className="text-slate-400 text-xs">
                    {primaryLocationIsCountry
                      ? 'Toggle on if this service is offered online/remotely'
                      : 'Select a country as your primary location to enable'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!primaryLocationIsCountry}
                  onClick={() => setOfferedRemotely((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${offeredRemotely ? 'bg-blue-600' : 'bg-slate-700'} ${!primaryLocationIsCountry ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${offeredRemotely ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Selected location badge — always visible when set */}
              {primaryLocation && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full text-sm">
                    {primaryLocation}
                    <button type="button" onClick={() => { setPrimaryLocation(''); setPrimaryLocationIsCountry(false); setOfferedRemotely(false); }}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}

              {/* Search input — shown when no location selected */}
              {!primaryLocation && (
                <div ref={primaryLocationContainerRef} className="relative mb-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    {primaryLocationLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />}
                    <input
                      type="text"
                      value={primaryLocationInput}
                      onChange={(e) => { setPrimaryLocationInput(e.target.value); setPrimaryLocationDropdownOpen(true); }}
                      onKeyDown={handlePrimaryLocationKeyDown}
                      onFocus={() => setPrimaryLocationDropdownOpen(true)}
                      placeholder="Search for a city or country…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                    />
                  </div>
                  {primaryLocationDropdownOpen && primaryLocationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                      {primaryLocationSuggestions.map((r) => (
                        <button
                          key={r.label}
                          type="button"
                          onClick={() => addPrimaryLocation(r.label, r.isCountry ?? false)}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors flex items-center justify-between"
                        >
                          <span>{r.label}</span>
                          {r.isCountry && <span className="text-primary text-xs font-medium">Country</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      // ── STEP 6: Extra Locations ───────────────────────────────────────────
      case 6:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Extra Locations (optional)</h2>
              <p className="text-slate-400 text-sm mb-4">Reach more buyers by adding extra locations — $5/month each.</p>
              <div ref={extraLocationContainerRef} className="relative mb-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  {extraLocationLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />}
                  <input
                    type="text"
                    value={extraLocationInput}
                    onChange={(e) => { setExtraLocationInput(e.target.value); setExtraLocationDropdownOpen(true); }}
                    onKeyDown={handleAddExtraLocation}
                    onFocus={() => setExtraLocationDropdownOpen(true)}
                    placeholder="Type a location and press Enter to add"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-slate-300 pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                  />
                </div>
                {extraLocationDropdownOpen && extraLocationSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                    {extraLocationSuggestions.map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => addExtraLocation(r.label)}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {extraLocations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {extraLocations.map((loc) => (
                    <span key={loc} className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full text-sm">
                      {loc}
                      <button type="button" onClick={() => setExtraLocations((prev) => prev.filter((l) => l !== loc))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      // ── STEP 7: Languages (was step 5) ────────────────────────────────────
      case 7:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Languages</h2>
              <p className="text-slate-400 text-sm mb-4">Select all languages you can communicate with clients in.</p>

              <div ref={languageContainerRef} className="relative mb-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={languageInput}
                    onChange={(e) => { setLanguageInput(e.target.value); setLanguageDropdownOpen(true); }}
                    onKeyDown={handleLanguageKeyDown}
                    onFocus={() => setLanguageDropdownOpen(true)}
                    placeholder="Type a language and press Enter to add"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-slate-300 pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                  />
                </div>
                {languageDropdownOpen && filteredLanguages.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                    {filteredLanguages.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => addLanguage(lang)}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {languages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <span key={lang} className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full text-sm">
                      {lang}
                      <button type="button" onClick={() => setLanguages((prev) => prev.filter((l) => l !== lang))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      // ── STEP 8: Publish Post ──────────────────────────────────────────────
      case 8: {
        const hasExtraLocations = extraLocations.length > 0;

        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Publish Post</h2>
              <p className="text-slate-400 text-sm mb-6">
                Congrats! Your post is ready. Review it below and hit &ldquo;Publish&rdquo; when you&rsquo;re ready to go live.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const id = draftId ?? editId;
                    if (id) window.open(`/service-detail?id=${id}`, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm hover:bg-slate-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm hover:bg-slate-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit post
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm hover:bg-slate-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit media
                </button>
              </div>
            </div>

            {/* Payment section — only shown when extra locations were added */}
            {hasExtraLocations && (
              <Elements
                stripe={stripePromise}
                options={{
                  appearance: { theme: 'night', variables: { colorPrimary: '#3b82f6' } },
                  fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap' }],
                }}
              >
                <Step8PaymentSection
                  extraLocationCount={extraLocations.length}
                  serviceId={draftId ?? editId ?? ''}
                  onBack={prevStep}
                  onSuccess={(subId) => doPublish(subId)}
                />
              </Elements>
            )}
          </div>
        );
      }

      // ── STEP 9: Success ───────────────────────────────────────────────────
      case 9: {
        const serviceId = editId ?? draftId;
        const shareUrl = serviceId ? `${window.location.origin}/share?id=${serviceId}` : window.location.origin;
        const shareText = encodeURIComponent(`Check out my service: ${title}`);
        const encodedUrl = encodeURIComponent(shareUrl);

        const handleCopyLink = async () => {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };

        return (
          <div className="space-y-8">
            <div>
              <div className="w-16 h-16 bg-[#0C4A26] rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-[#2EEA60]" strokeWidth={3} />
              </div>
              <h2 className="text-white font-semibold text-center mb-2">
                {editId ? 'Post updated!' : 'Your post is live!'}
              </h2>
              <p className="text-slate-400 text-sm mb-6 text-center">
                {editId
                  ? 'Your changes have been saved. Buyers can now see the updated listing.'
                  : 'Sellers who share their posts on social media get up to 3× more views. Share yours now!'}
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener,noreferrer')} className="flex items-center justify-center px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors text-sm font-medium">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3"><circle cx="10" cy="10" r="10" fill="#1877F2"/><path d="M13.214 12.75l.365-2.375H11.3V8.75c0-.65.318-1.282 1.338-1.282H13.7V5.44s-.87-.19-1.7-.19c-1.876 0-3.1 1.137-3.1 3.196v1.929H6.75v2.375H8.9V18.5c.362.057.732.087 1.1.087s.738-.03 1.1-.087V12.75h2.114z" fill="white"/></svg>
                  Share to Facebook
                </button>
                <button onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${shareText}`, '_blank', 'noopener,noreferrer')} className="flex items-center justify-center px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors text-sm font-medium">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3"><path d="M19.9986 10.0029C19.9986 15.0549 16.2549 19.2314 11.3915 19.9092C10.9368 19.9723 10.4716 20.0052 9.9993 20.0052C9.45417 20.0052 8.91886 19.9617 8.39756 19.8776C3.63649 19.1109 0 14.9813 0 10.0029C0 4.47862 4.4773 0 10 0C15.5227 0 20 4.47862 20 10.0029H19.9986Z" fill="white"/><path d="M4.05412 4.4115L8.66595 10.5792L4.02539 15.594H5.0701L9.1333 11.2037L12.4159 15.594H15.9705L11.0994 9.07935L15.419 4.4115H14.3743L10.6327 8.45487L7.60933 4.4115H4.05481H4.05412ZM5.58999 5.18106H7.22256L14.4332 14.8245H12.8006L5.58999 5.18106Z" fill="#1C1C1B"/></svg>
                  Share to X
                </button>
                <button onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank', 'noopener,noreferrer')} className="flex items-center justify-center px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors text-sm font-medium">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3"><rect width="20" height="20" rx="3.5" fill="#0A66C2"/><path d="M5.5 8H4V16H5.5V8ZM4.75 7C4.06 7 3.5 6.44 3.5 5.75C3.5 5.06 4.06 4.5 4.75 4.5C5.44 4.5 6 5.06 6 5.75C6 6.44 5.44 7 4.75 7ZM16.5 16H15V12.25C15 11.42 14.58 10.75 13.75 10.75C12.92 10.75 12.5 11.42 12.5 12.25V16H11V8H12.5V9C12.92 8.33 13.83 7.75 14.75 7.75C15.94 7.75 16.5 8.83 16.5 10.25V16Z" fill="white"/></svg>
                  Share to LinkedIn
                </button>
                <button onClick={() => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Check out my service on GigSpace:\n\n${shareUrl}`)}`, '_self')} className="flex items-center justify-center px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition-colors text-sm font-medium">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-3"><path d="M1.36364 17.5037H4.54545V9.7764L0 6.36731V16.14C0 16.8934 0.610227 17.5037 1.36364 17.5037Z" fill="#4285F4"/><path d="M15.4541 17.5037H18.6359C19.3893 17.5037 19.9996 16.8934 19.9996 16.14V6.36731L15.4541 9.7764V17.5037Z" fill="#34A853"/><path d="M15.4541 3.86731V9.7764L19.9996 6.36731V4.54913C19.9996 2.8639 18.0757 1.9014 16.7268 2.91277L15.4541 3.86731Z" fill="#FBBC04"/><path fillRule="evenodd" clipRule="evenodd" d="M4.5459 9.7764V3.86731L10.0004 7.95822L15.455 3.86731V9.7764L10.0004 13.8673L4.5459 9.7764Z" fill="#EA4335"/><path d="M0 4.54913V6.36731L4.54545 9.7764V3.86731L3.27273 2.91277C1.92386 1.9014 0 2.8639 0 4.54913Z" fill="#C5221F"/></svg>
                  Share via email
                </button>
              </div>
              <button onClick={handleCopyLink} className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-primary text-white hover:bg-blue-600 transition-colors text-sm font-semibold">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-[#0E1422] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <p className="text-slate-500 text-sm">Loading post…</p>
        </div>
      </div>
    );
  }

  const isStep8WithPayment = step === 8 && extraLocations.length > 0;

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col items-center">
      <header className="w-full px-6 py-6 lg:px-12 flex justify-between items-center mb-8">
        <Logo className="h-6" />
        <div ref={avatarMenuRef} className="relative">
          <div onClick={() => setAvatarMenuOpen((v) => !v)} className="cursor-pointer">
            <CurrentUserAvatar size="sm" />
          </div>
          {avatarMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
              <button
                type="button"
                onClick={() => { navigate('/seller-dashboard'); setAvatarMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors"
              >
                Go to dashboard
              </button>
              <div className="w-full h-px bg-slate-700 my-1" />
              <button
                type="button"
                onClick={() => { logout(); navigate('/signin'); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="w-full max-w-2xl px-6 pb-24">
        <h1 className="text-2xl font-bold text-center text-white mb-8">
          {editId ? 'Edit service' : 'Post a service'}
        </h1>

        <div className="w-full h-2 bg-slate-700 rounded-full mb-12 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="w-full">{renderStep()}</div>

        {stepError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            {stepError}
          </div>
        )}

        {/* Footer nav — hidden on step 8 with payment (Step8PaymentSection has its own Back/Publish) and step 9 */}
        {step < 9 && !isStep8WithPayment && (
          <>
            <div className="w-full h-px bg-slate-800 my-8" />
            <div className="flex justify-between items-center">
              {step === 1 ? (
                <Link to="/seller-dashboard" className="px-6 py-2.5 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors text-sm">
                  Cancel
                </Link>
              ) : (
                <button onClick={prevStep} className="px-6 py-2.5 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors text-sm">
                  Back
                </button>
              )}

              <div className="flex items-center gap-3">
                {step < 8 && (
                  <button
                    onClick={() => saveStep(true)}
                    disabled={saving || publishing}
                    className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Save &amp; exit
                  </button>
                )}

                <button
                  onClick={step === 8 ? () => doPublish() : () => saveStep(false)}
                  disabled={saving || publishing}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {step === 8 ? (
                    publishing
                      ? (editId ? 'Saving…' : 'Publishing…')
                      : (editId ? 'Save changes' : 'Publish')
                  ) : saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  ) : (
                    'Save and continue'
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 8 divider when payment section renders its own buttons */}
        {isStep8WithPayment && (
          <div className="mt-4" />
        )}

        {step === 9 && (
          <>
            <div className="w-full h-px bg-slate-800 my-8" />
            <div className="flex justify-end items-center">
              <button onClick={() => navigate('/seller-dashboard')} className="text-slate-400 text-sm font-medium hover:text-white transition-colors">
                Go to dashboard →
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default PostService;
