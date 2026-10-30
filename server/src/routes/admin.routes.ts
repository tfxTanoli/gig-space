import { Router } from 'express';
import { verifyAdmin } from '../middleware/verifyAdmin';
import {
  getStats,
  getUsers, updateUser, deleteUser, setUserDisabled, impersonateUser, createUser,
  getServices, updateService, deleteService,
  getOrders, getOrderMessages, recountOrderSellerSales, reconcileListingSubscriptions,
  getAffiliates, createAffiliate,
  getSubscriptions, cancelSubscription,
  getUserStats,
  inviteAdmin, getAdmins, revokeAdmin,
  getSettings, updateSettings,
} from '../controllers/admin.controller';
import { searchListings, generateListings, rehostListingPhotos, rewriteListingTitle, addListingToOutreach } from '../controllers/listings.controller';
import { pruneServiceMedia, tidyMedia } from '../controllers/media.controller';

const router = Router();

router.get('/stats',          verifyAdmin, getStats);
router.get('/users',          verifyAdmin, getUsers);
router.post('/users',         verifyAdmin, createUser);
router.patch('/users/:uid',   verifyAdmin, updateUser);
router.patch('/users/:uid/disabled', verifyAdmin, setUserDisabled);
router.post('/users/:uid/impersonate', verifyAdmin, impersonateUser);
router.get('/users/:uid/stats', verifyAdmin, getUserStats);
router.delete('/users/:uid',  verifyAdmin, deleteUser);
router.get('/services',          verifyAdmin, getServices);
router.patch('/services/:id',    verifyAdmin, updateService);
router.delete('/services/:id',   verifyAdmin, deleteService);
router.post('/services/:id/prune-media', verifyAdmin, pruneServiceMedia);
router.post('/media/tidy',       verifyAdmin, tidyMedia);
router.get('/orders',         verifyAdmin, getOrders);
router.get('/orders/:orderId/messages', verifyAdmin, getOrderMessages);
router.post('/orders/:orderId/recount-seller-sales', verifyAdmin, recountOrderSellerSales);
router.post('/listing-subscriptions/reconcile', verifyAdmin, reconcileListingSubscriptions);
router.get('/affiliates',     verifyAdmin, getAffiliates);
router.post('/affiliates',    verifyAdmin, createAffiliate);
router.get('/subscriptions',           verifyAdmin, getSubscriptions);
router.post('/subscriptions/:id/cancel', verifyAdmin, cancelSubscription);
router.post('/listings/search',   verifyAdmin, searchListings);
router.post('/listings/generate', verifyAdmin, generateListings);
router.post('/listings/rehost-photos', verifyAdmin, rehostListingPhotos);
router.post('/listings/rewrite-title',  verifyAdmin, rewriteListingTitle);
router.post('/listings/outreach',       verifyAdmin, addListingToOutreach);
router.get('/admins',          verifyAdmin, getAdmins);
router.post('/admins/invite',  verifyAdmin, inviteAdmin);
router.delete('/admins/:id',   verifyAdmin, revokeAdmin);
router.get('/settings',       verifyAdmin, getSettings);
router.patch('/settings',     verifyAdmin, updateSettings);

export default router;
