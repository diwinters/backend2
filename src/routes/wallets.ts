import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { adminOnly, userAuth } from '../middleware/auth';
import { WalletService } from '../services/WalletService';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const walletService = new WalletService();

// ==================== ADMIN ROUTES ====================

// GET /wallets - List all users with wallet info (admin)
router.get('/', adminOnly, async (req: Request, res: Response) => {
  const { page = '1', limit = '20', minBalance } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = {};
  if (minBalance) {
    where.walletBalance = { gte: parseInt(minBalance as string) };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { walletBalance: 'desc' },
      select: {
        id: true,
        did: true,
        handle: true,
        displayName: true,
        walletBalance: true,
        walletHeld: true,
        _count: {
          select: {
            buyerOrders: true,
            sellerOrders: true,
            transactions: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return res.json({
    users,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// GET /wallets/:userId/transactions - Get user's transactions (admin)
router.get('/:userId/transactions', adminOnly, async (req: Request, res: Response) => {
  const { page = '1', limit = '50', type } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { userId: req.params.userId };
  if (type) where.type = type;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: { id: true, listing: { select: { title: true } } },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return res.json({
    transactions,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// POST /wallets/:userId/adjust - Manual balance adjustment (admin)
router.post('/:userId/adjust', adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    amount: z.number().int(),
    type: z.enum(['credit', 'debit']),
    reason: z.string().min(5),
  });

  try {
    const { amount, type, reason } = schema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (type === 'debit' && user.walletBalance < amount) {
      throw new AppError(400, 'Insufficient balance for debit');
    }

    // Create adjustment transaction
    const transaction = await prisma.$transaction(async (tx) => {
      const newBalance = type === 'credit' 
        ? user.walletBalance + amount 
        : user.walletBalance - amount;

      await tx.user.update({
        where: { id: user.id },
        data: { walletBalance: newBalance },
      });

      return tx.transaction.create({
        data: {
          userId: user.id,
          type: type === 'credit' ? 'deposit' : 'withdrawal',
          amount: type === 'credit' ? amount : -amount,
          currency: 'USD',
          status: 'completed',
          description: `Admin adjustment: ${reason}`,
          metadata: { adminId: req.adminId, reason },
        },
      });
    });

    return res.json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// ==================== USER ROUTES ====================

// GET /wallets/my - Get current user's wallet
router.get('/my', userAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      walletBalance: true,
      walletHeld: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return res.json({
    balance: user.walletBalance,
    held: user.walletHeld,
    available: user.walletBalance - user.walletHeld,
  });
});

// GET /wallets/my/transactions - Get current user's transactions
router.get('/my/transactions', userAuth, async (req: Request, res: Response) => {
  const { page = '1', limit = '20', type } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { userId: req.userId };
  if (type) where.type = type;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: { 
            id: true, 
            listing: { 
              select: { title: true, images: true } 
            } 
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return res.json({
    transactions,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// POST /wallets/my/deposit - Request deposit (generates payment info)
// In production, this would integrate with payment processor
router.post('/my/deposit', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    amount: z.number().int().min(100), // Minimum $1.00 (in cents)
    method: z.enum(['card', 'bank_transfer', 'crypto']).default('card'),
  });

  try {
    const { amount, method } = schema.parse(req.body);

    // Create pending deposit transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.userId!,
        type: 'deposit',
        amount,
        currency: 'USD',
        status: 'pending',
        description: `Deposit via ${method}`,
        metadata: { method },
      },
    });

    // In production, this would return payment processor info
    // For now, return the transaction with mock payment URL
    return res.status(201).json({
      transaction,
      paymentUrl: `https://pay.example.com/deposit/${transaction.id}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /wallets/my/withdraw - Request withdrawal
router.post('/my/withdraw', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    amount: z.number().int().min(1000), // Minimum $10.00 (in cents)
    method: z.enum(['bank_transfer', 'crypto']),
    destination: z.object({
      // Bank transfer
      accountNumber: z.string().optional(),
      routingNumber: z.string().optional(),
      accountName: z.string().optional(),
      // Crypto
      walletAddress: z.string().optional(),
      network: z.string().optional(),
    }),
  });

  try {
    const { amount, method, destination } = schema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const available = user.walletBalance - user.walletHeld;
    if (available < amount) {
      throw new AppError(400, `Insufficient available balance. Available: ${available}`);
    }

    // Must be approved seller for large withdrawals
    if (amount > 10000 && !user.isSeller) {
      throw new AppError(400, 'Seller status required for withdrawals over $100');
    }

    // Create pending withdrawal
    const transaction = await prisma.$transaction(async (tx) => {
      // Hold the amount
      await tx.user.update({
        where: { id: user.id },
        data: { walletHeld: { increment: amount } },
      });

      return tx.transaction.create({
        data: {
          userId: user.id,
          type: 'withdrawal',
          amount: -amount,
          currency: 'USD',
          status: 'pending',
          description: `Withdrawal via ${method}`,
          metadata: { method, destination },
        },
      });
    });

    return res.status(201).json({
      transaction,
      estimatedArrival: method === 'bank_transfer' 
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
        : new Date(Date.now() + 60 * 60 * 1000), // 1 hour for crypto
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// Webhook endpoint to confirm deposits (would be called by payment processor)
router.post('/webhook/deposit-confirm', async (req: Request, res: Response) => {
  const schema = z.object({
    transactionId: z.string(),
    status: z.enum(['completed', 'failed']),
    externalId: z.string().optional(),
  });

  // In production, verify webhook signature here

  try {
    const { transactionId, status, externalId } = schema.parse(req.body);

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.type !== 'deposit' || transaction.status !== 'pending') {
      throw new AppError(400, 'Invalid transaction');
    }

    if (status === 'completed') {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: transaction.userId },
          data: { walletBalance: { increment: transaction.amount } },
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { 
            status: 'completed',
            metadata: { ...(transaction.metadata as any), externalId },
          },
        });
      });
    } else {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'failed' },
      });
    }

    return res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

export default router;
