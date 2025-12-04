/**
 * Mini-App Backend Server
 * 
 * Express.js server with:
 * - PostgreSQL via Prisma
 * - Redis for caching & pub/sub
 * - Socket.io for real-time
 * - JWT authentication
 */

import 'dotenv/config'

import express from 'express'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import path from 'path'

import { config } from './config/index.js'
import { prisma } from './lib/prisma.js'
import { redis, initRedis } from './lib/redis.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'

// Routes
import authRoutes from './routes/auth.js'
import appsRoutes from './routes/apps.js'
import usersRoutes from './routes/users.js'
import walletRoutes from './routes/wallet.js'
import ordersRoutes from './routes/orders.js'
import listingsRoutes from './routes/listings.js'
import sellersRoutes from './routes/sellers.js'
import notificationsRoutes from './routes/notifications.js'
import configRoutes from './routes/config.js'
import statsRoutes from './routes/stats.js'

// Socket handlers
import { initSocketHandlers } from './socket/index.js'

const app = express()
const httpServer = createServer(app)

// Socket.io setup
const io = new SocketServer(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
})

// Make io available to routes
app.set('io', io)

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Security
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for admin SPA
}))

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}))

// Compression
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging (dev only)
if (config.isDev) {
  app.use(requestLogger)
}

// =============================================================================
// API ROUTES
// =============================================================================

app.use('/api/auth', authRoutes)
app.use('/api/apps', appsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/listings', listingsRoutes)
app.use('/api/sellers', sellersRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/config', configRoutes)
app.use('/api/admin/stats', statsRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// =============================================================================
// ADMIN PORTAL (Static files)
// =============================================================================

import { existsSync } from 'fs'

const adminPath = path.join(process.cwd(), 'admin', 'dist')
const adminExists = existsSync(adminPath)

if (adminExists) {
  app.use('/admin', express.static(adminPath))
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(adminPath, 'index.html'))
  })
} else {
  app.get('/admin*', (_req, res) => {
    res.status(503).send(`
      <html>
        <head><title>Admin Not Built</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>⚠️ Admin Dashboard Not Built</h1>
          <p>The admin dashboard needs to be built first.</p>
          <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: left; display: inline-block;">
cd admin
npm install
npm run build</pre>
          <p style="margin-top: 20px; color: #666;">Then restart the server.</p>
        </body>
      </html>
    `)
  })
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use(errorHandler)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// =============================================================================
// SERVER START
// =============================================================================

async function start() {
  try {
    // Initialize Redis
    await initRedis()
    console.log('✅ Redis connected')

    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected')

    // Initialize Socket handlers
    initSocketHandlers(io)
    console.log('✅ Socket.io initialized')

    // Start HTTP server - bind to 0.0.0.0 to accept external connections
    httpServer.listen(config.port, '0.0.0.0', () => {
      console.log(`
🚀 Mini-App Backend running!
   
   API:    http://0.0.0.0:${config.port}/api
   Admin:  http://0.0.0.0:${config.port}/admin
   Health: http://0.0.0.0:${config.port}/api/health
   
   Environment: ${config.nodeEnv}
      `)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...')
  await prisma.$disconnect()
  redis.disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...')
  await prisma.$disconnect()
  redis.disconnect()
  process.exit(0)
})

start()

export { app, io }
