import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import { prisma } from '../lib/prisma';
import { subscriber } from '../lib/redis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userDid?: string;
  adminId?: string;
}

// Connected users map for quick lookups
const connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socket ids

export function initSocketHandlers(io: SocketServer) {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const did = socket.handshake.auth.did;

      if (token) {
        // Admin authentication via JWT
        const decoded = jwt.verify(token, config.jwtSecret) as { adminId: string };
        socket.adminId = decoded.adminId;
        return next();
      }

      if (did) {
        // User authentication via Bluesky DID
        const user = await prisma.user.findUnique({
          where: { did },
          select: { id: true, did: true },
        });

        if (user) {
          socket.userId = user.id;
          socket.userDid = user.did;
          return next();
        }
      }

      return next(new Error('Authentication required'));
    } catch (error) {
      return next(new Error('Invalid authentication'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.id}, userId: ${socket.userId || 'admin'}`);

    // Track connected users
    if (socket.userId) {
      if (!connectedUsers.has(socket.userId)) {
        connectedUsers.set(socket.userId, new Set());
      }
      connectedUsers.get(socket.userId)!.add(socket.id);

      // Join user's personal room for notifications
      socket.join(`user:${socket.userId}`);
    }

    if (socket.adminId) {
      socket.join('admin');
    }

    // ==================== ORDER TRACKING ====================
    
    // Subscribe to order updates
    socket.on('order:subscribe', async (orderId: string) => {
      if (!socket.userId) return;

      // Verify user is part of this order
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          OR: [
            { buyerId: socket.userId },
            { sellerId: socket.userId },
          ],
        },
      });

      if (order) {
        socket.join(`order:${orderId}`);
        console.log(`User ${socket.userId} subscribed to order ${orderId}`);
      }
    });

    socket.on('order:unsubscribe', (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    // ==================== DRIVER LOCATION (for taxi/delivery) ====================
    
    socket.on('driver:location', async (data: { orderId: string; lat: number; lng: number; eta?: number }) => {
      if (!socket.userId) return;

      // Verify user is the seller/driver for this order
      const order = await prisma.order.findFirst({
        where: {
          id: data.orderId,
          sellerId: socket.userId,
          status: { in: ['accepted', 'in_progress'] },
        },
      });

      if (!order) return;

      // Update order metadata with location
      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          metadata: {
            ...(order.metadata as any),
            currentLocation: {
              lat: data.lat,
              lng: data.lng,
              updatedAt: new Date(),
            },
            eta: data.eta,
          },
        },
      });

      // Broadcast to order room (buyer)
      io.to(`order:${data.orderId}`).emit('driver:location', {
        orderId: data.orderId,
        lat: data.lat,
        lng: data.lng,
        eta: data.eta,
        timestamp: new Date(),
      });
    });

    // ==================== TYPING INDICATORS ====================
    
    socket.on('typing:start', (data: { conversationId: string }) => {
      if (!socket.userId) return;
      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      if (!socket.userId) return;
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
    });

    // ==================== DISCONNECT ====================
    
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);

      // Remove from connected users
      if (socket.userId) {
        const userSockets = connectedUsers.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            connectedUsers.delete(socket.userId);
          }
        }
      }
    });
  });

  // ==================== REDIS PUB/SUB INTEGRATION ====================
  
  // Listen for notifications from Redis pub/sub
  subscriber.subscribe('notifications', (err) => {
    if (err) {
      console.error('Failed to subscribe to notifications channel:', err);
    }
  });

  subscriber.on('message', (channel, message) => {
    if (channel === 'notifications') {
      try {
        const notification = JSON.parse(message);
        
        // Send to user's room
        io.to(`user:${notification.userId}`).emit('notification', notification);
        
        // Also send to admin room for monitoring
        if (['order_created', 'dispute_opened', 'seller_application'].includes(notification.type)) {
          io.to('admin').emit('admin:notification', notification);
        }
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    }
  });

  // Subscribe to order location updates
  subscriber.psubscribe('order:*:location', (err) => {
    if (err) {
      console.error('Failed to subscribe to order locations:', err);
    }
  });

  subscriber.on('pmessage', (pattern, channel, message) => {
    if (pattern === 'order:*:location') {
      try {
        const orderId = channel.split(':')[1];
        const location = JSON.parse(message);
        
        io.to(`order:${orderId}`).emit('driver:location', {
          orderId,
          ...location,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error processing location update:', error);
      }
    }
  });
}

// Helper to send notification to specific user
export function sendToUser(io: SocketServer, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data);
}

// Helper to send to all connected admins
export function sendToAdmins(io: SocketServer, event: string, data: any) {
  io.to('admin').emit(event, data);
}

// Helper to check if user is online
export function isUserOnline(userId: string): boolean {
  return connectedUsers.has(userId) && connectedUsers.get(userId)!.size > 0;
}
