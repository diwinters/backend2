import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { adminOnly, userAuth } from '../middleware/auth.js';
import { orderService } from '../services/OrderService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// ==================== ADMIN ROUTES ====================

// GET /orders - List all orders (admin)
router.get('/', adminOnly, async (req: Request, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query;

  const where: any = {};
  if (status) where.status = status;

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
          select: { id: true, title: true },
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
      listing: true,
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

// ==================== USER ROUTES ====================

// GET /orders/my - Get current user's orders (buyer or seller)
router.get('/my/list', userAuth, async (req: Request, res: Response) => {
  const { role = 'buyer', status, page = '1', limit = '20' } = req.query;

  const where: any = {};
  
  if (role === 'buyer') {
    where.buyerId = req.user!.id;
  } else if (role === 'seller') {
    where.sellerId = req.user!.id;
  } else {
    // Both - orders where user is buyer or seller
    where.OR = [
      { buyerId: req.user!.id },
      { sellerId: req.user!.id },
    ];
  }

  if (status) {
    if (status === 'active') {
      where.status = { in: [OrderStatus.created, OrderStatus.paid, OrderStatus.accepted, OrderStatus.in_progress, OrderStatus.delivered] };
    } else if (status === 'completed') {
      where.status = OrderStatus.completed;
    } else if (status === 'disputed') {
      where.status = { in: [OrderStatus.disputed, OrderStatus.cancelled, OrderStatus.refunded] };
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
          select: { id: true, did: true, handle: true, displayName: true, avatar: true },
        },
        seller: {
          select: { id: true, did: true, handle: true, displayName: true, avatar: true },
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
        { buyerId: req.user!.id },
        { sellerId: req.user!.id },
      ],
    },
    include: {
      buyer: {
        select: { id: true, did: true, handle: true, displayName: true, avatar: true },
      },
      seller: {
        select: { id: true, did: true, handle: true, displayName: true, avatar: true },
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

    if (listing.status !== 'live') {
      throw new AppError(400, 'Listing is not available');
    }

    // Can't buy your own listing
    if (listing.userId === req.user!.id) {
      throw new AppError(400, 'Cannot purchase your own listing');
    }

    const metadata = data.deliveryAddress ? { deliveryAddress: data.deliveryAddress, notes: data.notes } : { notes: data.notes };

    const order = await orderService.create(
      req.user!.id,
      listing.id,
      data.quantity,
      metadata,
    );

    return res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/pay - Pay for order (buyer)
router.post('/:id/pay', userAuth, async (req: Request, res: Response) => {
  const order = await orderService.pay(req.params.id, req.user!.id);
  return res.json(order);
});

// POST /orders/:id/accept - Accept order (seller)
router.post('/:id/accept', userAuth, async (req: Request, res: Response) => {
  const order = await orderService.accept(req.params.id, req.user!.id);
  return res.json(order);
});

// POST /orders/:id/reject - Reject order (seller)
router.post('/:id/reject', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    reason: z.string().optional(),
  });

  try {
    const { reason } = schema.parse(req.body);
    const order = await orderService.reject(req.params.id, req.user!.id, reason);
    return res.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/ship - Mark as shipped (seller)
router.post('/:id/ship', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    trackingNumber: z.string().optional(),
    carrier: z.string().optional(),
  });

  try {
    const trackingInfo = schema.parse(req.body);
    const order = await orderService.ship(req.params.id, req.user!.id, trackingInfo);
    return res.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/delivered - Mark as delivered (seller)
router.post('/:id/delivered', userAuth, async (req: Request, res: Response) => {
  const order = await orderService.markDelivered(req.params.id, req.user!.id);
  return res.json(order);
});

// POST /orders/:id/confirm - Confirm delivery (buyer)
router.post('/:id/confirm', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    rating: z.number().int().min(1).max(5).optional(),
  });

  try {
    const { rating } = schema.parse(req.body);
    const order = await orderService.complete(req.params.id, req.user!.id, rating);
    return res.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/cancel - Cancel order
router.post('/:id/cancel', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    reason: z.string().optional(),
  });

  try {
    const { reason } = schema.parse(req.body);
    const order = await orderService.cancel(req.params.id, req.user!.id, reason);
    return res.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /orders/:id/dispute - Open dispute (buyer or seller)
router.post('/:id/dispute', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    reason: z.string().min(10),
    description: z.string().optional(),
  });

  try {
    const { reason, description } = schema.parse(req.body);
    const order = await orderService.openDispute(req.params.id, req.user!.id, reason, description);
    return res.json(order);
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

    if (order.sellerId !== req.user!.id) {
      throw new AppError(403, 'Only the seller/driver can update location');
    }

    if (![OrderStatus.accepted, OrderStatus.in_progress].includes(order.status)) {
      throw new AppError(400, 'Cannot update location in current status');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        metadata: {
          ...(order.metadata as object || {}),
          currentLocation: { lat, lng, updatedAt: new Date().toISOString() },
          eta,
        },
      },
    });

    // Publish location update for real-time tracking
    const { redis } = await import('../lib/redis.js');
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
