import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { loginRateLimiter, recordFailedLogin, resetLoginAttempts } from '../middleware/rateLimiter';
import { sanitizeString, sanitizeEmail, isValidEmail, isStrongPassword } from '../utils/validators';

const router = Router();
const prisma = new PrismaClient();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'fallback-secret') {
    throw new Error('JWT_SECRET environment variable is not configured properly.');
  }
  return secret;
}

// ─── Register ────────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = req.body.password as string || '';
    const name = sanitizeString(req.body.name, 100);

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address' });
      return;
    }

    // Validate password strength
    const passwordCheck = isStrongPassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({ error: passwordCheck.reason });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Don't reveal that the email exists — generic message
      res.status(400).json({ error: 'Registration failed. Please try again or sign in.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash, name } });
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscriptionTier } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Login (rate-limited) ────────────────────────────────────────────

router.post('/login', loginRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = req.body.password as string || '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const result = recordFailedLogin(req);
      res.status(401).json({
        error: 'Invalid credentials',
        ...(result.remaining > 0 && { attemptsRemaining: result.remaining }),
      });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      const result = recordFailedLogin(req);
      if (result.locked) {
        res.status(429).json({ error: 'Too many failed attempts. Account locked for 15 minutes.', retryAfterSeconds: 900 });
      } else {
        res.status(401).json({ error: 'Invalid credentials', attemptsRemaining: result.remaining });
      }
      return;
    }

    // Success — reset rate limiter
    resetLoginAttempts(req);

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscriptionTier } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Get Current User ────────────────────────────────────────────────

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true, createdAt: true } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Upgrade Subscription ────────────────────────────────────────────

router.post('/upgrade', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tier = sanitizeString(req.body.tier, 20).toUpperCase();
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

// ─── Forgot Password ────────────────────────────────────────────────

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const email = sanitizeEmail(req.body.email);
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address' });
      return;
    }

    // Always return success to avoid leaking whether email exists
    const successMsg = 'If an account with that email exists, a reset token has been generated. Check your server console.';

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal the email doesn't exist
      res.json({ message: successMsg });
      return;
    }

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Store a hash of the token (so DB compromise doesn't leak tokens)
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashedToken, resetTokenExp: expiry },
    });

    // ── Log to console (replace with email delivery later) ──
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  PASSWORD RESET TOKEN');
    console.log(`  Email : ${email}`);
    console.log(`  Token : ${rawToken}`);
    console.log(`  Expires: ${expiry.toISOString()}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    res.json({ message: successMsg });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Reset Password ─────────────────────────────────────────────────

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = (req.body.token as string || '').trim();
    const newPassword = req.body.password as string || '';

    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    // Validate new password strength
    const passwordCheck = isStrongPassword(newPassword);
    if (!passwordCheck.valid) {
      res.status(400).json({ error: passwordCheck.reason });
      return;
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExp: { gte: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    // Update password and clear the token
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExp: null },
    });

    res.json({ message: 'Password has been reset successfully. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
