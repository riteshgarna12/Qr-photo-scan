/**
 * In-memory login rate limiter.
 * Tracks failed attempts per IP and locks out after MAX_ATTEMPTS
 * for LOCKOUT_DURATION_MS. No external dependencies.
 */

import { Request, Response, NextFunction } from 'express';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // clean stale entries every 10 min

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    // If lockout has expired and no recent activity, remove
    if (record.lockedUntil && record.lockedUntil < now) {
      attempts.delete(key);
    } else if (!record.lockedUntil && now - record.firstAttemptAt > LOCKOUT_DURATION_MS) {
      attempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/** Get the client IP from the request (supports proxies). */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Express middleware — attach to the login route.
 * Blocks requests once MAX_ATTEMPTS is reached.
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIP(req);
  const now = Date.now();
  const record = attempts.get(ip);

  if (record) {
    // If currently locked out
    if (record.lockedUntil && record.lockedUntil > now) {
      const retryAfterSec = Math.ceil((record.lockedUntil - now) / 1000);
      res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    // Lockout expired — reset
    if (record.lockedUntil && record.lockedUntil <= now) {
      attempts.delete(ip);
    }
  }

  next();
}

/** Call after a FAILED login to record the attempt. */
export function recordFailedLogin(req: Request): { locked: boolean; remaining: number } {
  const ip = getClientIP(req);
  const now = Date.now();
  let record = attempts.get(ip);

  if (!record) {
    record = { count: 0, firstAttemptAt: now, lockedUntil: null };
    attempts.set(ip, record);
  }

  record.count++;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return { locked: true, remaining: 0 };
  }

  return { locked: false, remaining: MAX_ATTEMPTS - record.count };
}

/** Call after a SUCCESSFUL login to clear the counter. */
export function resetLoginAttempts(req: Request): void {
  const ip = getClientIP(req);
  attempts.delete(ip);
}
