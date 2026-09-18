import { ref, get, runTransaction, update } from 'firebase/database';
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
  if (typeof existing.val() === 'string' && existing.val()) return existing.val();

  const full: SeoListing = { ...listing, id: serviceId };
  const business = businessSlug(listing.sellerName ?? '');
  const base = serviceSlug(resolveServiceLabel(full, labels), listingLocation(full));

  for (const slug of slugCandidates(base, serviceId)) {
    const claim = await runTransaction(ref(database, `seoPaths/${business}/${slug}`), (current) => {
      if (current === null || current === serviceId) return serviceId;
      return; // taken by another listing — abort and try the next candidate
    });
    if (claim.committed) {
      const seoPath = `${business}/${slug}`;
      await update(ref(database, `services/${serviceId}`), { seoPath });
      return seoPath;
    }
  }
  throw new Error('Could not allocate a unique SEO path');
}
