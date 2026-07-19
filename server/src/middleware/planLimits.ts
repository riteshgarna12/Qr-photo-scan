import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';

const prisma = new PrismaClient();

const PLAN_LIMITS: Record<string, { maxEvents: number; maxPhotos: number }> = {
  FREE: { maxEvents: 1, maxPhotos: 50 },
  PREMIUM: { maxEvents: 1, maxPhotos: 1000 },
  PRO: { maxEvents: 999999, maxPhotos: 999999 },
};

export function checkEventLimit(req: AuthRequest, res: Response, next: NextFunction): void {
  (async () => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { events: true } });
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }
      const limits = PLAN_LIMITS[user.subscriptionTier] || PLAN_LIMITS.FREE;
      if (user.events.length >= limits.maxEvents) {
        res.status(403).json({ error: `Your ${user.subscriptionTier} plan allows only ${limits.maxEvents} event(s). Please upgrade.`, currentPlan: user.subscriptionTier });
        return;
      }
      next();
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  })();
}

export { PLAN_LIMITS };
