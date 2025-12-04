import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { userAuth } from '../middleware/auth.js';
import { notificationService } from '../services/NotificationService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// GET /notifications - Get user's notifications
router.get('/', userAuth, async (req: Request, res: Response) => {
  const { page = '1', limit = '20', unreadOnly = 'false' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const result = await notificationService.getForUser(
    req.user!.id,
    {
      unreadOnly: unreadOnly === 'true',
      limit: take,
      offset: skip,
    }
  );

  return res.json(result);
});

// GET /notifications/unread-count - Get unread count
router.get('/unread-count', userAuth, async (req: Request, res: Response) => {
  const count = await prisma.notification.count({
    where: {
      userId: req.user!.id,
      read: false,
    },
  });

  return res.json({ count });
});

// POST /notifications/:id/read - Mark single notification as read
router.post('/:id/read', userAuth, async (req: Request, res: Response) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
  });

  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }

  await notificationService.markRead(req.params.id, req.user!.id);

  return res.json({ message: 'Notification marked as read' });
});

// POST /notifications/read-all - Mark all notifications as read
router.post('/read-all', userAuth, async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.user!.id,
      read: false,
    },
    data: { read: true },
  });

  return res.json({ message: 'All notifications marked as read' });
});

// DELETE /notifications/:id - Delete notification
router.delete('/:id', userAuth, async (req: Request, res: Response) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: req.params.id,
      userId: req.user!.id,
    },
  });

  if (!notification) {
    throw new AppError(404, 'Notification not found');
  }

  await prisma.notification.delete({
    where: { id: req.params.id },
  });

  return res.status(204).send();
});

// POST /notifications/register-push - Register push notification token
router.post('/register-push', userAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    token: z.string(),
    platform: z.enum(['ios', 'android', 'web']),
    deviceId: z.string().optional(),
  });

  try {
    const { token, platform, deviceId } = schema.parse(req.body);

    // Store push token - logging for now since User model doesn't have metadata field
    console.log(`Push token registered for user ${req.user!.id}: ${platform}`);

    return res.json({ message: 'Push token registered' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

export default router;
