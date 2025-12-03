/**
 * Configuration
 */

import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  API_KEY: z.string().min(16),
  PLATFORM_FEE_PERCENT: z.string().default('10'),
  MIN_WALLET_BALANCE: z.string().default('0'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
})

const env = envSchema.parse(process.env)

export const config = {
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  port: parseInt(env.PORT, 10),
  
  database: {
    url: env.DATABASE_URL,
  },
  
  redis: {
    url: env.REDIS_URL,
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  
  apiKey: env.API_KEY,
  
  platform: {
    feePercent: parseFloat(env.PLATFORM_FEE_PERCENT),
    minWalletBalance: parseFloat(env.MIN_WALLET_BALANCE),
  },
  
  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },
  
  corsOrigins: env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']
    : [/* Add production origins */],
}
