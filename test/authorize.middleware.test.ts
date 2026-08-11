import express, { Express } from 'express';
import request from 'supertest';
import { authorize } from '../src/middleware/authorize';
import { ALL_ROLES, Role } from '../src/modules/auth/types';

/**
 * Builds a minimal test app with one route guarded by authorize(...allowedRoles).
 * A stub "identify" middleware reads a role off a test-only header instead of a
 * real JWT, since this test is only exercising the RBAC decision, not auth itself
 * (that's covered by authenticate.ts, tested indirectly via auth.integration.test.ts).
 */
function buildTestApp(allowedRoles: Role[]): Express {
  const app = express();
  app.use((req, _res, next) => {
    const role = req.header('x-test-role') as Role | undefined;
    if (role) {
      req.user = { id: 1, username: 'test-user', role };
    }
    next();
  });
  app.get('/protected', authorize(...allowedRoles), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('authorize middleware (RBAC matrix - Step 1.2 gate)', () => {
  it('allows exactly the specified roles and denies every other role with 403', async () => {
    const allowed: Role[] = ['admin', 'accountant'];
    const app = buildTestApp(allowed);

    for (const role of ALL_ROLES) {
      const res = await request(app).get('/protected').set('x-test-role', role);
      if (allowed.includes(role)) {
        expect(res.status).toBe(200);
      } else {
        expect(res.status).toBe(403);
      }
    }
  });

  it('denies a request with no authenticated role at all', async () => {
    const app = buildTestApp(['admin']);
    const res = await request(app).get('/protected');
    expect(res.status).toBe(403);
  });

  it('covers every role individually as the sole allowed role', async () => {
    for (const role of ALL_ROLES) {
      const app = buildTestApp([role]);
      const allowedRes = await request(app).get('/protected').set('x-test-role', role);
      expect(allowedRes.status).toBe(200);

      const otherRole = ALL_ROLES.find((r) => r !== role)!;
      const deniedRes = await request(app).get('/protected').set('x-test-role', otherRole);
      expect(deniedRes.status).toBe(403);
    }
  });
});
