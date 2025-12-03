import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { adminOnly } from '../middleware/auth';

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

    // Update last login
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
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
router.get('/me', adminOnly, async (req: Request, res: Response) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.adminId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }

  return res.json(admin);
});

// POST /auth/admin - Create new admin (super_admin only)
router.post('/admin', adminOnly, async (req: Request, res: Response) => {
  // Check if current admin is super_admin
  const currentAdmin = await prisma.admin.findUnique({
    where: { id: req.adminId },
  });

  if (currentAdmin?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super admins can create new admins' });
  }

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
        role: 'admin',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
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
router.post('/change-password', adminOnly, async (req: Request, res: Response) => {
  const schema = z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
  });

  try {
    const { currentPassword, newPassword } = schema.parse(req.body);

    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId },
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
