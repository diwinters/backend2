/**
 * Redis client for caching and pub/sub
 */

import Redis from 'ioredis'
import { config } from '../config/index.js'

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

// Separate client for pub/sub (Redis requires separate connections)
export const redisSub = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

export async function initRedis() {
  await redis.connect()
  await redisSub.connect()
}

// Cache helpers
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key)
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch {
      return null
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const data = JSON.stringify(value)
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, data)
    } else {
      await redis.set(key, data)
    }
  },

  async del(key: string): Promise<void> {
    await redis.del(key)
  },

  async delPattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },

  // ETag support for config caching
  async getWithEtag<T>(key: string): Promise<{ data: T | null; etag: string | null }> {
    const [data, etag] = await redis.mget(key, `${key}:etag`)
    return {
      data: data ? JSON.parse(data) as T : null,
      etag,
    }
  },

  async setWithEtag(key: string, value: unknown, etag: string, ttlSeconds?: number): Promise<void> {
    const data = JSON.stringify(value)
    const multi = redis.multi()
    
    if (ttlSeconds) {
      multi.setex(key, ttlSeconds, data)
      multi.setex(`${key}:etag`, ttlSeconds, etag)
    } else {
      multi.set(key, data)
      multi.set(`${key}:etag`, etag)
    }
    
    await multi.exec()
  },
}

// Pub/Sub helpers
export const pubsub = {
  async publish(channel: string, message: unknown): Promise<void> {
    await redis.publish(channel, JSON.stringify(message))
  },

  subscribe(channel: string, handler: (message: unknown) => void): void {
    redisSub.subscribe(channel)
    redisSub.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          handler(JSON.parse(msg))
        } catch {
          handler(msg)
        }
      }
    })
  },
}
