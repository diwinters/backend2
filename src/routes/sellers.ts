import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { adminOnly, userAuth } from '../middleware/auth';
import { NotificationService } from '../services/NotificationService';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const notificationService = new NotificationService();

// ==================== ADMIN ROUTES ====================

// GET /sellers/applications - List seller applications (admin)
router.get('/applications', adminOnly, async (req: Request, res: Response) => {
  const { status = 'pending', page = '1', limit = '20' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = {};
  if (status !== 'all') where.status = status;

  const [applications, total] = await Promise.all([
    prisma.sellerApplication.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            did: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            createdAt: true,
            _count: {
              select: { buyerOrders: true },
            },
          },
        },
      },
    }),
    prisma.sellerApplication.count({ where }),
  ]);

  return res.json({
    applications,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// POST /sellers/applications/:id/approve - Approve seller application (admin)
router.post('/applications/:id/approve', adminOnly, async (req: Request, res: Response) => {
  const application = await prisma.sellerApplication.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });

  if (!application) {
    throw new AppError(404, 'Application not found');
  }

  if (application.status !== 'pending') {
    throw new AppError(400, 'Application is not pending');
  }

  await prisma.$transaction(async (tx) => {
    // Update application
    await tx.sellerApplication.update({
      where: { id: application.id },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: req.adminId,
      },
    });

    // Make user a seller
    await tx.user.update({
      where: { id: application.userId },
      data: { isSeller: true },
    });
  });

  // Notify user
  await notificationService.create({
    userId: application.userId,
    type: 'seller_approved',
    title: 'Seller Application Approved!',
    body: 'Congratulations! Your seller application has been approved. You can now create listings.',
  });

  return res.json({ message: 'Application approved' });
});

// POST /sellers/applications/:id/reject - Reject seller application (admin)
router.post('/applications/:id/reject', adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    reason: z.string().min(10),
  });

  try {
    const { reason } = schema.parse(req.body);

    const application = await prisma.sellerApplication.findUnique({
      where: { id: req.params.id },
    });

    if (!application) {
      throw new AppError(404, 'Application not found');
    }

    if (application.status !== 'pending') {
      throw new AppError(400, 'Application is not pending');
    }

    await prisma.sellerApplication.update({
      where: { id: application.id },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedBy: req.adminId,
      },
    });

    // Notify user
    await notificationService.create({
      userId: application.userId,
      type: 'seller_rejected',
      title: 'Seller Application Update',
      body: `Your seller application was not approved. Reason: ${reason}`,
    });

    return res.json({ message: 'Application rejected' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// GET /sellers - List all sellers (admin)
router.get('/', adminOnly, async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [sellers, total] = await Promise.all([
    prisma.user.findMany({
      where: { isSeller: true },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        did: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        walletBalance: true,
        sellerRating: true,
        sellerReviewCount: true,
        createdAt: true,
        _count: {
          select: {
            listings: true,
            sellerOrders: true,
          },
        },
      },
    }),
    prisma.user.count({ where: { isSeller: true } }),
  ]);

  return res.json({
    sellers,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// POST /sellers/:id/suspend - Suspend seller (admin)
router.post('/:id/suspend', adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    reason: z.string().min(10),
  });

  try {
    const { reason } = schema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user || !user.isSeller) {
      throw new AppError(404, 'Seller not found');
    }

    await prisma.$transaction(async (tx) => {
      // Remove seller status
      await tx.user.update({
        where: { id: user.id },
        data: { isSeller: false },
      });

      // Deactivate all listings
      await tx.listing.updateMany({
        where: { sellerId: user.id },
        data: { status: 'inactive' },
      });
    });

    // Notify user
    await notificationService.create({
      userId: user.id,
      type: 'seller_suspended',
      title: 'Seller Account Suspended',
      body: `Your seller account has been suspended. Reason: ${reason}`,
    });

    return res.json({ message: 'Seller suspended' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// ==================== USER ROUTES ====================

// GET /sellers/my/status - Get current user's seller status
router.get('/my/status', userAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      isSeller: true,
      sellerRating: true,
      sellerReviewCount: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Check for pending application
  const application = await prisma.sellerApplication.findFirst({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    isSeller: user.isSeller,
    rating: user.sellerRating,
    reviewCount: user.sellerReviewCount,
    application: application ? {
      status: application.status,
      submittedAt: application.createdAt,
      reviewedAt: application.reviewedAt,
      rejectionReason: application.rejectionReason,
    } : null,
  });
});

// POST /sellers/apply - Submit seller application
router.post('/apply', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    businessName: z.string().min(2).max(100),
    businessType: z.enum(['individual', 'business']),
    description: z.string().min(50).max(1000),
    category: z.enum(['products', 'experiences', 'services', 'accommodations']),
    website: z.string().url().optional(),
    socialLinks: z.array(z.string().url()).optional(),
    documents: z.array(z.string()).optional(), // URLs to uploaded documents
  });

  try {
    const data = schema.parse(req.body);

    // Check if already a seller
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (user.isSeller) {
      throw new AppError(400, 'Already a seller');
    }

    // Check for pending application
    const existing = await prisma.sellerApplication.findFirst({
      where: {
        userId: req.userId,
        status: 'pending',
      },
    });

    if (existing) {
      throw new AppError(400, 'You already have a pending application');
    }

    const application = await prisma.sellerApplication.create({
      data: {
        userId: req.userId!,
        businessName: data.businessName,
        businessType: data.businessType,
        description: data.description,
        category: data.category,
        metadata: {
          website: data.website,
          socialLinks: data.socialLinks,
          documents: data.documents,
        },
      },
    });

    return res.status(201).json({
      message: 'Application submitted successfully',
      applicationId: application.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// GET /sellers/my/stats - Get seller statistics
router.get('/my/stats', userAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
  });

  if (!user || !user.isSeller) {
    throw new AppError(403, 'Not a seller');
  }

  const [
    totalListings,
    activeListings,
    totalOrders,
    completedOrders,
    pendingOrders,
    totalRevenue,
    recentOrders,
  ] = await Promise.all([
    prisma.listing.count({ where: { sellerId: req.userId } }),
    prisma.listing.count({ where: { sellerId: req.userId, status: 'active' } }),
    prisma.order.count({ where: { sellerId: req.userId } }),
    prisma.order.count({ where: { sellerId: req.userId, status: 'completed' } }),
    prisma.order.count({ 
      where: { 
        sellerId: req.userId, 
        status: { in: ['paid', 'accepted', 'in_progress', 'delivered'] } 
      } 
    }),
    prisma.transaction.aggregate({
      where: {
        userId: req.userId,
        type: 'sale',
        status: 'completed',
      },
      _sum: { amount: true },
    }),
    prisma.order.findMany({
      where: { sellerId: req.userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: { handle: true, displayName: true, avatarUrl: true },
        },
        listing: {
          select: { title: true },
        },
      },
    }),
  ]);

  return res.json({
    listings: {
      total: totalListings,
      active: activeListings,
    },
    orders: {
      total: totalOrders,
      completed: completedOrders,
      pending: pendingOrders,
    },
    revenue: totalRevenue._sum.amount || 0,
    rating: user.sellerRating,
    reviewCount: user.sellerReviewCount,
    recentOrders,
  });
});

export default router;
