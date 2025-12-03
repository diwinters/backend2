import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { adminOnly, userAuth } from '../middleware/auth';
import { OrderService, OrderStatus } from '../services/OrderService';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const orderService = new OrderService();

// ==================== ADMIN ROUTES ====================

// GET /orders - List all orders (admin)
router.get('/', adminOnly, async (req: Request, res: Response) => {
  const { status, appId, page = '1', limit = '20' } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (appId) where.listing = { appId };

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: { id: true, did: true, handle: true, displayName: true },
        },
        seller: {
          select: { id: true, did: true, handle: true, displayName: true },
        },
        listing: {
          select: { id: true, title: true, appId: true },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return res.json({
    orders,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// GET /orders/:id - Get single order (admin)
router.get('/:id', adminOnly, async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      buyer: true,
      seller: true,
      listing: {
        include: { app: true },
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  return res.json(order);
});

// POST /orders/:id/resolve-dispute - Resolve dispute (admin)
router.post('/:id/resolve-dispute', adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    resolution: z.enum(['refund_buyer', 'release_to_seller', 'partial_refund']),
    refundAmount: z.number().optional(),
    notes: z.string().optional(),
  });

  try {
    const { resolution, refundAmount, notes } = schema.parse(req.body);

    const order = await orderService.resolveDispute(
      req.params.id,
      resolution,
      req.adminId!,
      refundAmount,
      notes
    );

    return res.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// ==================== USER ROUTES ====================

// GET /orders/my - Get current user's orders (buyer or seller)
router.get('/my/list', userAuth, async (req: Request, res: Response) => {
  const { role = 'buyer', status, page = '1', limit = '20' } = req.query;

  const where: any = {};
  
  if (role === 'buyer') {
    where.buyerId = req.userId;
  } else if (role === 'seller') {
    where.sellerId = req.userId;
  } else {
    // Both - orders where user is buyer or seller
    where.OR = [
      { buyerId: req.userId },
      { sellerId: req.userId },
    ];
  }

  if (status) {
    if (status === 'active') {
      where.status = { in: ['created', 'paid', 'accepted', 'in_progress', 'delivered'] };
    } else if (status === 'completed') {
      where.status = 'completed';
    } else if (status === 'disputed') {
      where.status = { in: ['disputed', 'cancelled', 'refunded'] };
    } else {
      where.status = status;
    }
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: { id: true, did: true, handle: true, displayName: true, avatarUrl: true },
        },
        seller: {
          select: { id: true, did: true, handle: true, displayName: true, avatarUrl: true },
        },
        listing: {
          select: { id: true, title: true, images: true, type: true },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return res.json({
    orders,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// GET /orders/my/:id - Get specific order for current user
router.get('/my/:id', userAuth, async (req: Request, res: Response) => {
  const order = await prisma.order.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { buyerId: req.userId },
        { sellerId: req.userId },
      ],
    },
    include: {
      buyer: {
        select: { id: true, did: true, handle: true, displayName: true, avatarUrl: true },
      },
      seller: {
        select: { id: true, did: true, handle: true, displayName: true, avatarUrl: true },
      },
      listing: {
        select: { 
          id: true, 
          title: true, 
          description: true,
          images: true, 
          type: true,
          price: true,
          currency: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  return res.json(order);
});

// POST /orders - Create new order (buyer)
router.post('/', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    listingId: z.string(),
    quantity: z.number().int().min(1).default(1),
    notes: z.string().optional(),
    deliveryAddress: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
      }).optional(),
    }).optional(),
  });

  try {
    const data = schema.parse(req.body);

    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { id: data.listingId },
    });

    if (!listing) {
      throw new AppError(404, 'Listing not found');
    }

    if (listing.status !== 'active') {
      throw new AppError(400, 'Listing is not available');
    }

    // Can't buy your own listing
    if (listing.sellerId === req.userId) {
      throw new AppError(400, 'Cannot purchase your own listing');
    }

    const totalAmount = listing.price * data.quantity;

    const order = await orderService.createOrder({
      buyerId: req.userId!,
      sellerId: listing.sellerId,
      listingId: listing.id,
      amount: totalAmount,
      currency: listing.currency,
      quantity: data.quantity,
      notes: data.notes,
      metadata: data.deliveryAddress ? { deliveryAddress: data.deliveryAddress } : undefined,
    });

    return res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/accept - Accept order (seller)
router.post('/:id/accept', userAuth, async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
  });

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  if (order.sellerId !== req.userId) {
    throw new AppError(403, 'Only the seller can accept this order');
  }

  const updatedOrder = await orderService.acceptOrder(req.params.id);
  return res.json(updatedOrder);
});

// POST /orders/:id/reject - Reject order (seller)
router.post('/:id/reject', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    reason: z.string().optional(),
  });

  try {
    const { reason } = schema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    if (order.sellerId !== req.userId) {
      throw new AppError(403, 'Only the seller can reject this order');
    }

    if (order.status !== 'paid') {
      throw new AppError(400, 'Order cannot be rejected in current status');
    }

    const updatedOrder = await orderService.updateStatus(
      req.params.id,
      'cancelled',
      { rejectionReason: reason }
    );

    return res.json(updatedOrder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/delivered - Mark as delivered (seller)
router.post('/:id/delivered', userAuth, async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
  });

  if (!order) {
    throw new AppError(404, 'Order not found');
  }

  if (order.sellerId !== req.userId) {
    throw new AppError(403, 'Only the seller can mark this order as delivered');
  }

  const updatedOrder = await orderService.markDelivered(req.params.id);
  return res.json(updatedOrder);
});

// POST /orders/:id/confirm - Confirm delivery (buyer)
router.post('/:id/confirm', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    rating: z.number().int().min(1).max(5).optional(),
    review: z.string().optional(),
  });

  try {
    const { rating, review } = schema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    if (order.buyerId !== req.userId) {
      throw new AppError(403, 'Only the buyer can confirm this order');
    }

    const updatedOrder = await orderService.confirmDelivery(req.params.id, rating, review);
    return res.json(updatedOrder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/dispute - Open dispute (buyer)
router.post('/:id/dispute', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    reason: z.string().min(10),
    evidence: z.array(z.string()).optional(), // URLs to images/documents
  });

  try {
    const { reason, evidence } = schema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    if (order.buyerId !== req.userId) {
      throw new AppError(403, 'Only the buyer can open a dispute');
    }

    const updatedOrder = await orderService.createDispute(req.params.id, reason);
    return res.json(updatedOrder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/update-location - Update delivery location (for taxi/delivery)
router.post('/:id/update-location', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    lat: z.number(),
    lng: z.number(),
    eta: z.number().optional(), // ETA in minutes
  });

  try {
    const { lat, lng, eta } = schema.parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    if (order.sellerId !== req.userId) {
      throw new AppError(403, 'Only the seller/driver can update location');
    }

    if (!['accepted', 'in_progress'].includes(order.status)) {
      throw new AppError(400, 'Cannot update location in current status');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        metadata: {
          ...(order.metadata as any),
          currentLocation: { lat, lng, updatedAt: new Date() },
          eta,
        },
      },
    });

    // Publish location update for real-time tracking
    const { redis } = await import('../lib/redis');
    await redis.publish(`order:${order.id}:location`, JSON.stringify({ lat, lng, eta }));

    return res.json(updatedOrder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

export default router;
