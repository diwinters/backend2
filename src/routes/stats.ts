import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { adminAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/admin/stats - Dashboard statistics
router.get('/', adminAuth, async (_req: Request, res: Response) => {
  try {
    // Gather all stats in parallel for performance
    const [
      // App stats
      totalApps,
      activeApps,
      // Seller stats (users with isSeller = true)
      totalSellers,
      pendingSellers,
      activeSellers,
      // Listing stats
      totalListings,
      pendingListings,
      activeListings,
      // Order stats
      totalOrders,
      activeOrders,
      completedOrders,
      disputedOrders,
      // User stats
      totalUsers,
      // Transaction stats
      transactions,
      // Recent activity
      recentOrders,
      recentSellerApplications,
    ] = await Promise.all([
      // Apps
      prisma.app.count(),
      prisma.app.count({ where: { enabled: true } }),
      
      // Sellers (users with isSeller flag)
      prisma.user.count({ where: { isSeller: true } }),
      prisma.user.count({ where: { sellerStatus: 'pending' } }),
      prisma.user.count({ where: { sellerStatus: 'approved', isSeller: true } }),
      
      // Listings
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'pending' } }),
      prisma.listing.count({ where: { status: 'live' } }),
      
      // Orders
      prisma.order.count(),
      prisma.order.count({ 
        where: { 
          status: { in: ['created', 'paid', 'accepted', 'in_progress', 'shipped'] } 
        } 
      }),
      prisma.order.count({ where: { status: 'completed' } }),
      prisma.order.count({ where: { status: 'disputed' } }),
      
      // Users
      prisma.user.count(),
      
      // Transactions - sum of completed order amounts
      prisma.order.aggregate({
        where: { status: 'completed' },
        _sum: { totalAmount: true },
        _count: true,
      }),
      
      // Recent orders (last 5)
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { handle: true, displayName: true } },
          listing: { select: { title: true } },
        }
      }),
      
      // Recent seller applications (last 5)
      prisma.sellerApplication.findMany({
        where: { status: 'pending' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { handle: true, displayName: true } }
        }
      }),
    ]);

    // Calculate completion rate
    const completionRate = totalOrders > 0 
      ? Math.round((completedOrders / totalOrders) * 100 * 10) / 10 
      : 0;

    // Calculate growth (comparing this week to last week)
    const thisWeekOrders = await prisma.order.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });
    
    const lastWeekOrders = await prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    const orderGrowth = lastWeekOrders > 0 
      ? Math.round(((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        apps: {
          total: totalApps,
          active: activeApps,
        },
        sellers: {
          total: totalSellers,
          pending: pendingSellers,
          active: activeSellers,
        },
        listings: {
          total: totalListings,
          pending: pendingListings,
          active: activeListings,
        },
        orders: {
          total: totalOrders,
          active: activeOrders,
          completed: completedOrders,
          disputed: disputedOrders,
          growth: orderGrowth,
        },
        users: {
          total: totalUsers,
          activeToday: 0, // Would need session tracking
        },
        revenue: {
          total: transactions._sum.totalAmount || 0,
          transactionCount: transactions._count,
          daily: [],
        },
        metrics: {
          completionRate,
        },
        recent: {
          orders: recentOrders.map(o => ({
            id: o.id,
            status: o.status,
            totalAmount: Number(o.totalAmount),
            createdAt: o.createdAt.toISOString(),
            user: { username: o.buyer?.handle || 'Unknown' },
            listing: { title: o.listing?.title || 'Unknown' },
          })),
          sellerApplications: recentSellerApplications.map(s => ({
            id: s.id,
            createdAt: s.createdAt.toISOString(),
            user: { username: s.user?.handle || 'Unknown' },
          })),
        },
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// GET /api/admin/stats/realtime - Lightweight stats for real-time updates
router.get('/realtime', adminAuth, async (_req: Request, res: Response) => {
  try {
    const [activeOrders, pendingListings, pendingSellers, disputedOrders] = await Promise.all([
      prisma.order.count({ where: { status: { in: ['created', 'paid', 'accepted', 'in_progress'] } } }),
      prisma.listing.count({ where: { status: 'pending' } }),
      prisma.user.count({ where: { sellerStatus: 'pending' } }),
      prisma.order.count({ where: { status: 'disputed' } }),
    ]);

    res.json({
      success: true,
      data: {
        activeOrders,
        pendingListings,
        pendingSellers,
        disputedOrders,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch realtime stats' });
  }
});

export default router;
