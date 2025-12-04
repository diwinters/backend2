import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { adminOnly } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'

const router = Router()

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const polygonSchema = z.array(z.tuple([z.number(), z.number()])).min(3) // At least 3 points for a polygon

const createCitySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  country: z.string().optional(),
  region: z.string().optional(),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  polygon: polygonSchema,
  timezone: z.string().optional(),
  currency: z.string().default('USD'),
  isActive: z.boolean().default(true),
  order: z.number().int().default(0),
})

const updateCitySchema = createCitySchema.partial()

// =============================================================================
// HELPER: Point-in-polygon check (Ray casting algorithm)
// =============================================================================

function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    
    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// =============================================================================
// PUBLIC ROUTES (for client app)
// =============================================================================

/**
 * GET /cities
 * List all active cities (public, for client city selection)
 */
router.get('/', async (req: Request, res: Response) => {
  const { includeInactive } = req.query
  
  const where = includeInactive === 'true' ? {} : { isActive: true }
  
  const cities = await prisma.city.findMany({
    where,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      country: true,
      region: true,
      centerLat: true,
      centerLng: true,
      polygon: true,
      timezone: true,
      currency: true,
      isActive: true,
      order: true,
      _count: {
        select: {
          sellers: { where: { isSeller: true } },
          listings: { where: { status: 'live' } },
        },
      },
    },
  })

  return res.json(cities)
})

/**
 * GET /cities/nearby
 * Find city containing a given lat/lng point
 */
router.get('/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string)
  const lng = parseFloat(req.query.lng as string)

  if (isNaN(lat) || isNaN(lng)) {
    throw new AppError(400, 'Invalid lat/lng parameters')
  }

  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      polygon: true,
      centerLat: true,
      centerLng: true,
    },
  })

  // Check which city contains this point
  for (const city of cities) {
    const polygon = city.polygon as [number, number][]
    if (isPointInPolygon(lat, lng, polygon)) {
      return res.json({
        found: true,
        city: {
          id: city.id,
          name: city.name,
          slug: city.slug,
        },
      })
    }
  }

  // No city found - find nearest by center distance
  let nearestCity = null
  let nearestDistance = Infinity

  for (const city of cities) {
    const cityLat = Number(city.centerLat)
    const cityLng = Number(city.centerLng)
    const distance = Math.sqrt(Math.pow(lat - cityLat, 2) + Math.pow(lng - cityLng, 2))
    
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestCity = city
    }
  }

  return res.json({
    found: false,
    nearest: nearestCity ? {
      id: nearestCity.id,
      name: nearestCity.name,
      slug: nearestCity.slug,
      distance: nearestDistance,
    } : null,
  })
})

/**
 * GET /cities/:idOrSlug
 * Get a single city by ID or slug
 */
router.get('/:idOrSlug', async (req: Request, res: Response) => {
  const { idOrSlug } = req.params

  const city = await prisma.city.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug },
      ],
    },
    include: {
      _count: {
        select: {
          sellers: { where: { isSeller: true } },
          listings: { where: { status: 'live' } },
        },
      },
      admins: {
        select: {
          id: true,
          did: true,
          role: true,
          createdAt: true,
        },
      },
    },
  })

  if (!city) {
    throw new AppError(404, 'City not found')
  }

  return res.json(city)
})

// =============================================================================
// ADMIN ROUTES
// =============================================================================

/**
 * POST /cities
 * Create a new city (admin only)
 */
router.post('/', adminOnly, async (req: Request, res: Response) => {
  const data = createCitySchema.parse(req.body)

  // Check slug uniqueness
  const existing = await prisma.city.findUnique({ where: { slug: data.slug } })
  if (existing) {
    throw new AppError(400, 'City with this slug already exists')
  }

  const city = await prisma.city.create({
    data: {
      name: data.name,
      slug: data.slug,
      country: data.country,
      region: data.region,
      centerLat: data.centerLat,
      centerLng: data.centerLng,
      polygon: data.polygon,
      timezone: data.timezone,
      currency: data.currency,
      isActive: data.isActive,
      order: data.order,
    },
  })

  return res.status(201).json(city)
})

/**
 * PUT /cities/:id
 * Update a city (admin only)
 */
router.put('/:id', adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = updateCitySchema.parse(req.body)

  // Check if city exists
  const existing = await prisma.city.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError(404, 'City not found')
  }

  // Check slug uniqueness if changing
  if (data.slug && data.slug !== existing.slug) {
    const slugExists = await prisma.city.findUnique({ where: { slug: data.slug } })
    if (slugExists) {
      throw new AppError(400, 'City with this slug already exists')
    }
  }

  const city = await prisma.city.update({
    where: { id },
    data,
  })

  return res.json(city)
})

/**
 * DELETE /cities/:id
 * Delete a city (admin only)
 */
router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params

  const city = await prisma.city.findUnique({
    where: { id },
    include: {
      _count: {
        select: { sellers: true, listings: true },
      },
    },
  })

  if (!city) {
    throw new AppError(404, 'City not found')
  }

  // Prevent deletion if city has sellers or listings
  if (city._count.sellers > 0 || city._count.listings > 0) {
    throw new AppError(400, 'Cannot delete city with existing sellers or listings. Deactivate it instead.')
  }

  await prisma.city.delete({ where: { id } })

  return res.json({ success: true, message: 'City deleted' })
})

// =============================================================================
// CITY ADMIN MANAGEMENT
// =============================================================================

/**
 * GET /cities/:id/admins
 * List admins for a city
 */
router.get('/:id/admins', adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params

  const admins = await prisma.cityAdmin.findMany({
    where: { cityId: id },
    orderBy: { createdAt: 'asc' },
  })

  return res.json(admins)
})

/**
 * POST /cities/:id/admins
 * Add a DID-based admin to a city
 */
router.post('/:id/admins', adminOnly, async (req: Request, res: Response) => {
  const { id } = req.params
  const { did, role = 'admin' } = req.body

  if (!did) {
    throw new AppError(400, 'DID is required')
  }

  // Verify city exists
  const city = await prisma.city.findUnique({ where: { id } })
  if (!city) {
    throw new AppError(404, 'City not found')
  }

  // Check if already an admin
  const existing = await prisma.cityAdmin.findUnique({
    where: { did_cityId: { did, cityId: id } },
  })
  if (existing) {
    throw new AppError(400, 'This DID is already an admin for this city')
  }

  const cityAdmin = await prisma.cityAdmin.create({
    data: {
      did,
      cityId: id,
      role,
      addedById: (req as any).admin?.id,
    },
  })

  return res.status(201).json(cityAdmin)
})

/**
 * DELETE /cities/:id/admins/:adminId
 * Remove a city admin
 */
router.delete('/:id/admins/:adminId', adminOnly, async (req: Request, res: Response) => {
  const { adminId } = req.params

  const cityAdmin = await prisma.cityAdmin.findUnique({ where: { id: adminId } })
  if (!cityAdmin) {
    throw new AppError(404, 'City admin not found')
  }

  await prisma.cityAdmin.delete({ where: { id: adminId } })

  return res.json({ success: true, message: 'City admin removed' })
})

// =============================================================================
// GLOBAL ADMIN MANAGEMENT
// =============================================================================

/**
 * GET /cities/admins/global
 * List all global admins (cityId = null)
 */
router.get('/admins/global', adminOnly, async (_req: Request, res: Response) => {
  const admins = await prisma.cityAdmin.findMany({
    where: { cityId: null },
    orderBy: { createdAt: 'asc' },
  })

  return res.json(admins)
})

/**
 * POST /cities/admins/global
 * Add a global admin
 */
router.post('/admins/global', adminOnly, async (req: Request, res: Response) => {
  const { did, role = 'admin' } = req.body

  if (!did) {
    throw new AppError(400, 'DID is required')
  }

  // Check if already a global admin
  const existing = await prisma.cityAdmin.findFirst({
    where: { did, cityId: null },
  })
  if (existing) {
    throw new AppError(400, 'This DID is already a global admin')
  }

  const cityAdmin = await prisma.cityAdmin.create({
    data: {
      did,
      cityId: null,
      role,
      addedById: (req as any).admin?.id,
    },
  })

  return res.status(201).json(cityAdmin)
})

export default router
