import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import {
  getAffiliate,
  getCommissions,
  getReferrals,
  getPayouts,
  requestWithdrawal,
  getConnectLink,
  getConnectStatus,
} from '../controllers/affiliate.controller';

const router = Router();

router.get('/me',              requireAuth, getAffiliate);
router.get('/commissions',     requireAuth, getCommissions);
router.get('/referrals',       requireAuth, getReferrals);
router.get('/payouts',         requireAuth, getPayouts);
router.post('/withdraw',       requireAuth, requestWithdrawal);
router.post('/connect/link',   requireAuth, getConnectLink);
router.post('/connect/status', requireAuth, getConnectStatus);

export default router;
