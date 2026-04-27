import { useState, useRef } from 'react';
import { ChevronDown, Image as ImageIcon, Search, X, Plus } from 'lucide-react';
import LocationIcon from './LocationIcon';
import { Link, useNavigate } from 'react-router-dom';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, push, set } from 'firebase/database';
import { storage, database } from './firebase';
import { useAuth } from './AuthContext';
import { CurrentUserAvatar } from './UserAvatar';

const TOTAL_STEPS = 9;

const categoryOptions = [
  { value: 'digital', label: 'Digital Work' },
  { value: 'home', label: 'Home Services' },
];

const subcategoryMap: Record<string, { value: string; label: string }[]> = {
  digital: [
    { value: 'web_dev', label: 'Web Development' },
    { value: 'mobile_dev', label: 'Mobile App Development' },
    { value: 'graphic_design', label: 'Graphic Design' },
    { value: 'video', label: 'Video & Animation' },
    { value: 'writing', label: 'Content Writing' },
    { value: 'seo', label: 'SEO & Marketing' },
    { value: 'data', label: 'Data & Analytics' },
  ],
  home: [
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'painting', label: 'Painting' },
    { value: 'moving', label: 'Moving & Delivery' },
    { value: 'landscaping', label: 'Landscaping' },
    { value: 'handyman', label: 'Handyman' },
  ],
};


const PostService = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Step 1: Category
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');

  // Step 2: Title & Description
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 3: Pricing
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceType, setPriceType] = useState<'per_project' | 'per_hour'>('per_project');

  // Step 4: Images
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Step 5: Languages
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState('');

  // Step 6: Extra Locations
  const [extraLocations, setExtraLocations] = useState<string[]>([]);
  const [extraLocationInput, setExtraLocationInput] = useState('');

  // Step 7: Primary Location
  const [primaryLocation, setPrimaryLocation] = useState('');
  const [offeredRemotely, setOfferedRemotely] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 10 - images.length;
    const toAdd = files.slice(0, remaining);
    setImages(prev => [...prev, ...toAdd]);
    toAdd.forEach(file => {
      setImagePreviews(prev => [...prev, URL.createObjectURL(file)]);
    });
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLanguage = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && languageInput.trim()) {
      e.preventDefault();
      const lang = languageInput.trim();
      if (!languages.includes(lang)) setLanguages(prev => [...prev, lang]);
      setLanguageInput('');
    }
  };

  const handleAddExtraLocation = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && extraLocationInput.trim()) {
      e.preventDefault();
      const loc = extraLocationInput.trim();
      if (!extraLocations.includes(loc)) setExtraLocations(prev => [...prev, loc]);
      setExtraLocationInput('');
    }
  };

  const validate = (): boolean => {
    setStepError('');
    if (step === 1 && !category) { setStepError('Please select a category.'); return false; }
    if (step === 2 && title.trim().length < 5) { setStepError('Title must be at least 5 characters.'); return false; }
    if (step === 3 && (!priceMin || isNaN(parseFloat(priceMin)) || parseFloat(priceMin) <= 0)) {
      setStepError('Please enter a valid minimum price.');
      return false;
    }
    if (step === 7 && !primaryLocation.trim() && !offeredRemotely) {
      setStepError('Please enter a primary location or mark as offered remotely.');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validate()) return;
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const prevStep = () => {
    setStepError('');
    if (step > 1) setStep(s => s - 1);
  };

  const handlePublish = async () => {
    if (!validate()) return;
    if (!user || !userProfile) return;

    setPublishing(true);
    setStepError('');

    try {
      const imageURLs: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const imgRef = storageRef(storage, `serviceImages/${user.uid}/${Date.now()}_${i}_${file.name}`);
        await uploadBytes(imgRef, file);
        const url = await getDownloadURL(imgRef);
        imageURLs.push(url);
      }

      const newPostRef = push(dbRef(database, 'services'));
      await set(newPostRef, {
        sellerId: user.uid,
        sellerName: userProfile.name,
        sellerUsername: userProfile.username,
        sellerPhotoURL: userProfile.photoURL,
        title: title.trim(),
        description: description.trim(),
        category,
        subcategory,
        priceMin: parseFloat(priceMin) || 0,
        priceMax: priceMax ? (parseFloat(priceMax) || null) : null,
        priceType,
        images: imageURLs,
        languages,
        primaryLocation: primaryLocation.trim(),
        extraLocations,
        offeredRemotely,
        createdAt: Date.now(),
        status: 'active',
      });

      if (newPostRef.key) {
        await set(dbRef(database, `users/${user.uid}/posts/${newPostRef.key}`), true);
      }

      setStep(9);
    } catch {
      setStepError('Failed to publish. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-white font-semibold mb-2">Category</h2>
              <p className="text-slate-400 text-sm mb-6">Choose the category and subcategory most suitable for your service.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}
                    className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-slate-300 px-4 py-3 appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                  >
                    <option value="" disabled>Category</option>
                    {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    disabled={!category}
                    className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-slate-300 px-4 py-3 appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm disabled:opacity-50"
                  >
                    <option value="" disabled>Subcategory</option>
                    {(subcategoryMap[category] ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Post Title</h2>
              <p className="text-slate-400 text-sm mb-4">Write a clear, descriptive title that helps buyers instantly understand what you offer.</p>
              <textarea
                rows={3}
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-slate-300 px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm resize-none"
              />
              <div className="text-right text-slate-500 text-xs mt-1">{title.length}/80 max</div>
            </div>
            <div className="w-full h-px bg-slate-800/80" />
            <div>
              <h2 className="text-white font-semibold mb-2">Description</h2>
              <p className="text-slate-400 text-sm mb-4">Add a detailed description of your service. Do not include any URLs or web addresses.</p>
              <textarea
                rows={12}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-slate-300 px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm resize-none"
              />
              <div className="text-right text-slate-500 text-xs mt-1">{description.length}/1,000 max</div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center mb-2">
                <h2 className="text-white font-semibold mr-2">Price Range</h2>
                <div className="w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center text-slate-400 text-[10px] cursor-help">i</div>
              </div>
              <p className="text-slate-400 text-sm mb-6">Enter what you would typically charge for this type of service.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Min</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      min="0"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-white pl-8 pr-12 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">USD</span>
                  </div>
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Max (optional)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      min="0"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-white pl-8 pr-12 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">USD</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <label className="flex items-center cursor-pointer group" onClick={() => setPriceType('per_project')}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${priceType === 'per_project' ? 'border-primary' : 'border-slate-700'}`}>
                    {priceType === 'per_project' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <span className="text-slate-300 text-sm font-medium group-hover:text-white transition-colors">Per Project</span>
                </label>
                <label className="flex items-center cursor-pointer group" onClick={() => setPriceType('per_hour')}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${priceType === 'per_hour' ? 'border-primary' : 'border-slate-700 group-hover:border-slate-500'}`}>
                    {priceType === 'per_hour' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <span className="text-slate-300 text-sm font-medium group-hover:text-white transition-colors">Per Hour</span>
                </label>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-white font-semibold mb-2">Images</h2>
              <p className="text-slate-400 text-sm mb-4">Attract customer attention with up to 10 images that showcase your services.</p>
              <ul className="text-slate-400 text-sm list-disc list-inside space-y-1.5 mb-8">
                <li>Ideal aspect ratio is 4:3</li>
                <li>Minimum 500 × 500 px</li>
                <li>Max file size 100MB</li>
              </ul>

              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />

              {images.length < 10 && (
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full border border-dashed border-slate-700 rounded-xl bg-[#111827]/50 py-16 flex flex-col items-center justify-center cursor-pointer hover:bg-[#1A2035]/50 transition-colors mb-6"
                >
                  <ImageIcon className="w-12 h-12 text-primary mb-4" strokeWidth={1.5} />
                  <p className="text-slate-400 text-sm">
                    <span className="text-primary font-semibold hover:text-blue-400 transition-colors">Upload a file</span> or drag and drop
                  </p>
                  <p className="text-slate-500 text-xs mt-1">{images.length}/10 images</p>
                </div>
              )}

              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-[#1A2035]">
                      <img src={src} alt={`upload ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Languages</h2>
              <p className="text-slate-400 text-sm mb-4">Select all languages you can communicate with clients in.</p>
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={languageInput}
                  onChange={(e) => setLanguageInput(e.target.value)}
                  onKeyDown={handleAddLanguage}
                  placeholder="Type a language and press Enter to add"
                  className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-slate-300 pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                />
              </div>
              {languages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang) => (
                    <span key={lang} className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full text-sm">
                      {lang}
                      <button onClick={() => setLanguages(prev => prev.filter(l => l !== lang))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Extra Locations (optional)</h2>
              <p className="text-slate-400 text-sm mb-4">Reach more buyers by adding extra locations — $5/month each.</p>
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={extraLocationInput}
                  onChange={(e) => setExtraLocationInput(e.target.value)}
                  onKeyDown={handleAddExtraLocation}
                  placeholder="Type a location and press Enter to add"
                  className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-slate-300 pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                />
              </div>
              {extraLocations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {extraLocations.map((loc) => (
                    <span key={loc} className="flex items-center gap-1.5 bg-[#1A2035] text-slate-300 border border-slate-700 px-3 py-1 rounded-full text-sm">
                      {loc}
                      <button onClick={() => setExtraLocations(prev => prev.filter(l => l !== loc))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Primary Location</h2>
              <p className="text-slate-400 text-sm mb-4">Add your primary location. If your service is remote, enter the country where you are based.</p>
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={primaryLocation}
                  onChange={(e) => setPrimaryLocation(e.target.value)}
                  placeholder="e.g. United States, London, Remote"
                  className="w-full bg-[#1A2035] border border-slate-700/80 rounded-lg text-slate-300 pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                />
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setOfferedRemotely(!offeredRemotely)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${offeredRemotely ? 'bg-primary' : 'bg-[#1A2035] border border-slate-700'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${offeredRemotely ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-slate-400 text-sm font-medium">Offered Remotely</span>
              </div>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-white font-semibold mb-2">Publish Post</h2>
              <p className="text-slate-400 text-sm mb-6">Congrats! Your post is ready. Review your details and hit "Publish" to go live.</p>

              <div className="bg-[#1A2035] rounded-xl p-5 space-y-3 mb-8 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Category</span>
                  <span className="text-white">{categoryOptions.find(c => c.value === category)?.label ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Title</span>
                  <span className="text-white truncate max-w-[60%] text-right">{title || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Price</span>
                  <span className="text-white">${priceMin}{priceMax ? ` – $${priceMax}` : ''} / {priceType === 'per_project' ? 'project' : 'hr'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Images</span>
                  <span className="text-white">{images.length} uploaded</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Location</span>
                  <span className="text-white">{primaryLocation || (offeredRemotely ? 'Remote' : '—')}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-8">
            <div>
              <div className="w-16 h-16 bg-[#0C4A26] rounded-full flex items-center justify-center mx-auto mb-6">
                <Plus className="w-8 h-8 text-[#2EEA60] rotate-45" strokeWidth={3} />
              </div>
              <h2 className="text-white font-semibold text-center mb-2">Your post is live!</h2>
              <p className="text-slate-400 text-sm mb-6 text-center">Sellers who share their posts on social media get up to 3× more views. Share yours now!</p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button className="flex items-center justify-center px-4 py-3 rounded-lg bg-[#1A2035] border border-slate-700 text-white hover:bg-slate-800 transition-colors text-sm font-medium">
                  <svg className="w-5 h-5 mr-3 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                  Share to Facebook
                </button>
                <button className="flex items-center justify-center px-4 py-3 rounded-lg bg-[#1A2035] border border-slate-700 text-white hover:bg-slate-800 transition-colors text-sm font-medium">
                  <svg className="w-4 h-4 mr-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  Share to X
                </button>
                <button className="flex items-center justify-center px-4 py-3 rounded-lg bg-[#1A2035] border border-slate-700 text-white hover:bg-slate-800 transition-colors text-sm font-medium">
                  <svg className="w-5 h-5 mr-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" /></svg>
                  Share to LinkedIn
                </button>
                <button className="flex items-center justify-center px-4 py-3 rounded-lg bg-[#1A2035] border border-slate-700 text-white hover:bg-slate-800 transition-colors text-sm font-medium">
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48" fill="none"><path d="M35.76 11.28L24 19.34L12.24 11.28C13.25 10.3 14.65 9.68 16.2 9.68H31.8C33.35 9.68 34.75 10.3 35.76 11.28Z" fill="#EA4335" /><path d="M38.8 14.18V34.32C38.8 36.53 37.01 38.32 34.8 38.32H31.8V23.08L38.8 18.28V14.18Z" fill="#34A853" /><path d="M16.2 38.32H13.2C10.99 38.32 9.2 36.53 9.2 34.32V14.18L16.2 19.06V38.32Z" fill="#4285F4" /><path d="M38.8 14.18V18.28L24 28.4L9.2 18.28V14.18C9.2 13.11 9.63 12.13 10.33 11.41C10.84 10.91 11.49 10.57 12.24 11.28" fill="#FBBC05" /></svg>
                  Share via email
                </button>
              </div>
              <button className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-primary text-white hover:bg-blue-600 transition-colors text-sm font-semibold">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                Copy link
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1422] text-white font-sans flex flex-col items-center">
      <header className="w-full px-6 py-6 lg:px-12 flex justify-between items-center mb-8">
        <Link to="/" className="flex items-center">
          <LocationIcon className="w-6 h-6 mr-1" />
          <span className="text-xl font-bold tracking-tight text-white">igspace</span>
        </Link>
        <CurrentUserAvatar size="sm" />
      </header>

      <main className="w-full max-w-2xl px-6 pb-24">
        <h1 className="text-2xl font-bold text-center text-white mb-8">Post a service</h1>

        <div className="w-full h-2 bg-[#1A2035] rounded-full mb-12 overflow-hidden">
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

        <div className="w-full h-px bg-slate-800 my-8" />

        {step < 9 ? (
          <div className="flex justify-between items-center">
            {step === 1 ? (
              <Link
                to="/seller-dashboard"
                className="px-6 py-2.5 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors text-sm"
              >
                Cancel
              </Link>
            ) : (
              <button
                onClick={prevStep}
                className="px-6 py-2.5 rounded-lg border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors text-sm"
              >
                Back
              </button>
            )}

            <div className="flex items-center">
              {step === 6 && (
                <button
                  onClick={() => { setStepError(''); setStep(s => s + 1); }}
                  className="text-slate-400 font-medium hover:text-white transition-colors text-sm mr-4"
                >
                  Skip
                </button>
              )}
              <button
                onClick={step === 8 ? handlePublish : nextStep}
                disabled={publishing}
                className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {step === 8 ? (publishing ? 'Publishing...' : 'Publish') : 'Save and continue'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end items-center">
            <button
              onClick={() => navigate('/seller-dashboard')}
              className="text-slate-400 text-sm font-medium hover:text-white transition-colors"
            >
              Go to dashboard →
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default PostService;
