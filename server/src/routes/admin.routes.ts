import { Router } from 'express';
import { verifyAdmin } from '../middleware/verifyAdmin';
import {
  getStats,
  getUsers, updateUser, deleteUser,
  getServices,
  getOrders,
  getSettings, updateSettings,
} from '../controllers/admin.controller';

const router = Router();

router.get('/stats',          verifyAdmin, getStats);
router.get('/users',          verifyAdmin, getUsers);
router.patch('/users/:uid',   verifyAdmin, updateUser);
router.delete('/users/:uid',  verifyAdmin, deleteUser);
router.get('/services',       verifyAdmin, getServices);
router.get('/orders',         verifyAdmin, getOrders);
router.get('/settings',       verifyAdmin, getSettings);
router.patch('/settings',     verifyAdmin, updateSettings);

export default router;
