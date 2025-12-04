/**
 * Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error('Error:', err)

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      details: err.errors,
    })
  }

  // Custom app errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    })
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as { code: string; meta?: { target?: string[] } }
    
    if (prismaError.code === 'P2002') {
      return res.status(409).json({
        error: 'Resource already exists',
        code: 'DUPLICATE_ERROR',
        field: prismaError.meta?.target?.[0],
      })
    }
    
    if (prismaError.code === 'P2025') {
      return res.status(404).json({
        error: 'Resource not found',
        code: 'NOT_FOUND',
      })
    }
  }

  // Default error
  return res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
  })
}
