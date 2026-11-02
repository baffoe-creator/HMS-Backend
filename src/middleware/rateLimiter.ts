import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../utils/redisClient';

type Bucket = {
  count: number;
  resetAt: number;
};

const localStore: Record<string, Bucket> = {};

function inMemoryLimiter(
  windowMs: number,
  maxRequests: number,
  keyGenerator: (req: Request) => string,
  message: string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!localStore[key]) {
      localStore[key] = { count: 0, resetAt: now + windowMs };
    }

    const bucket = localStore[key];
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count++;

    res.set('RateLimit-Limit', String(maxRequests));
    res.set('RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
    res.set('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.status(429).json({
        status: 'error',
        message,
        retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
  message: string;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator(req);

    try {
      if (!redisClient || redisClient.status !== 'ready') {
        return inMemoryLimiter(
          options.windowMs,
          options.maxRequests,
          options.keyGenerator,
          options.message
        )(req, res, next);
      }

      const redisKey = `ratelimit:${key}`;
      const count = await redisClient.incr(redisKey);
      if (count === 1) {
        await redisClient.pexpire(redisKey, options.windowMs);
      }

      const remaining = Math.max(0, options.maxRequests - count);
      res.set('RateLimit-Limit', String(options.maxRequests));
      res.set('RateLimit-Remaining', String(remaining));
      res.set('RateLimit-Reset', String(Math.ceil((Date.now() + options.windowMs) / 1000)));

      if (count > options.maxRequests) {
        res.status(429).json({
          status: 'error',
          message: options.message,
          retryAfter: Math.ceil(options.windowMs / 1000),
        });
        return;
      }

      next();
    } catch (err) {
      return inMemoryLimiter(
        options.windowMs,
        options.maxRequests,
        options.keyGenerator,
        options.message
      )(req, res, next);
    }
  };
}

export const globalLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 1000,
  keyGenerator: (req) => req.ip || 'unknown',
  message: 'Too many requests from this IP address',
});

export const authLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  keyGenerator: (req) => req.ip || 'unknown',
  message: 'Too many login attempts, please try again later',
});

export const sensitiveOperationLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 100,
  keyGenerator: (req) => {
    type AuthRequest = Request & { user?: { id?: string | number } };
    const userId = (req as AuthRequest).user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip || 'unknown'}`;
  },
  message: 'Too many requests, please slow down',
});

export function requestValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.get('Host')) {
    res.status(400).json({ status: 'error', message: 'Invalid request: missing Host header' });
    return;
  }

  const contentLength = Number(req.get('Content-Length') || 0);
  if (contentLength > 10 * 1024 * 1024) {
    res.status(413).json({ status: 'error', message: 'Payload too large' });
    return;
  }

  if (req.url.length > 4096) {
    res.status(414).json({ status: 'error', message: 'URI too long' });
    return;
  }

  next();
}