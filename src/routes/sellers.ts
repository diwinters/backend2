import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SellerStatus, NotificationType, ListingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { adminOnly, userAuth } from '../middleware/auth.js';
import { notificationService } from '../services/NotificationService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

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
            avatar: true,
            createdAt: true,
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

  if (application.status !== SellerStatus.pending) {
    throw new AppError(400, 'Application is not pending');
  }

  await prisma.$transaction(async (tx) => {
    // Update application
    await tx.sellerApplication.update({
      where: { id: application.id },
      data: {
        status: SellerStatus.approved,
        reviewedAt: new Date(),
        reviewedById: req.admin!.id,
      },
    });

    // Make user a seller
    await tx.user.update({
      where: { id: application.userId },
      data: { 
        isSeller: true,
        sellerStatus: SellerStatus.approved,
      },
    });
  });

  // Notify user
  await notificationService.create(
    application.userId,
    NotificationType.seller_application_approved,
    'Seller Application Approved!',
    'Congratulations! Your seller application has been approved. You can now create listings.',
  );

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

    if (application.status !== SellerStatus.pending) {
      throw new AppError(400, 'Application is not pending');
    }

    await prisma.sellerApplication.update({
      where: { id: application.id },
      data: {
        status: SellerStatus.rejected,
        reviewNotes: reason,
        reviewedAt: new Date(),
        reviewedById: req.admin!.id,
      },
    });

    // Notify user
    await notificationService.create(
      application.userId,
      NotificationType.seller_application_rejected,
      'Seller Application Update',
      `Your seller application was not approved. Reason: ${reason}`,
    );

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
        avatar: true,
        walletBalance: true,
        rating: true,
        ratingCount: true,
        createdAt: true,
        _count: {
          select: {
            listings: true,
            ordersAsSeller: true,
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
      // Update seller status
      await tx.user.update({
        where: { id: user.id },
        data: { 
          isSeller: false,
          sellerStatus: SellerStatus.suspended,
        },
      });

      // Deactivate all listings
      await tx.listing.updateMany({
        where: { userId: user.id },
        data: { status: ListingStatus.paused },
      });
    });

    // Notify user
    await notificationService.create(
      user.id,
      NotificationType.system_message,
      'Seller Account Suspended',
      `Your seller account has been suspended. Reason: ${reason}`,
    );

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
    where: { id: req.user!.id },
    select: {
      isSeller: true,
      sellerStatus: true,
      rating: true,
      ratingCount: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Check for application
  const application = await prisma.sellerApplication.findFirst({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    isSeller: user.isSeller,
    sellerStatus: user.sellerStatus,
    rating: user.rating,
    ratingCount: user.ratingCount,
    application: application ? {
      status: application.status,
      submittedAt: application.createdAt,
      reviewedAt: application.reviewedAt,
      reviewNotes: application.reviewNotes,
    } : null,
  });
});

// POST /sellers/apply - Submit seller application
router.post('/apply', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    businessName: z.string().min(2).max(100),
    businessType: z.enum(['individual', 'business']),
    description: z.string().min(50).max(1000),
    website: z.string().url().optional(),
    socialLinks: z.array(z.string().url()).optional(),
    documents: z.array(z.string()).optional(), // URLs to uploaded documents
  });

  try {
    const data = schema.parse(req.body);

    // Check if already a seller
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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
        userId: req.user!.id,
        status: SellerStatus.pending,
      },
    });

    if (existing) {
      throw new AppError(400, 'You already have a pending application');
    }

    const application = await prisma.sellerApplication.create({
      data: {
        userId: req.user!.id,
        businessName: data.businessName,
        businessType: data.businessType,
        description: data.description,
        documents: {
          website: data.website,
          socialLinks: data.socialLinks,
          files: data.documents,
        },
      },
    });

    // Update user seller status
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { sellerStatus: SellerStatus.pending },
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
    where: { id: req.user!.id },
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
    prisma.listing.count({ where: { userId: req.user!.id } }),
    prisma.listing.count({ where: { userId: req.user!.id, status: ListingStatus.live } }),
    prisma.order.count({ where: { sellerId: req.user!.id } }),
    prisma.order.count({ where: { sellerId: req.user!.id, status: 'completed' } }),
    prisma.order.count({ 
      where: { 
        sellerId: req.user!.id, 
        status: { in: ['paid', 'accepted', 'in_progress', 'delivered'] } 
      } 
    }),
    prisma.transaction.aggregate({
      where: {
        userId: req.user!.id,
        type: 'release',
        status: 'completed',
      },
      _sum: { amount: true },
    }),
    prisma.order.findMany({
      where: { sellerId: req.user!.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: { handle: true, displayName: true, avatar: true },
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
    revenue: totalRevenue._sum?.amount || 0,
    rating: user.rating,
    ratingCount: user.ratingCount,
    recentOrders,
  });
});

export default router;
