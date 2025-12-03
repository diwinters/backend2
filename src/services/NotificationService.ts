/**
 * Notification Service
 * 
 * Handles creating and managing notifications
 * Integrates with WebSocket for real-time delivery
 */

import { NotificationType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { pubsub } from '../lib/redis.js'

export class NotificationService {
  /**
   * Create a notification
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message?: string,
    data?: Record<string, unknown>,
  ) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data as Prisma.JsonObject,
      },
    })

    // Publish to Redis for real-time delivery
    await pubsub.publish(`notifications:${userId}`, {
      type: 'notification',
      payload: notification,
    })

    return notification
  }

  /**
   * Get notifications for a user
   */
  async getForUser(
    userId: string,
    options?: {
      unreadOnly?: boolean
      types?: NotificationType[]
      limit?: number
      offset?: number
    },
  ) {
    const where: Prisma.NotificationWhereInput = { userId }

    if (options?.unreadOnly) {
      where.read = false
    }

    if (options?.types?.length) {
      where.type = { in: options.types }
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ])

    return { notifications, total, unreadCount }
  }

  /**
   * Mark notification as read
   */
  async markRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    })
  }

  /**
   * Mark all notifications as read
   */
  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, read: false },
    })
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async cleanup(daysOld: number = 30) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOld)

    return prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        read: true,
      },
    })
  }
}

export const notificationService = new NotificationService()
