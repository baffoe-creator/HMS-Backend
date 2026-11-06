import type { NextFunction, Request, Response } from 'express';
import { redisClient } from '../utils/redisClient';

const REDIS_TIMEOUT_MS = Number(
  process.env.RATE_LIMIT_REDIS_TIMEOUT_MS ?? 3000,
);

const INCR_WITH_EXPIRE_LUA = `
local current = redis.call("INCR", KEYS[1])
if tonumber(current) == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`;

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Redis command exceeded ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    keyGenerator = (req) => req.ip || 'unknown',
    message = 'Too many requests, please try again later',
  } = options;

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const redisKey = `ratelimit:${keyPrefix}:${keyGenerator(req)}`;

    let count: number;

    try {
      const result = await withTimeout(
        redisClient.eval(
          INCR_WITH_EXPIRE_LUA,
          1,
          redisKey,
          String(windowMs),
        ),
        REDIS_TIMEOUT_MS,
      );

      count = Number(result);
    } catch (error) {
      console.error(
        `Rate limiter Redis error on "${redisKey}", failing open:`,
        error instanceof Error ? error.message : String(error),
      );
      next();
      return;
    }

    res.set('RateLimit-Limit', String(maxRequests));
    res.set('RateLimit-Remaining', String(Math.max(0, maxRequests - count)));
    res.set(
      'RateLimit-Reset',
      String(Math.ceil((Date.now() + windowMs) / 1000)),
    );

    if (count > maxRequests) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

export const globalLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 1000,
  keyPrefix: 'global',
});

export const authLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  keyPrefix: 'auth',
  message: 'Too many login attempts, please try again later',
});

export const sensitiveOperationLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 100,
  keyPrefix: 'sensitive',
  keyGenerator: (req) => {
    const userId = req.user?.id;

    return userId
      ? `user:${userId}`
      : `ip:${req.ip || 'unknown'}`;
  },
  message: 'Too many requests, please slow down',
});

export function requestValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.get('Host')) {
    res.status(400).json({ error: 'Invalid request: missing Host header' });
    return;
  }

  const contentLength = Number(req.get('Content-Length') ?? 0);

  if (contentLength > 10 * 1024 * 1024) {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }

  if (req.url.length > 4096) {
    res.status(414).json({ error: 'URI too long' });
    return;
  }

  next();
}