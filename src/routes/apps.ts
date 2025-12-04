import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { adminAuth, userAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes

// Validation schemas
const feedConfigSchema = z.object({
  feed: z.string(), // AT URI of the feed generator or 'following' for timeline
  feedType: z.enum(['feed', 'list']), // 'feed' for feed generator, 'list' for list
  displayMode: z.enum(['timeline', 'grid', 'immersive']).default('timeline'),
  // Immersive mode options
  immersiveStartPosition: z.enum(['top', 'latest', 'random']).optional(), // Which post to start with
  autoPlay: z.boolean().optional(), // Auto-play videos in immersive mode
});

const moduleConfigSchema = z.object({
  layouts: z.array(z.object({
    id: z.string(),
    type: z.enum(['list', 'grid', 'card', 'form', 'map', 'carousel']),
    title: z.string().optional(),
    dataSource: z.string().optional(),
    refreshInterval: z.number().optional(),
    fields: z.array(z.any()).optional(),
    actions: z.array(z.any()).optional(),
    style: z.record(z.any()).optional(),
  })),
  dataEndpoints: z.record(z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    url: z.string(),
    auth: z.boolean().optional(),
    transform: z.string().optional(),
  })).optional(),
  actions: z.record(z.object({
    type: z.enum(['api', 'navigation', 'dm', 'wallet']),
    config: z.record(z.any()),
  })).optional(),
  theme: z.object({
    primaryColor: z.string().optional(),
    backgroundColor: z.string().optional(),
  }).optional(),
});

const homeConfigSchema = z.object({
  widgets: z.array(z.object({
    id: z.string(),
    type: z.enum(['feed_preview', 'quick_actions', 'stats', 'recent_orders', 'notifications', 'featured']),
    appId: z.string().optional(),
    config: z.record(z.any()).optional(),
  })),
  quickActions: z.array(z.object({
    id: z.string(),
    icon: z.string(),
    label: z.string(),
    action: z.object({
      type: z.enum(['navigate_app', 'navigate_screen', 'dm', 'api']),
      config: z.record(z.any()),
    }),
  })).optional(),
});

const createAppSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['feed', 'module', 'home']),
  icon: z.string().optional(),
  description: z.string().optional(),
  config: z.union([feedConfigSchema, moduleConfigSchema, homeConfigSchema]),
  order: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

const updateAppSchema = createAppSchema.partial();

// Helper to invalidate app cache
async function invalidateAppCache(appId?: string) {
  if (appId) {
    await redis.del(`app:${appId}`);
  }
  await redis.del('apps:active');
  await redis.del('apps:config');
}

// ==================== ADMIN ROUTES ====================

// GET /apps - List all apps (admin)
router.get('/', adminAuth, async (req: Request, res: Response) => {
  const { type, enabled } = req.query;

  const where: any = {};
  if (type) where.type = type;
  if (enabled !== undefined) where.enabled = enabled === 'true';

  const apps = await prisma.app.findMany({
    where,
    orderBy: { order: 'asc' },
  });

  return res.json(apps);
});

// POST /apps - Create new app (admin)
router.post('/', adminAuth, async (req: Request, res: Response) => {
  try {
    const data = createAppSchema.parse(req.body);

    // Validate config based on type
    if (data.type === 'feed') {
      feedConfigSchema.parse(data.config);
    } else if (data.type === 'module') {
      moduleConfigSchema.parse(data.config);
    } else if (data.type === 'home') {
      homeConfigSchema.parse(data.config);
    }

    const app = await prisma.app.create({
      data: {
        name: data.name,
        type: data.type,
        icon: data.icon,
        description: data.description,
        config: data.config as any,
        order: data.order ?? 0,
        enabled: data.enabled ?? false,
      },
    });

    await invalidateAppCache();

    return res.status(201).json(app);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// GET /apps/:id - Get single app (admin)
router.get('/:id', adminAuth, async (req: Request, res: Response) => {
  const app = await prisma.app.findUnique({
    where: { id: req.params.id },
  });

  if (!app) {
    throw new AppError(404, 'App not found');
  }

  return res.json(app);
});

// PUT /apps/:id - Update app (admin)
router.put('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const data = updateAppSchema.parse(req.body);

    const existing = await prisma.app.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(404, 'App not found');
    }

    // Validate config if provided
    const type = data.type ?? existing.type;
    if (data.config) {
      if (type === 'feed') {
        feedConfigSchema.parse(data.config);
      } else if (type === 'module') {
        moduleConfigSchema.parse(data.config);
      } else if (type === 'home') {
        homeConfigSchema.parse(data.config);
      }
    }

    const app = await prisma.app.update({
      where: { id: req.params.id },
      data: {
        ...data,
        config: data.config as any,
        updatedAt: new Date(),
      },
    });

    await invalidateAppCache(app.id);

    return res.json(app);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// DELETE /apps/:id - Delete app (admin)
router.delete('/:id', adminAuth, async (req: Request, res: Response) => {
  const existing = await prisma.app.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new AppError(404, 'App not found');
  }

  await prisma.app.delete({
    where: { id: req.params.id },
  });

  await invalidateAppCache(req.params.id);

  return res.status(204).send();
});

// POST /apps/reorder - Reorder apps (admin)
router.post('/reorder', adminAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    orders: z.array(z.object({
      id: z.string(),
      order: z.number().int().min(0),
    })),
  });

  try {
    const { orders } = schema.parse(req.body);

    await prisma.$transaction(
      orders.map(({ id, order }) =>
        prisma.app.update({
          where: { id },
          data: { order },
        })
      )
    );

    await invalidateAppCache();

    return res.json({ message: 'Apps reordered successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// ==================== MOBILE CLIENT ROUTES ====================

// GET /apps/config - Get all active apps config for mobile client
// This is the primary endpoint called by the mobile app on startup
router.get('/mobile/config', userAuth, async (req: Request, res: Response) => {
  // Check cache first
  const cached = await redis.get('apps:config');
  if (cached) {
    const data = JSON.parse(cached);
    
    // Check If-None-Match for ETag
    const etag = req.headers['if-none-match'];
    if (etag === data.etag) {
      return res.status(304).send();
    }
    
    res.setHeader('ETag', data.etag);
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.json(data.apps);
  }

  // Fetch from database
  const apps = await prisma.app.findMany({
    where: { enabled: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      icon: true,
      description: true,
      config: true,
      order: true,
    },
  });

  // Generate ETag based on data hash
  const etag = `"${Buffer.from(JSON.stringify(apps)).toString('base64').slice(0, 20)}"`;
  
  // Cache the result
  await redis.setex('apps:config', CACHE_TTL, JSON.stringify({ apps, etag }));

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=60');
  return res.json(apps);
});

// GET /apps/mobile/:id - Get single app config by id for mobile
router.get('/mobile/:id', userAuth, async (req: Request, res: Response) => {
  const cacheKey = `app:${req.params.id}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const app = await prisma.app.findFirst({
    where: { 
      id: req.params.id,
      enabled: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
      icon: true,
      description: true,
      config: true,
    },
  });

  if (!app) {
    throw new AppError(404, 'App not found');
  }

  // Cache the result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(app));

  return res.json(app);
});

export default router;
