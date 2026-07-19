import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) { res.status(400).json({ error: 'Email, password, and name are required' }); return; }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash, name } });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscriptionTier } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'Email and password are required' }); return; }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscriptionTier } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true, createdAt: true } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/upgrade', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tier } = req.body;
    if (!['FREE', 'PREMIUM', 'PRO'].includes(tier)) {
      res.status(400).json({ error: 'Invalid subscription tier' });
      return;
    }
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { subscriptionTier: tier },
      select: { id: true, email: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true, createdAt: true }
    });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
