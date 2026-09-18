import { ref, get, remove, runTransaction, update } from 'firebase/database';
import { database } from '../firebase';
import { businessSlug, serviceSlug, slugCandidates } from './slug';
import { listingLocation, resolveServiceLabel, type CategoryLabels, type SeoListing } from './meta';

/**
 * Gives a listing its permanent /posts/{business}/{slug} address.
 *
 * Runs at publish time. The slug is claimed in `seoPaths/{business}/{slug}`
 * with a transaction so two sellers publishing the same service in the same
 * city at the same moment can't share a URL — the loser falls through to the
 * next candidate, which carries a suffix derived from the listing's own id.
 * A listing that already has a path keeps it: URLs never change once created.
 */
export async function ensureSeoPath(
  serviceId: string,
  listing: Omit<SeoListing, 'id'>,
  labels: CategoryLabels,
): Promise<string> {
  const existing = await get(ref(database, `services/${serviceId}/seoPath`));
  const known = typeof existing.val() === 'string' && existing.val() ? (existing.val() as string) : null;
  if (known) {
    await indexForSitemap(serviceId, known, listing);
    return known;
  }

  const full: SeoListing = { ...listing, id: serviceId };
  const business = businessSlug(listing.sellerName ?? '');
  const base = serviceSlug(resolveServiceLabel(full, labels), listingLocation(full));

  for (const slug of slugCandidates(base, serviceId)) {
    let committed = false;
    try {
      const claim = await runTransaction(ref(database, `seoPaths/${business}/${slug}`), (current) => {
        if (current === null || current === serviceId) return serviceId;
        return; // taken by another listing — abort and try the next candidate
      });
      committed = claim.committed;
    } catch {
      // A slug already held by someone else is refused by the rules rather than
      // reported as a conflict, and the SDK surfaces that as a rejection. It
      // means the same thing as an aborted transaction here: try the next one.
      committed = false;
    }
    if (committed) {
      const seoPath = `${business}/${slug}`;
      await update(ref(database, `services/${serviceId}`), { seoPath });
      await indexForSitemap(serviceId, seoPath, listing);
      return seoPath;
    }
  }
  throw new Error(`Could not allocate a unique SEO path for ${serviceId} (base "${business}/${base}")`);
}

/**
 * `seoIndex` is the sitemap's data source: one tiny record per publicly listed
 * service. It exists so building the sitemap doesn't have to read the whole
 * `services` table — at thousands of listings that transfer is the thing that
 * breaks first, and a sitemap is regenerated far more often than a listing
 * changes. Presence in this node means "belongs in the sitemap".
 */
export async function indexForSitemap(
  serviceId: string,
  seoPath: string,
  listing: Pick<SeoListing, 'updatedAt' | 'createdAt'>,
): Promise<void> {
  await update(ref(database, `seoIndex/${serviceId}`), {
    p: seoPath,
    m: listing.updatedAt ?? listing.createdAt ?? Date.now(),
  });
}

/** Drops a listing out of the sitemap — unpublished, claimed away, or deleted. */
export async function removeFromSitemap(serviceId: string): Promise<void> {
  await remove(ref(database, `seoIndex/${serviceId}`));
}
