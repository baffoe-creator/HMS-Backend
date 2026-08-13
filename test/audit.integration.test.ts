import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

/**
 * Step 1.4 integration test gate: a tracked mutation (admin deactivating a
 * user) must produce a matching audit_logs row with the correct actor,
 * action, and before/after diff. Requires a live MySQL instance.
 */
const app = createApp();

describe('Audit logging on user status change (integration, requires DB)', () => {
  let adminId: number;
  let targetId: number;
  let adminAccessToken: string;

  beforeAll(async () => {
    await db('users').whereIn('username', ['phase1_audit_admin', 'phase1_audit_target']).del();

    const hash = await authService.hashPassword('AdminPass123!');

    const [aid] = await db('users').insert({
      username: 'phase1_audit_admin',
      password_hash: hash,
      role: 'admin',
      mfa_confirmed: false,
      is_active: true,
    });
    adminId = aid;

    const [tid] = await db('users').insert({
      username: 'phase1_audit_target',
      password_hash: hash,
      role: 'lab_tech',
      is_active: true,
    });
    targetId = tid;

    // Admin role requires MFA per Step 1.3, but audit logging is independent
    // of that flow, so issue a token pair directly here to isolate this test.
    adminAccessToken = authService.issueTokenPair({
      id: adminId,
      username: 'phase1_audit_admin',
      role: 'admin',
    }).accessToken;
  });

  afterAll(async () => {
    await db('audit_logs').where({ table_name: 'users', record_id: String(targetId) }).del();
    await db('users').whereIn('id', [adminId, targetId]).del();
    await db.destroy();
  });

  it('records an audit_logs row with correct actor, action, and diff', async () => {
    const res = await request(app)
      .patch(`/users/${targetId}/status`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);

    const logs = await db('audit_logs').where({
      table_name: 'users',
      record_id: String(targetId),
    });

    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('UPDATE');
    expect(logs[0].user_id).toBe(adminId);

    const before = logs[0].before_state;
    const after = logs[0].after_state;
    expect(before.is_active).toBe(true);
    expect(after.is_active).toBe(false);
  });

  it('blocks a non-admin role from performing the same mutation (403)', async () => {
    const nonAdminToken = authService.issueTokenPair({
      id: targetId,
      username: 'phase1_audit_target',
      role: 'lab_tech',
    }).accessToken;

    const res = await request(app)
      .patch(`/users/${adminId}/status`)
      .set('Authorization', `Bearer ${nonAdminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });
});
