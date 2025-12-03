/**
 * Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from './errorHandler.js'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; email: string }
      user?: { id: string; did: string }
    }
  }
}

/**
 * Verify Admin JWT token
 */
export function adminAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'No token provided', 'NO_TOKEN')
    }
    
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, config.jwt.secret) as { 
      id: string
      email: string
      type: 'admin'
    }
    
    if (decoded.type !== 'admin') {
      throw new AppError(401, 'Invalid token type', 'INVALID_TOKEN')
    }
    
    req.admin = { id: decoded.id, email: decoded.email }
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'Invalid token', 'INVALID_TOKEN'))
    } else {
      next(error)
    }
  }
}

/**
 * Verify API Key for mobile client
 */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key']
  
  if (apiKey !== config.apiKey) {
    return next(new AppError(401, 'Invalid API key', 'INVALID_API_KEY'))
  }
  
  next()
}

/**
 * Verify User by DID (from mobile client)
 * User DID is passed in x-user-did header after mobile app authenticates with Bluesky
 */
export async function userAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key']
    const userDid = req.headers['x-user-did'] as string | undefined
    
    if (apiKey !== config.apiKey) {
      throw new AppError(401, 'Invalid API key', 'INVALID_API_KEY')
    }
    
    if (!userDid) {
      throw new AppError(401, 'No user DID provided', 'NO_USER_DID')
    }
    
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { did: userDid },
    })
    
    if (!user) {
      // Auto-create user on first request
      user = await prisma.user.create({
        data: { did: userDid },
      })
    }
    
    req.user = { id: user.id, did: user.did }
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Optional user auth - doesn't fail if no user
 */
export async function optionalUserAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key']
    const userDid = req.headers['x-user-did'] as string | undefined
    
    if (apiKey !== config.apiKey) {
      throw new AppError(401, 'Invalid API key', 'INVALID_API_KEY')
    }
    
    if (userDid) {
      const user = await prisma.user.findUnique({
        where: { did: userDid },
      })
      
      if (user) {
        req.user = { id: user.id, did: user.did }
      }
    }
    
    next()
  } catch (error) {
    next(error)
  }
}
