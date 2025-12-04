import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

// POST /auth/login - Admin login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT (Admin model doesn't have role or lastLoginAt)
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email },
      config.jwt.secret,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// GET /auth/me - Get current admin
router.get('/me', adminAuth, async (req: Request, res: Response) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin?.id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }

  return res.json(admin);
});

// POST /auth/admin - Create new admin
router.post('/admin', adminAuth, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = createAdminSchema.parse(req.body);

    // Check if email already exists
    const existing = await prisma.admin.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return res.status(201).json(admin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

// POST /auth/change-password - Change password
router.post('/change-password', adminAuth, async (req: Request, res: Response) => {
  const schema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
  });

  try {
    const { currentPassword, newPassword } = schema.parse(req.body);

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin?.id },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, admin.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    throw error;
  }
});

export default router;
