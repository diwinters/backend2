import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { adminAuth, userAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Cache TTL
const CACHE_TTL = 300; // 5 minutes

// Validation schemas
const createListingSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  type: z.enum(['product', 'experience', 'room', 'service']),
  price: z.number().min(0),
  currency: z.string().default('USD'),
  images: z.array(z.string().url()).min(1).max(10),
  location: z.object({
    address: z.string().optional(),
    city: z.string(),
    country: z.string(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
  // Type-specific fields
  availability: z.array(z.object({
    date: z.string(),
    slots: z.number().int().optional(),
  })).optional(),
  duration: z.number().int().optional(), // For experiences/services, in minutes
  maxGuests: z.number().int().optional(), // For rooms/experiences
  amenities: z.array(z.string()).optional(), // For rooms
  includes: z.array(z.string()).optional(), // For experiences
  requirements: z.array(z.string()).optional(), // For experiences
});

const updateListingSchema = createListingSchema.partial();

// ==================== ADMIN ROUTES ====================

// GET /listings/pending - Get pending listings for approval (admin)
router.get('/pending', adminAuth, async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where: { status: 'pending' },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            did: true,
            handle: true,
            displayName: true,
            avatar: true,
            rating: true,
          },
        },
      },
    }),
    prisma.listing.count({ where: { status: 'pending' } }),
  ]);

  return res.json({
    listings,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// POST /listings/:id/approve - Approve listing (admin)
router.post('/:id/approve', adminAuth, async (req: Request, res: Response) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
  });

  if (!listing) {
    throw new AppError(404, 'Listing not found');
  }

  if (listing.status !== 'pending') {
    throw new AppError(400, 'Listing is not pending approval');
  }

  await prisma.listing.update({
    where: { id: listing.id },
    data: { 
      status: 'approved',
      reviewedById: req.admin?.id,
      reviewedAt: new Date(),
    },
  });

  // Notify seller
  const { NotificationService } = await import('../services/NotificationService.js');
  const notificationService = new NotificationService();
  await notificationService.create(
    listing.userId,
    'listing_approved',
    'Listing Approved!',
    `Your listing "${listing.title}" has been approved.`,
    { listingId: listing.id }
  );

  return res.json({ message: 'Listing approved' });
});

// POST /listings/:id/reject - Reject listing (admin)
router.post('/:id/reject', adminAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    reason: z.string().min(10),
  });

  try {
    const { reason } = schema.parse(req.body);

    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      throw new AppError(404, 'Listing not found');
    }

    if (listing.status !== 'pending') {
      throw new AppError(400, 'Listing is not pending approval');
    }

    await prisma.listing.update({
      where: { id: listing.id },
      data: { 
        status: 'rejected',
        reviewedById: req.admin?.id,
        reviewedAt: new Date(),
        reviewNotes: reason,
      },
    });

    // Notify seller
    const { NotificationService } = await import('../services/NotificationService.js');
    const notificationService = new NotificationService();
    await notificationService.create(
      listing.userId,
      'listing_rejected',
      'Listing Not Approved',
      `Your listing "${listing.title}" was not approved. Reason: ${reason}`,
      { listingId: listing.id }
    );

    return res.json({ message: 'Listing rejected' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// GET /listings - List all listings (admin)
router.get('/', adminAuth, async (req: Request, res: Response) => {
  const { status, type, page = '1', limit = '20' } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { handle: true, displayName: true },
        },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  return res.json({
    listings,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// ==================== USER ROUTES (SELLER) ====================

// GET /listings/my - Get seller's listings
router.get('/my', userAuth, async (req: Request, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query;

  const where: any = { userId: req.user?.id };
  if (status) where.status = status;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  return res.json({
    listings,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
});

// POST /listings - Create listing (seller)
router.post('/', userAuth, async (req: Request, res: Response) => {
  try {
    const data = createListingSchema.parse(req.body);

    // Verify user is a seller
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
    });

    if (!user || !user.isSeller) {
      throw new AppError(403, 'Must be an approved seller to create listings');
    }

    const listing = await prisma.listing.create({
      data: {
        userId: req.user!.id,
        title: data.title,
        description: data.description,
        type: data.type,
        price: data.price,
        currency: data.currency,
        images: data.images,
        metadata: {
          ...data.metadata,
          location: data.location,
          availability: data.availability,
          duration: data.duration,
          maxGuests: data.maxGuests,
          amenities: data.amenities,
          includes: data.includes,
          requirements: data.requirements,
        },
        status: 'pending', // Requires admin approval
      },
    });

    return res.status(201).json(listing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// PUT /listings/:id - Update listing (seller)
router.put('/:id', userAuth, async (req: Request, res: Response) => {
  try {
    const data = updateListingSchema.parse(req.body);

    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      throw new AppError(404, 'Listing not found');
    }

    if (listing.userId !== req.user?.id) {
      throw new AppError(403, 'Not authorized to update this listing');
    }

    // If listing is approved and significant changes made, set back to pending
    const needsReapproval = listing.status === 'approved' && (
      data.title || data.description || data.price || data.images
    );

    const updatedListing = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        price: data.price,
        currency: data.currency,
        images: data.images,
        metadata: {
          ...(listing.metadata as any),
          ...data.metadata,
          location: data.location,
          availability: data.availability,
          duration: data.duration,
          maxGuests: data.maxGuests,
          amenities: data.amenities,
          includes: data.includes,
          requirements: data.requirements,
        },
        status: needsReapproval ? 'pending' : listing.status,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await redis.del(`listing:${listing.id}`);

    return res.json(updatedListing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// DELETE /listings/:id - Delete/deactivate listing (seller)
router.delete('/:id', userAuth, async (req: Request, res: Response) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { orders: true } } },
  });

  if (!listing) {
    throw new AppError(404, 'Listing not found');
  }

  if (listing.userId !== req.user?.id) {
    throw new AppError(403, 'Not authorized to delete this listing');
  }

  // If has orders, just mark as deleted
  if (listing._count.orders > 0) {
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'deleted' },
    });
  } else {
    await prisma.listing.delete({
      where: { id: listing.id },
    });
  }

  // Invalidate cache
  await redis.del(`listing:${listing.id}`);

  return res.status(204).send();
});

// ==================== PUBLIC/MOBILE ROUTES ====================

// GET /listings/browse - Get listings for browsing (mobile)
router.get('/browse', userAuth, async (req: Request, res: Response) => {
  const { type, minPrice, maxPrice, page = '1', limit = '20', sort = 'newest' } = req.query;

  const cacheKey = `listings:browse:${JSON.stringify(req.query)}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const where: any = {
    status: 'approved', // Use approved status as per schema
  };

  if (type) where.type = type;
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseInt(minPrice as string);
    if (maxPrice) where.price.lte = parseInt(maxPrice as string);
  }

  // Sort options
  let orderBy: any;
  switch (sort) {
    case 'price_low':
      orderBy = { price: 'asc' };
      break;
    case 'price_high':
      orderBy = { price: 'desc' };
      break;
    case 'rating':
      orderBy = { user: { rating: 'desc' } };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        price: true,
        currency: true,
        images: true,
        metadata: true,
        user: {
          select: {
            id: true,
            did: true,
            handle: true,
            displayName: true,
            avatar: true,
            rating: true,
            ratingCount: true,
          },
        },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  const result = {
    listings,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  };

  // Cache for 1 minute
  await redis.setex(cacheKey, 60, JSON.stringify(result));

  return res.json(result);
});

// GET /listings/detail/:id - Get single listing (mobile)
router.get('/detail/:id', userAuth, async (req: Request, res: Response) => {
  const cacheKey = `listing:${req.params.id}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: {
      user: {
        select: {
          id: true,
          did: true,
          handle: true,
          displayName: true,
          avatar: true,
          rating: true,
          ratingCount: true,
        },
      },
    },
  });

  if (!listing || (listing.status !== 'approved' && listing.status !== 'live')) {
    throw new AppError(404, 'Listing not found');
  }

  // Cache for 5 minutes
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(listing));

  return res.json(listing);
});

export default router;
