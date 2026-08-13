import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

/**
 * Step 1.1 integration test gate. Requires a live MySQL instance with
 * migrations applied - run `docker compose up -d && npm run migrate:up` first.
 */
const app = createApp();

describe('POST /auth/login (integration, requires DB)', () => {
  let testUserId: number;

  beforeAll(async () => {
    await db('users').where({ username: 'phase1_login_test' }).del();

    const hash = await authService.hashPassword('TestPass123!');
    const [id] = await db('users').insert({
      username: 'phase1_login_test',
      password_hash: hash,
      role: 'receptionist',
      is_active: true,
    });
    testUserId = id;
  });

  afterAll(async () => {
    await db('users').where({ id: testUserId }).del();
    await db.destroy();
  });

  it('returns 200 with tokens for valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'phase1_login_test', password: 'TestPass123!' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('returns 401 for an invalid password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'phase1_login_test', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects a request to a protected route with an expired/invalid token (401)', async () => {
    const res = await request(app)
      .patch(`/users/${testUserId}/status`)
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ isActive: false });

    expect(res.status).toBe(401);
  });
});
