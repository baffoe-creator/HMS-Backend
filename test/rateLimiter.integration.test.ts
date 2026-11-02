import express from 'express';
import request from 'supertest';
import { authLimiter, globalLimiter, requestValidationMiddleware } from '../src/middleware/rateLimiter';

describe('Rate limiting middleware', () => {
  it('returns 429 after exceeding the auth limiter threshold', async () => {
    const app = express();

    app.use((req, res, next) => {
      Object.defineProperty(req, 'ip', {
        value: '127.0.0.1',
        configurable: true,
      });
      next();
    });

    app.use('/auth', authLimiter);

    app.post('/auth/login', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    for (let i = 0; i < 10; i++) {
      await request(app).post('/auth/login').send({ username: 'x', password: 'y' });
    }

    const res = await request(app).post('/auth/login').send({ username: 'x', password: 'y' });

    expect(res.status).toBe(429);
  });

  it('sets a decreasing RateLimit-Remaining header across requests', async () => {
    const app = express();

    app.use((req, res, next) => {
      Object.defineProperty(req, 'ip', {
        value: '127.0.0.1',
        configurable: true,
      });
      next();
    });

    app.use(globalLimiter);

    app.get('/health', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const first = await request(app).get('/health');
    const second = await request(app).get('/health');

    expect(Number(second.headers['ratelimit-remaining'])).toBeLessThan(
      Number(first.headers['ratelimit-remaining'])
    );
  });

  it('rejects an oversized Content-Length with 413', async () => {
    const app = express();

    app.use((req, res, next) => {
      Object.defineProperty(req, 'ip', {
        value: '127.0.0.1',
        configurable: true,
      });
      next();
    });

    app.use(requestValidationMiddleware);

    app.post('/upload', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app)
      .post('/upload')
      .set('Host', 'localhost')
      .set('Content-Length', String(11 * 1024 * 1024))
      .send({ large: 'payload' });

    expect(res.status).toBe(413);
  });
});