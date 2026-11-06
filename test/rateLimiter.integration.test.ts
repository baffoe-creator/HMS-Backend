import express from 'express';
import request from 'supertest';
import type { Request } from 'express';
import {
  authLimiter,
  globalLimiter,
  requestValidationMiddleware,
  sensitiveOperationLimiter,
} from '../src/middleware/rateLimiter';
import { redisClient } from '../src/utils/redisClient';

function uniqueTestIp(): string {
  // TEST-NET-1 address range; these requests stay inside Supertest.
  return `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
}

function createAppWithTestIp(ip: string): express.Express {
  const app = express();

  app.use((req, _res, next) => {
    // Express exposes req.ip as read-only; override it only in this test app.
    Object.defineProperty(req, 'ip', {
      value: ip,
      configurable: true,
    });
    next();
  });

  return app;
}

describe('Rate limiting middleware - Step 7.2 gate', () => {
  beforeAll(async () => {
    // The Redis client is lazy, so explicitly connect before exercising it.
    await redisClient.ping();
  }, 30_000);

  it('returns 429 after exceeding the auth limiter threshold', async () => {
    const app = createAppWithTestIp(uniqueTestIp());

    app.use('/auth', authLimiter);
    app.post('/auth/login', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    for (let i = 0; i < 10; i += 1) {
      await request(app)
        .post('/auth/login')
        .send({ username: 'test-user', password: 'not-a-real-password' });
    }

    const response = await request(app)
      .post('/auth/login')
      .send({ username: 'test-user', password: 'not-a-real-password' });

    expect(response.status).toBe(429);
    expect(response.body.error).toBeDefined();
  });

  it('sets a decreasing RateLimit-Remaining header across requests', async () => {
    const app = createAppWithTestIp(uniqueTestIp());

    app.use(globalLimiter);
    app.get('/health', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const first = await request(app).get('/health');
    const second = await request(app).get('/health');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(Number(second.headers['ratelimit-remaining'])).toBeLessThan(
      Number(first.headers['ratelimit-remaining']),
    );
  });

  it('rejects an oversized Content-Length with 413', async () => {
    const app = express();

    app.use(requestValidationMiddleware);
    app.post('/upload', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .post('/upload')
      .set('Host', 'localhost')
      .set('Content-Length', String(11 * 1024 * 1024))
      .send({});

    expect(response.status).toBe(413);
    expect(response.body.error).toBe('Payload too large');
  });

  it(
    'keys the sensitive limiter per authenticated user, not shared IP',
    async () => {
      const app = createAppWithTestIp(uniqueTestIp());

      // Simulate authentication setting req.user before the limiter runs.
      app.use((req: Request, _res, next) => {
        const userId = req.get('x-test-user-id');

        Object.defineProperty(req, 'user', {
          value: userId ? { id: userId } : undefined,
          configurable: true,
        });

        next();
      });

      app.use(sensitiveOperationLimiter);
      app.get('/sensitive', (_req, res) => {
        res.status(200).json({ ok: true });
      });

      const hitAs = (userId: string) =>
        request(app)
          .get('/sensitive')
          .set('x-test-user-id', userId);

      for (let i = 0; i < 100; i += 1) {
        const response = await hitAs('user-a');
        expect(response.status).toBe(200);
      }

      const userAOverLimit = await hitAs('user-a');
      expect(userAOverLimit.status).toBe(429);

      // Same client IP, different authenticated user: this user's bucket is fresh.
      const userB = await hitAs('user-b');
      expect(userB.status).toBe(200);
    },
    60_000,
  );
});