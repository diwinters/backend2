import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { adminAuth } from '../middleware/auth';

const router = Router();

// GET /api/admin/stats - Dashboard statistics
router.get('/', adminAuth, async (_req: Request, res: Response) => {
  try {
    // Gather all stats in parallel for performance
    const [
      // App stats
      totalApps,
      activeApps,
      // Seller stats
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
      activeUsersToday,
      // Transaction stats
      transactions,
      // Recent activity
      recentOrders,
      recentSellers,
    ] = await Promise.all([
      // Apps
      prisma.miniApp.count(),
      prisma.miniApp.count({ where: { enabled: true } }),
      
      // Sellers
      prisma.seller.count(),
      prisma.seller.count({ where: { status: 'pending' } }),
      prisma.seller.count({ where: { status: 'approved' } }),
      
      // Listings
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'pending' } }),
      prisma.listing.count({ where: { status: 'active' } }),
      
      // Orders
      prisma.order.count(),
      prisma.order.count({ 
        where: { 
          status: { in: ['pending', 'confirmed', 'processing', 'shipped'] } 
        } 
      }),
      prisma.order.count({ where: { status: 'completed' } }),
      prisma.order.count({ where: { status: 'disputed' } }),
      
      // Users
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastSeen: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      
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
          user: { select: { username: true } },
          listing: { select: { title: true } },
        }
      }),
      
      // Recent seller applications (last 5)
      prisma.seller.findMany({
        where: { status: 'pending' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { username: true } }
        }
      }),
    ]);

    // Calculate daily revenue (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyRevenue = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE status = 'completed' AND created_at >= ${sevenDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    ` as { date: Date; revenue: number; orders: number }[];

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
          activeToday: activeUsersToday,
        },
        revenue: {
          total: transactions._sum.totalAmount || 0,
          transactionCount: transactions._count,
          daily: dailyRevenue,
        },
        metrics: {
          completionRate,
        },
        recent: {
          orders: recentOrders,
          sellerApplications: recentSellers,
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
      prisma.order.count({ where: { status: { in: ['pending', 'confirmed', 'processing'] } } }),
      prisma.listing.count({ where: { status: 'pending' } }),
      prisma.seller.count({ where: { status: 'pending' } }),
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
