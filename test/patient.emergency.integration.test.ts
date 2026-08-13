import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Emergency registration & overdue flagging (integration, requires DB) - Step 2.2 gate', () => {
  let receptionistToken: string;
  let adminToken: string;
  const createdPatientIds: number[] = [];

  beforeAll(async () => {
    await db('users')
      .whereIn('username', ['phase2_emerg_receptionist', 'phase2_emerg_admin'])
      .del();

    const hash = await authService.hashPassword('Pass123!');
    const [rid] = await db('users').insert({
      username: 'phase2_emerg_receptionist',
      password_hash: hash,
      role: 'receptionist',
      is_active: true,
    });
    const [aid] = await db('users').insert({
      username: 'phase2_emerg_admin',
      password_hash: hash,
      role: 'admin',
      is_active: true,
    });
    receptionistToken = authService.issueTokenPair({
      id: rid,
      username: 'phase2_emerg_receptionist',
      role: 'receptionist',
    }).accessToken;
    adminToken = authService.issueTokenPair({
      id: aid,
      username: 'phase2_emerg_admin',
      role: 'admin',
    }).accessToken;
  });

  afterAll(async () => {
    if (createdPatientIds.length > 0) {
      await db('patients').whereIn('id', createdPatientIds).del();
    }
    await db('users')
      .whereIn('username', ['phase2_emerg_receptionist', 'phase2_emerg_admin'])
      .del();
    await db.destroy();
  });

  it('creates an emergency record with only surname + gender', async () => {
    const res = await request(app)
      .post('/patients/emergency')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'Unknown', gender: 'male' });

    expect(res.status).toBe(201);
    expect(res.body.is_emergency).toBe(true);
    expect(res.body.emergency_completed_at).toBeNull();
    createdPatientIds.push(res.body.id);
  });

  it('flags an emergency record older than 24h and leaves a recent one alone', async () => {
    const overdueRes = await request(app)
      .post('/patients/emergency')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'Overdue Case', gender: 'female' });
    const overdueId = overdueRes.body.id;
    createdPatientIds.push(overdueId);

    // backdate created_at directly - this simulates "25 hours ago" without waiting
    await db('patients')
      .where({ id: overdueId })
      .update({ created_at: db.raw('DATE_SUB(NOW(), INTERVAL 25 HOUR)') });

    const recentRes = await request(app)
      .post('/patients/emergency')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'Recent Case', gender: 'female' });
    const recentId = recentRes.body.id;
    createdPatientIds.push(recentId);

    const flagRes = await request(app)
      .post('/patients/emergency/flag-overdue')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(flagRes.status).toBe(200);
    const flaggedIds = flagRes.body.flagged.map((p: { id: number }) => p.id);
    expect(flaggedIds).toContain(overdueId);
    expect(flaggedIds).not.toContain(recentId);
  });

  it('completes an emergency registration and clears is_emergency', async () => {
    const created = await request(app)
      .post('/patients/emergency')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'ToComplete', gender: 'male' });
    const id = created.body.id;
    createdPatientIds.push(id);

    const completed = await request(app)
      .patch(`/patients/${id}/complete-emergency`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ dob: '1995-06-15', otherName: 'FullName' });

    expect(completed.status).toBe(200);
    expect(completed.body.is_emergency).toBe(false);
    expect(completed.body.emergency_completed_at).not.toBeNull();
  });
});
