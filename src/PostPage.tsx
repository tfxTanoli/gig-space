import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { database } from './firebase';
import ServiceDetail from './ServiceDetail';

declare global {
  interface Window {
    /** Set by api/post-page.ts so a server-rendered listing skips the path lookup. */
    __SEO_ROUTE__?: { path?: string | null; serviceId?: string };
  }
}

const SEGMENT_RE = /^[a-z0-9-]+$/;

/** /posts/{business}/{slug} → resolves the listing id, then renders the detail page. */
export default function PostPage() {
  const { business = '', slug = '' } = useParams();
  const path = `${business}/${slug}`;
  const hint = typeof window !== 'undefined' && window.__SEO_ROUTE__?.path === path
    ? window.__SEO_ROUTE__?.serviceId
    : undefined;
  const malformed = !SEGMENT_RE.test(business) || !SEGMENT_RE.test(slug);
  const [resolved, setResolved] = useState<{ path: string; id: string | null } | null>(null);

  useEffect(() => {
    if (hint || malformed) return;
    let cancelled = false;
    get(ref(database, `seoPaths/${business}/${slug}`))
      .then((snap) => {
        if (!cancelled) setResolved({ path, id: typeof snap.val() === 'string' ? snap.val() : null });
      })
      .catch(() => { if (!cancelled) setResolved({ path, id: null }); });
    return () => { cancelled = true; };
  }, [business, slug, path, hint, malformed]);

  // `undefined` = still resolving. Comparing the stored path keeps a previous
  // listing from flashing when navigating straight from one /posts/ URL to another.
  const serviceId = hint ?? (malformed ? null : resolved?.path === path ? resolved.id : undefined);

  if (serviceId === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    );
  }
  return <ServiceDetail postId={serviceId} />;
}
