import { Router } from 'express';
import authRoutes from './auth';
import appsRoutes from './apps';
import ordersRoutes from './orders';
import walletsRoutes from './wallets';
import sellersRoutes from './sellers';
import listingsRoutes from './listings';
import notificationsRoutes from './notifications';
import usersRoutes from './users';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/apps', appsRoutes);
router.use('/orders', ordersRoutes);
router.use('/wallets', walletsRoutes);
router.use('/sellers', sellersRoutes);
router.use('/listings', listingsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/users', usersRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

export default router;
