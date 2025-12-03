/**
 * Order Intermediary Service
 * 
 * Manages the complete order lifecycle:
 * - Order creation with escrow
 * - Status transitions
 * - Commission handling
 * - Dispute management
 */

import { OrderStatus, NotificationType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import { walletService } from './WalletService.js'
import { notificationService } from './NotificationService.js'
import { config } from '../config/index.js'

// Valid status transitions
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['paid', 'cancelled'],
  paid: ['accepted', 'cancelled', 'refunded'],
  accepted: ['in_progress', 'cancelled', 'refunded'],
  in_progress: ['shipped', 'delivered', 'disputed'],
  shipped: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  completed: [],
  cancelled: [],
  refunded: [],
  disputed: ['resolved_buyer', 'resolved_seller'],
  resolved_buyer: [],
  resolved_seller: [],
}

export class OrderService {
  /**
   * Create a new order
   */
  async create(
    buyerId: string,
    listingId: string,
    quantity: number = 1,
    metadata?: Record<string, unknown>,
  ) {
    // Get listing
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { user: true },
    })

    if (!listing) {
      throw new AppError(404, 'Listing not found', 'LISTING_NOT_FOUND')
    }

    if (listing.status !== 'live') {
      throw new AppError(400, 'Listing is not available', 'LISTING_NOT_AVAILABLE')
    }

    if (listing.userId === buyerId) {
      throw new AppError(400, 'Cannot buy your own listing', 'CANNOT_BUY_OWN')
    }

    // Calculate amounts
    const unitPrice = Number(listing.price)
    const totalAmount = unitPrice * quantity
    const platformFeePercent = config.platform.feePercent
    const platformFeeAmount = totalAmount * (platformFeePercent / 100)
    const sellerAmount = totalAmount - platformFeeAmount

    // Check buyer balance
    const buyerBalance = await walletService.getBalance(buyerId)
    if (buyerBalance.available < totalAmount) {
      throw new AppError(400, 'Insufficient balance', 'INSUFFICIENT_BALANCE')
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        listingId,
        buyerId,
        sellerId: listing.userId,
        quantity,
        unitPrice,
        totalAmount,
        platformFeePercent,
        platformFeeAmount,
        sellerAmount,
        status: OrderStatus.created,
        metadata: metadata as Prisma.JsonObject,
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })

    return order
  }

  /**
   * Pay for an order (hold funds in escrow)
   */
  async pay(orderId: string, buyerId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND')
    }

    if (order.buyerId !== buyerId) {
      throw new AppError(403, 'Not your order', 'NOT_AUTHORIZED')
    }

    if (order.status !== OrderStatus.created) {
      throw new AppError(400, 'Order cannot be paid', 'INVALID_STATUS')
    }

    // Hold funds
    await walletService.hold(buyerId, orderId, Number(order.totalAmount))

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.paid,
        paidAt: new Date(),
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })

    // Notify seller
    await notificationService.create(
      order.sellerId,
      NotificationType.order_paid,
      'New Order!',
      `You have a new order for ${updatedOrder.listing.title}`,
      { orderId: order.id, orderNumber: order.orderNumber },
    )

    return updatedOrder
  }

  /**
   * Seller accepts an order
   */
  async accept(orderId: string, sellerId: string) {
    const order = await this.validateStatusTransition(orderId, sellerId, 'seller', OrderStatus.accepted)

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.accepted,
        acceptedAt: new Date(),
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })

    // Notify buyer
    await notificationService.create(
      order.buyerId,
      NotificationType.order_accepted,
      'Order Accepted',
      `Your order for ${updatedOrder.listing.title} has been accepted`,
      { orderId: order.id, orderNumber: order.orderNumber },
    )

    return updatedOrder
  }

  /**
   * Seller rejects an order (auto-refund)
   */
  async reject(orderId: string, sellerId: string, reason?: string) {
    const order = await this.validateStatusTransition(orderId, sellerId, 'seller', OrderStatus.refunded)

    // Refund buyer
    if (Number(order.escrowAmount) > 0) {
      await walletService.refund(orderId)
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.refunded,
        cancelledAt: new Date(),
        metadata: {
          ...(order.metadata as object || {}),
          rejectionReason: reason,
        },
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })

    // Notify buyer
    await notificationService.create(
      order.buyerId,
      NotificationType.order_refunded,
      'Order Rejected',
      `Your order for ${updatedOrder.listing.title} was rejected. Funds have been refunded.`,
      { orderId: order.id, orderNumber: order.orderNumber, reason },
    )

    return updatedOrder
  }

  /**
   * Update order to in_progress
   */
  async startProgress(orderId: string, sellerId: string) {
    await this.validateStatusTransition(orderId, sellerId, 'seller', OrderStatus.in_progress)

    return prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.in_progress },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })
  }

  /**
   * Seller marks order as shipped
   */
  async ship(orderId: string, sellerId: string, trackingInfo?: Record<string, unknown>) {
    const order = await this.validateStatusTransition(orderId, sellerId, 'seller', OrderStatus.shipped)

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.shipped,
        shippedAt: new Date(),
        metadata: {
          ...(order.metadata as object || {}),
          tracking: trackingInfo,
        },
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })

    // Notify buyer
    await notificationService.create(
      order.buyerId,
      NotificationType.order_shipped,
      'Order Shipped',
      `Your order for ${updatedOrder.listing.title} has been shipped`,
      { orderId: order.id, orderNumber: order.orderNumber, tracking: trackingInfo },
    )

    return updatedOrder
  }

  /**
   * Seller marks order as delivered
   */
  async markDelivered(orderId: string, sellerId: string) {
    const order = await this.validateStatusTransition(orderId, sellerId, 'seller', OrderStatus.delivered)

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.delivered,
        deliveredAt: new Date(),
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })

    // Notify buyer to confirm receipt
    await notificationService.create(
      order.buyerId,
      NotificationType.order_delivered,
      'Order Delivered',
      `Your order for ${updatedOrder.listing.title} has been marked as delivered. Please confirm receipt.`,
      { orderId: order.id, orderNumber: order.orderNumber },
    )

    return updatedOrder
  }

  /**
   * Buyer confirms receipt and completes order
   */
  async complete(orderId: string, buyerId: string, rating?: number) {
    const order = await this.validateStatusTransition(orderId, buyerId, 'buyer', OrderStatus.completed)

    // Release funds to seller
    await walletService.release(orderId)

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.completed,
        completedAt: new Date(),
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })

    // Update seller rating if provided
    if (rating && rating >= 1 && rating <= 5) {
      const seller = await prisma.user.findUnique({
        where: { id: order.sellerId },
        select: { rating: true, ratingCount: true },
      })

      if (seller) {
        const currentRating = Number(seller.rating) || 0
        const ratingCount = seller.ratingCount || 0
        const newRating = ((currentRating * ratingCount) + rating) / (ratingCount + 1)

        await prisma.user.update({
          where: { id: order.sellerId },
          data: {
            rating: newRating,
            ratingCount: ratingCount + 1,
          },
        })
      }
    }

    // Notify seller
    await notificationService.create(
      order.sellerId,
      NotificationType.order_completed,
      'Order Completed',
      `Order for ${updatedOrder.listing.title} is complete. Payment has been released.`,
      { orderId: order.id, orderNumber: order.orderNumber },
    )

    await notificationService.create(
      order.sellerId,
      NotificationType.payment_received,
      'Payment Received',
      `You received $${Number(order.sellerAmount).toFixed(2)} for order #${order.orderNumber}`,
      { orderId: order.id, amount: Number(order.sellerAmount) },
    )

    return updatedOrder
  }

  /**
   * Cancel an order (buyer or seller)
   */
  async cancel(orderId: string, userId: string, reason?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    })

    if (!order) {
      throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND')
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new AppError(403, 'Not authorized', 'NOT_AUTHORIZED')
    }

    if (!STATUS_TRANSITIONS[order.status].includes(OrderStatus.cancelled)) {
      throw new AppError(400, 'Order cannot be cancelled', 'INVALID_STATUS')
    }

    // Refund if funds were held
    if (Number(order.escrowAmount) > 0) {
      await walletService.refund(orderId)
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.cancelled,
        cancelledAt: new Date(),
        metadata: {
          ...(order.metadata as object || {}),
          cancellationReason: reason,
          cancelledBy: userId,
        },
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
      },
    })

    // Notify the other party
    const otherUserId = userId === order.buyerId ? order.sellerId : order.buyerId
    await notificationService.create(
      otherUserId,
      NotificationType.order_cancelled,
      'Order Cancelled',
      `Order for ${order.listing.title} has been cancelled`,
      { orderId: order.id, orderNumber: order.orderNumber, reason },
    )

    return updatedOrder
  }

  /**
   * Open a dispute
   */
  async openDispute(orderId: string, userId: string, reason: string, description?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    })

    if (!order) {
      throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND')
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new AppError(403, 'Not authorized', 'NOT_AUTHORIZED')
    }

    if (!STATUS_TRANSITIONS[order.status].includes(OrderStatus.disputed)) {
      throw new AppError(400, 'Cannot dispute this order', 'INVALID_STATUS')
    }

    // Create dispute
    await prisma.dispute.create({
      data: {
        orderId,
        openedById: userId,
        reason,
        description,
      },
    })

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.disputed,
        disputedAt: new Date(),
      },
      include: {
        listing: true,
        buyer: { select: { did: true, displayName: true } },
        seller: { select: { did: true, displayName: true } },
        dispute: true,
      },
    })

    // Notify the other party
    const otherUserId = userId === order.buyerId ? order.sellerId : order.buyerId
    await notificationService.create(
      otherUserId,
      NotificationType.dispute_opened,
      'Dispute Opened',
      `A dispute has been opened for order #${order.orderNumber}`,
      { orderId: order.id, orderNumber: order.orderNumber, reason },
    )

    return updatedOrder
  }

  /**
   * Get order by ID
   */
  async getById(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: {
          select: { id: true, title: true, images: true, type: true },
        },
        buyer: { select: { id: true, did: true, displayName: true, avatar: true } },
        seller: { select: { id: true, did: true, displayName: true, avatar: true, rating: true } },
        dispute: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!order) {
      throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND')
    }

    // If userId provided, check authorization
    if (userId && order.buyerId !== userId && order.sellerId !== userId) {
      throw new AppError(403, 'Not authorized', 'NOT_AUTHORIZED')
    }

    return order
  }

  /**
   * Get orders for a user
   */
  async getForUser(
    userId: string,
    role: 'buyer' | 'seller' | 'both',
    options?: {
      status?: OrderStatus[]
      limit?: number
      offset?: number
    },
  ) {
    const where: Prisma.OrderWhereInput = {}

    if (role === 'buyer') {
      where.buyerId = userId
    } else if (role === 'seller') {
      where.sellerId = userId
    } else {
      where.OR = [{ buyerId: userId }, { sellerId: userId }]
    }

    if (options?.status?.length) {
      where.status = { in: options.status }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
        include: {
          listing: {
            select: { id: true, title: true, images: true, type: true },
          },
          buyer: { select: { id: true, did: true, displayName: true, avatar: true } },
          seller: { select: { id: true, did: true, displayName: true, avatar: true } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return { orders, total }
  }

  /**
   * Validate status transition
   */
  private async validateStatusTransition(
    orderId: string,
    userId: string,
    requiredRole: 'buyer' | 'seller',
    targetStatus: OrderStatus,
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    })

    if (!order) {
      throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND')
    }

    const isAuthorized = requiredRole === 'buyer'
      ? order.buyerId === userId
      : order.sellerId === userId

    if (!isAuthorized) {
      throw new AppError(403, 'Not authorized', 'NOT_AUTHORIZED')
    }

    if (!STATUS_TRANSITIONS[order.status].includes(targetStatus)) {
      throw new AppError(
        400,
        `Cannot transition from ${order.status} to ${targetStatus}`,
        'INVALID_STATUS_TRANSITION',
      )
    }

    return order
  }
}

export const orderService = new OrderService()
