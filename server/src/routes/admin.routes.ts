import { Router } from 'express';
import { verifyAdmin } from '../middleware/verifyAdmin';
import {
  getStats,
  getUsers, updateUser, deleteUser,
  getServices,
  getOrders,
} from '../controllers/admin.controller';

const router = Router();

router.get('/stats',         verifyAdmin, getStats);
router.get('/users',         verifyAdmin, getUsers);
router.patch('/users/:uid',  verifyAdmin, updateUser);
router.delete('/users/:uid', verifyAdmin, deleteUser);
router.get('/services',      verifyAdmin, getServices);
router.get('/orders',        verifyAdmin, getOrders);

export default router;
