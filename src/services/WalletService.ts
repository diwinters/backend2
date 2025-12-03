/**
 * Wallet & Ledger Service
 * 
 * Handles all wallet operations with double-entry bookkeeping:
 * - Deposits (add funds)
 * - Withdrawals (remove funds)
 * - Holds (escrow for orders)
 * - Releases (pay seller)
 * - Refunds (return to buyer)
 * - Commissions (platform fee)
 */

import { Prisma, TransactionType, TransactionStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../middleware/errorHandler.js'

export class WalletService {
  /**
   * Get user's available balance (total - held)
   */
  async getBalance(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true, heldBalance: true },
    })
    
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }
    
    const total = Number(user.walletBalance)
    const held = Number(user.heldBalance)
    
    return {
      total,
      held,
      available: total - held,
    }
  }

  /**
   * Deposit funds to wallet
   */
  async deposit(
    userId: string,
    amount: number,
    reference?: string,
    description?: string,
  ) {
    if (amount <= 0) {
      throw new AppError(400, 'Amount must be positive', 'INVALID_AMOUNT')
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      })
      
      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
      }
      
      const balanceBefore = Number(user.walletBalance)
      const balanceAfter = balanceBefore + amount

      // Update balance
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: balanceAfter },
      })

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.deposit,
          amount,
          balanceBefore,
          balanceAfter,
          status: TransactionStatus.completed,
          reference,
          description: description || 'Wallet deposit',
        },
      })

      return { transaction, newBalance: balanceAfter }
    })
  }

  /**
   * Request withdrawal (requires admin approval in real system)
   */
  async withdraw(
    userId: string,
    amount: number,
    reference?: string,
  ) {
    if (amount <= 0) {
      throw new AppError(400, 'Amount must be positive', 'INVALID_AMOUNT')
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true, heldBalance: true },
      })
      
      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
      }
      
      const available = Number(user.walletBalance) - Number(user.heldBalance)
      
      if (amount > available) {
        throw new AppError(400, 'Insufficient available balance', 'INSUFFICIENT_BALANCE')
      }
      
      const balanceBefore = Number(user.walletBalance)
      const balanceAfter = balanceBefore - amount

      // Update balance
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: balanceAfter },
      })

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.withdrawal,
          amount: -amount, // Negative for withdrawals
          balanceBefore,
          balanceAfter,
          status: TransactionStatus.completed,
          reference,
          description: 'Wallet withdrawal',
        },
      })

      return { transaction, newBalance: balanceAfter }
    })
  }

  /**
   * Hold funds for an order (escrow)
   */
  async hold(
    userId: string,
    orderId: string,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new AppError(400, 'Amount must be positive', 'INVALID_AMOUNT')
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true, heldBalance: true },
      })
      
      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
      }
      
      const available = Number(user.walletBalance) - Number(user.heldBalance)
      
      if (amount > available) {
        throw new AppError(400, 'Insufficient available balance', 'INSUFFICIENT_BALANCE')
      }
      
      const balanceBefore = Number(user.walletBalance)
      const newHeldBalance = Number(user.heldBalance) + amount

      // Update held balance (total balance unchanged)
      await tx.user.update({
        where: { id: userId },
        data: { heldBalance: newHeldBalance },
      })

      // Update order escrow amount
      await tx.order.update({
        where: { id: orderId },
        data: { escrowAmount: amount },
      })

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          orderId,
          type: TransactionType.hold,
          amount,
          balanceBefore,
          balanceAfter: balanceBefore, // Balance unchanged, just held
          status: TransactionStatus.completed,
          description: 'Order escrow hold',
        },
      })

      return { transaction, heldBalance: newHeldBalance }
    })
  }

  /**
   * Release funds to seller (minus commission)
   */
  async release(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { buyer: true, seller: true },
      })
      
      if (!order) {
        throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND')
      }
      
      if (Number(order.escrowAmount) === 0) {
        throw new AppError(400, 'No escrow to release', 'NO_ESCROW')
      }

      const escrowAmount = Number(order.escrowAmount)
      const commission = Number(order.platformFeeAmount)
      const sellerAmount = Number(order.sellerAmount)
      
      // 1. Deduct from buyer's balance and held balance
      const buyerBalanceBefore = Number(order.buyer.walletBalance)
      const buyerBalanceAfter = buyerBalanceBefore - escrowAmount
      const buyerHeldAfter = Number(order.buyer.heldBalance) - escrowAmount
      
      await tx.user.update({
        where: { id: order.buyerId },
        data: {
          walletBalance: buyerBalanceAfter,
          heldBalance: buyerHeldAfter,
        },
      })

      // Buyer release transaction
      await tx.transaction.create({
        data: {
          userId: order.buyerId,
          orderId,
          type: TransactionType.release,
          amount: -escrowAmount,
          balanceBefore: buyerBalanceBefore,
          balanceAfter: buyerBalanceAfter,
          status: TransactionStatus.completed,
          description: 'Order payment released',
        },
      })

      // 2. Add seller amount to seller's balance
      const sellerBalanceBefore = Number(order.seller.walletBalance)
      const sellerBalanceAfter = sellerBalanceBefore + sellerAmount
      
      await tx.user.update({
        where: { id: order.sellerId },
        data: { walletBalance: sellerBalanceAfter },
      })

      // Seller receive transaction
      await tx.transaction.create({
        data: {
          userId: order.sellerId,
          orderId,
          type: TransactionType.release,
          amount: sellerAmount,
          balanceBefore: sellerBalanceBefore,
          balanceAfter: sellerBalanceAfter,
          status: TransactionStatus.completed,
          description: 'Order payment received',
        },
      })

      // 3. Record commission (platform revenue)
      await tx.transaction.create({
        data: {
          userId: order.sellerId, // Associated with seller
          orderId,
          type: TransactionType.commission,
          amount: commission,
          balanceBefore: 0,
          balanceAfter: 0,
          status: TransactionStatus.completed,
          description: 'Platform commission',
          metadata: { rate: Number(order.platformFeePercent) },
        },
      })

      // 4. Clear order escrow
      await tx.order.update({
        where: { id: orderId },
        data: { escrowAmount: 0 },
      })

      return {
        released: escrowAmount,
        sellerReceived: sellerAmount,
        commission,
      }
    })
  }

  /**
   * Refund funds to buyer
   */
  async refund(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { buyer: true },
      })
      
      if (!order) {
        throw new AppError(404, 'Order not found', 'ORDER_NOT_FOUND')
      }
      
      if (Number(order.escrowAmount) === 0) {
        throw new AppError(400, 'No escrow to refund', 'NO_ESCROW')
      }

      const escrowAmount = Number(order.escrowAmount)
      
      // Release held balance (funds already in wallet, just held)
      const buyerHeldAfter = Number(order.buyer.heldBalance) - escrowAmount
      
      await tx.user.update({
        where: { id: order.buyerId },
        data: { heldBalance: buyerHeldAfter },
      })

      // Refund transaction
      const transaction = await tx.transaction.create({
        data: {
          userId: order.buyerId,
          orderId,
          type: TransactionType.refund,
          amount: escrowAmount,
          balanceBefore: Number(order.buyer.walletBalance),
          balanceAfter: Number(order.buyer.walletBalance), // Unchanged, just unheld
          status: TransactionStatus.completed,
          description: 'Order refund',
        },
      })

      // Clear order escrow
      await tx.order.update({
        where: { id: orderId },
        data: { escrowAmount: 0 },
      })

      return { transaction, refundedAmount: escrowAmount }
    })
  }

  /**
   * Get transaction history
   */
  async getTransactions(
    userId: string,
    options?: {
      type?: TransactionType
      limit?: number
      offset?: number
    },
  ) {
    const where: Prisma.TransactionWhereInput = { userId }
    
    if (options?.type) {
      where.type = options.type
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          order: {
            select: {
              orderNumber: true,
              listing: { select: { title: true } },
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ])

    return { transactions, total }
  }
}

export const walletService = new WalletService()
