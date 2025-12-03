import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { userAuth } from '../middleware/auth';

const router = Router();

// Cache TTL
const CACHE_TTL = 300; // 5 minutes

// GET /config/apps - Get all active apps configuration for mobile
// This is the primary endpoint called by mobile app to get tab configuration
router.get('/apps', userAuth, async (req: Request, res: Response) => {
  const cacheKey = 'config:apps:active';
  
  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    
    // ETag support for client caching
    const etag = req.headers['if-none-match'];
    if (etag === data.etag) {
      return res.status(304).send();
    }
    
    res.setHeader('ETag', data.etag);
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.json(data.apps);
  }

  // Fetch active apps
  const apps = await prisma.app.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      icon: true,
      description: true,
      config: true,
      order: true,
    },
  });

  // Generate ETag
  const etag = `"${Buffer.from(JSON.stringify(apps)).toString('base64').slice(0, 20)}"`;
  
  // Cache result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify({ apps, etag }));

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=60');
  return res.json(apps);
});

// GET /config/app/:slug - Get single app config by slug
router.get('/app/:slug', userAuth, async (req: Request, res: Response) => {
  const cacheKey = `config:app:${req.params.slug}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const app = await prisma.app.findFirst({
    where: { 
      slug: req.params.slug,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      icon: true,
      description: true,
      config: true,
    },
  });

  if (!app) {
    return res.status(404).json({ error: 'App not found' });
  }

  // Cache result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(app));

  return res.json(app);
});

// GET /config/commission - Get current commission rates
router.get('/commission', async (req: Request, res: Response) => {
  // Could be stored in database or env
  const commission = {
    rate: 0.05, // 5%
    minAmount: 100, // $1.00 minimum
    maxAmount: 100000, // $1000 maximum per transaction
  };
  
  return res.json(commission);
});

// GET /config/currencies - Get supported currencies
router.get('/currencies', async (req: Request, res: Response) => {
  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    // Add more currencies as needed
  ];
  
  return res.json(currencies);
});

// GET /config/categories - Get listing categories
router.get('/categories', async (req: Request, res: Response) => {
  const categories = {
    product: [
      'Electronics', 'Fashion', 'Home & Garden', 'Sports', 'Collectibles', 'Other'
    ],
    experience: [
      'Tours', 'Activities', 'Classes', 'Events', 'Workshops'
    ],
    room: [
      'Apartment', 'House', 'Room', 'Hotel', 'Unique Space'
    ],
    service: [
      'Delivery', 'Taxi', 'Professional', 'Creative', 'Technical'
    ],
  };
  
  return res.json(categories);
});

export default router;
