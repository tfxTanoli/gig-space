import { useState, useEffect, useMemo } from 'react';
import {
  Search, MapPin, Star, ExternalLink, Pencil, Trash2, Sparkles, Loader2, CheckSquare, Square, Megaphone,
} from 'lucide-react';
import { ref as dbRef, get, update, remove } from 'firebase/database';
import { toast } from 'sonner';
import { database } from '../../firebase';
import { useCategories } from '../../CategoriesContext';
import { LANGUAGES } from '../../data/languages';
import { adminSearchListings, adminGenerateListings, type ListingBusiness } from '../adminApi';
import AdminPostEditDrawer from './AdminPostEditDrawer';
import { type AdminService } from './AdminServicesTable';

type GenListing = AdminService & {
  claimStatus?: 'unclaimed' | 'claimed';
  sellerPhotoURL?: string;   // business favicon (post avatar)
  contactEmail?: string;     // scraped from the business website; powers "Message seller" mailto
  website?: string;
};

const SELECT_CLASS =
  'bg-surface-raised border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors';

function parseGen(id: string, s: Record<string, unknown>): GenListing {
  const images = Array.isArray(s.images) ? (s.images as string[]) : [];
  return {
    id,
    title:           String(s.title ?? ''),
    sellerName:      String(s.sellerName ?? ''),
    sellerId:        String(s.sellerId ?? ''),
    price:           Number(s.priceMin ?? 0),
    priceMin:        Number(s.priceMin ?? 0),
    priceMax:        s.priceMax != null ? Number(s.priceMax) : null,
    priceType:       'per_project', // coerced for AdminService; generated posts show "Contact for pricing"
    status:          String(s.status ?? 'draft'),
    images,
    imageUrl:        images[0] ?? null,
    category:        String(s.category ?? ''),
    subcategory:     String(s.subcategory ?? ''),
    description:     String(s.description ?? ''),
    primaryLocation: String(s.primaryLocation ?? ''),
    extraLocations:  Array.isArray(s.extraLocations) ? (s.extraLocations as string[]) : [],
    offeredRemotely: Boolean(s.offeredRemotely),
    languages:       Array.isArray(s.languages) ? (s.languages as string[]) : [],
    createdAt:       Number(s.createdAt ?? 0),
    claimStatus:     (s.claimStatus as 'unclaimed' | 'claimed') ?? 'unclaimed',
    sellerPhotoURL:  String(s.sellerPhotoURL ?? ''),
    contactEmail:    String(s.contactEmail ?? ''),
    website:         String(s.website ?? ''),
  };
}

const STATUS_BADGE: Record<string, string> = {
  draft:  'bg-slate-700 text-slate-300',
  active: 'bg-emerald-500/10 text-emerald-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
};

export default function AdminListingsTab() {
  const { categoryOptions, subcategoryMap } = useCategories();

  // ── Search form ──
  const [keyword, setKeyword]         = useState('');
  const [city, setCity]               = useState('');
  const [category, setCategory]       = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [language, setLanguage]       = useState('English');
  const subOptions = subcategoryMap[category] ?? [];

  const [results, setResults]   = useState<ListingBusiness[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Generated listings ──
  const [generated, setGenerated] = useState<GenListing[] | null>(null);
  const [editService, setEditService] = useState<GenListing | null>(null);

  const loadGenerated = async () => {
    try {
      const snap = await get(dbRef(database, 'services'));
      const raw = (snap.val() ?? {}) as Record<string, Record<string, unknown>>;
      const list = Object.entries(raw)
        .filter(([, s]) => s?.isGenerated === true)
        .map(([id, s]) => parseGen(id, s))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setGenerated(list);
    } catch { setGenerated([]); }
  };

  useEffect(() => { loadGenerated(); }, []);

  const doSearch = async () => {
    if (!keyword.trim() || !city.trim()) { toast.error('Enter a service keyword and a city.'); return; }
    setSearching(true);
    setResults(null);
    try {
      const { businesses } = await adminSearchListings({ keyword: keyword.trim(), city: city.trim() });
      setResults(businesses);
      setSelected(new Set()); // admin picks manually (e.g. only businesses with an email)
      if (businesses.length === 0) toast.message('No businesses found for that search.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally { setSearching(false); }
  };

  const toggle = (placeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(placeId) ? next.delete(placeId) : next.add(placeId);
      return next;
    });
  };

  const doGenerate = async () => {
    if (!results) return;
    const chosen = results.filter((b) => selected.has(b.placeId));
    if (chosen.length === 0) { toast.error('Select at least one business.'); return; }
    if (!category) { toast.error('Choose a category to file these posts under.'); return; }
    setGenerating(true);
    try {
      const { count } = await adminGenerateListings({ category, subcategory, language, businesses: chosen });
      toast.success(`Generated ${count} draft post${count !== 1 ? 's' : ''}. Review and publish them below.`);
      setResults(null);
      setSelected(new Set());
      await loadGenerated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate posts');
    } finally { setGenerating(false); }
  };

  const publish = async (id: string) => {
    try {
      await update(dbRef(database, `services/${id}`), { status: 'active', updatedAt: Date.now() });
      setGenerated((prev) => prev?.map((g) => g.id === id ? { ...g, status: 'active' } : g) ?? null);
      toast.success('Post published — it is now live on the marketplace.');
    } catch { toast.error('Failed to publish.'); }
  };

  const del = async (id: string) => {
    if (!window.confirm('Delete this generated listing permanently?')) return;
    try {
      await Promise.all([
        remove(dbRef(database, `services/${id}`)),
        remove(dbRef(database, `serviceReviews/${id}`)),
      ]);
      setGenerated((prev) => prev?.filter((g) => g.id !== id) ?? null);
      toast.success('Listing deleted.');
    } catch { toast.error('Failed to delete.'); }
  };

  const selectedCount = selected.size;
  const genCount = generated?.length ?? 0;
  const unclaimed = useMemo(() => (generated ?? []).filter((g) => g.claimStatus !== 'claimed').length, [generated]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Listings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Generate marketplace posts from public business data (Google Places)</p>
      </div>

      {/* ── Search & generate panel ── */}
      <div className="bg-surface rounded-xl border border-slate-800 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Service / keyword</label>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. plumber, web designer" className={`w-full ${SELECT_CLASS}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Staten Island, NY" className={`w-full ${SELECT_CLASS}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }} className={`w-full ${SELECT_CLASS}`}>
              <option value="">Select category…</option>
              {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Subcategory</label>
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category} className={`w-full ${SELECT_CLASS} disabled:opacity-50`}>
              <option value="">{category ? 'Select subcategory…' : 'Choose a category first'}</option>
              {subOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`w-full ${SELECT_CLASS}`}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={doSearch} disabled={searching} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-blue-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching ? 'Searching…' : 'Search businesses'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      {results !== null && (
        <div className="mt-5 bg-surface rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">
              {results.length} result{results.length !== 1 ? 's' : ''} · {selectedCount} selected
            </h3>
            <button
              onClick={doGenerate}
              disabled={generating || selectedCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate {selectedCount} post{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
          {results.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-10">No businesses found. Try a broader keyword or different city.</p>
          ) : (
            <ul className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto">
              {results.map((b) => {
                const checked = selected.has(b.placeId);
                return (
                  <li key={b.placeId} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-800/20 transition-colors">
                    <button onClick={() => toggle(b.placeId)} className="mt-0.5 text-slate-400 hover:text-blue-400 flex-shrink-0">
                      {checked ? <CheckSquare className="w-5 h-5 text-blue-400" /> : <Square className="w-5 h-5" />}
                    </button>
                    {b.logo ? (
                      <img src={b.logo} alt="" title="Business favicon (post avatar)" className="w-9 h-9 rounded-full bg-white object-contain flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center flex-shrink-0 text-slate-600 text-sm font-bold">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm">{b.name}</p>
                      <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{b.location || b.address || '—'}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        {b.rating > 0 && <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{b.rating.toFixed(1)} ({b.reviewCount})</span>}
                        <span>{b.images.length} photo{b.images.length !== 1 ? 's' : ''}</span>
                        <span>{b.reviews.length} review{b.reviews.length !== 1 ? 's' : ''}</span>
                        {b.website && (
                          <a
                            href={b.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-400 hover:underline truncate max-w-[200px]"
                          >
                            {b.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                          </a>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs">
                        {b.email
                          ? <a href={`mailto:${b.email}`} onClick={(e) => e.stopPropagation()} className="text-emerald-400 hover:underline">{b.email}</a>
                          : <span className="text-slate-600">no email found</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Generated listings ── */}
      <div className="mt-5 bg-surface rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Generated Listings</h3>
          {generated !== null && (
            <span className="text-xs text-slate-500">{genCount} total · {unclaimed} unclaimed</span>
          )}
        </div>

        {generated === null ? (
          <div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : generated.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">No generated listings yet. Search above to create some.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Business', 'Location', 'Contact', 'Category', 'Status', 'Claim', 'Actions'].map((h) => (
                    <th key={h} className={`px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generated.map((g) => (
                  <tr key={g.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {g.sellerPhotoURL ? (
                          <img src={g.sellerPhotoURL} alt="" title="Business favicon (post avatar)" className="w-7 h-7 rounded-full bg-white object-contain flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700/60 flex-shrink-0" />
                        )}
                        <span className="text-white font-medium truncate max-w-[180px]">{g.title || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs max-w-[180px] truncate">{g.primaryLocation || '—'}</td>
                    <td className="px-5 py-3 text-xs max-w-[200px]">
                      {g.contactEmail ? (
                        <a href={`mailto:${g.contactEmail}`} className="block text-blue-400 hover:underline truncate">{g.contactEmail}</a>
                      ) : (
                        <span className="text-slate-600">no email found</span>
                      )}
                      {g.website && (
                        <a href={g.website} target="_blank" rel="noopener noreferrer" className="block text-slate-500 hover:text-slate-300 hover:underline truncate mt-0.5">
                          {g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs capitalize">{g.category || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[g.status] ?? 'bg-slate-700 text-slate-400'}`}>{g.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      {g.claimStatus === 'claimed' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">Claimed</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-500"><Megaphone className="w-3 h-3" />Unclaimed</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => window.open(`/service-detail?id=${g.id}`, '_blank', 'noopener,noreferrer')} title="Open" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditService(g)} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {g.status !== 'active' && (
                          <button onClick={() => publish(g.id)} title="Publish" className="px-2 py-1 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                            Publish
                          </button>
                        )}
                        <button onClick={() => del(g.id)} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editService && (
        <AdminPostEditDrawer
          service={editService}
          onClose={() => setEditService(null)}
          onSuccess={(updated) => {
            setGenerated((prev) => prev?.map((g) => g.id === updated.id ? { ...g, ...updated } : g) ?? null);
            setEditService(null);
          }}
          onDeleted={(id) => {
            setGenerated((prev) => prev?.filter((g) => g.id !== id) ?? null);
            setEditService(null);
          }}
        />
      )}
    </>
  );
}
