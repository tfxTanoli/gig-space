import { toast } from 'sonner';
import { adminAddListingToOutreach } from './adminApi';

/**
 * Adds a generated post's business to the Saleshandy sequence once the post is
 * live (GIG-76) and says how it went. Used by every way an admin can take a
 * generated post live: the Listings tab's Publish and the edit drawer's status
 * picker. The publish itself has already succeeded, so this only ever toasts.
 */
export async function addToOutreachWithToast(serviceId: string): Promise<void> {
  try {
    const r = await adminAddListingToOutreach(serviceId);
    if (r.added) toast.success('Added to the Saleshandy sequence.');
    else if (r.reason === 'no_email') toast.warning('Not added to Saleshandy: this post has no contact email.');
    else if (r.reason === 'has_account') toast.message('Not added to Saleshandy: this business already has a Gigspace account.');
  } catch (err) {
    toast.error(`Published, but not added to Saleshandy: ${err instanceof Error ? err.message : 'request failed'}`);
  }
}
