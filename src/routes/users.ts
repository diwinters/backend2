import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ListingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { userAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// POST /users/sync - Sync/create user from Bluesky DID
// Called when mobile app authenticates
router.post('/sync', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    did: z.string(),
    handle: z.string(),
    displayName: z.string().optional(),
    avatar: z.string().url().optional(),
  });

  try {
    const data = schema.parse(req.body);

    // Verify DID matches auth header
    if (data.did !== req.user!.did) {
      throw new AppError(400, 'DID mismatch');
    }

    const user = await prisma.user.upsert({
      where: { did: data.did },
      update: {
        handle: data.handle,
        displayName: data.displayName,
        avatar: data.avatar,
      },
      create: {
        did: data.did,
        handle: data.handle,
        displayName: data.displayName,
        avatar: data.avatar,
      },
      select: {
        id: true,
        did: true,
        handle: true,
        displayName: true,
        avatar: true,
        walletBalance: true,
        heldBalance: true,
        isSeller: true,
        rating: true,
        ratingCount: true,
        createdAt: true,
      },
    });

    return res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// GET /users/me - Get current user profile
router.get('/me', userAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      did: true,
      handle: true,
      displayName: true,
      avatar: true,
      walletBalance: true,
      heldBalance: true,
      isSeller: true,
      sellerStatus: true,
      rating: true,
      ratingCount: true,
      createdAt: true,
      _count: {
        select: {
          ordersAsBuyer: true,
          ordersAsSeller: true,
          listings: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return res.json(user);
});

// GET /users/:did - Get user by DID (public profile)
router.get('/:did', userAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { did: req.params.did },
    select: {
      id: true,
      did: true,
      handle: true,
      displayName: true,
      avatar: true,
      isSeller: true,
      rating: true,
      ratingCount: true,
      createdAt: true,
      // Only show listings if seller
      listings: {
        where: { status: ListingStatus.live },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          price: true,
          currency: true,
          images: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return res.json(user);
});

// PUT /users/me - Update current user profile
router.put('/me', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    displayName: z.string().max(100).optional(),
    avatar: z.string().url().optional(),
  });

  try {
    const data = schema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        displayName: data.displayName,
        avatar: data.avatar,
      },
      select: {
        id: true,
        did: true,
        handle: true,
        displayName: true,
        avatar: true,
        isSeller: true,
      },
    });

    return res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// GET /users/me/activity - Get user's recent activity
router.get('/me/activity', userAuth, async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  // Get recent orders (as buyer or seller)
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { buyerId: req.user!.id },
        { sellerId: req.user!.id },
      ],
    },
    skip,
    take,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      updatedAt: true,
      buyer: {
        select: { handle: true, displayName: true, avatar: true },
      },
      seller: {
        select: { handle: true, displayName: true, avatar: true },
      },
      listing: {
        select: { title: true, images: true },
      },
    },
  });

  // Get recent transactions
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.user!.id },
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      amount: true,
      status: true,
      description: true,
      createdAt: true,
    },
  });

  return res.json({
    orders,
    transactions,
  });
});

export default router;
