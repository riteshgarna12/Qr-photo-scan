import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'fallback-secret') {
    throw new Error('JWT_SECRET environment variable is not configured properly.');
  }
  return secret;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Basic format check — JWT tokens are 3 base64 segments separated by dots
  if (!token || token.split('.').length !== 3) {
    res.status(401).json({ error: 'Malformed authentication token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
