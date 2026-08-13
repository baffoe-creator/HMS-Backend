import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Patient registration & CRUD (integration, requires DB) - Step 2.1 gate', () => {
  let receptionistToken: string;
  let adminToken: string;
  const createdPatientIds: number[] = [];

  beforeAll(async () => {
    await db('users').whereIn('username', ['phase2_receptionist', 'phase2_admin']).del();

    const hash = await authService.hashPassword('ReceptionPass123!');
    const [uid] = await db('users').insert({
      username: 'phase2_receptionist',
      password_hash: hash,
      role: 'receptionist',
      is_active: true,
    });
    receptionistToken = authService.issueTokenPair({
      id: uid,
      username: 'phase2_receptionist',
      role: 'receptionist',
    }).accessToken;

    const [adminUid] = await db('users').insert({
      username: 'phase2_admin',
      password_hash: hash,
      role: 'admin',
      is_active: true,
    });
    adminToken = authService.issueTokenPair({
      id: adminUid,
      username: 'phase2_admin',
      role: 'admin',
    }).accessToken;
  });

  afterAll(async () => {
    if (createdPatientIds.length > 0) {
      await db('patients').whereIn('id', createdPatientIds).del();
    }
    await db('users').whereIn('username', ['phase2_receptionist', 'phase2_admin']).del();
    await db.destroy();
  });

  it('registers a patient with full demographics (201)', async () => {
    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'Boateng', otherName: 'Yaw', dob: '1988-03-14', gender: 'male' });

    expect(res.status).toBe(201);
    expect(res.body.patient.id).toBeDefined();
    expect(res.body.duplicateOf).toBeNull();
    createdPatientIds.push(res.body.patient.id);
  });

  it('rejects registration missing a required field (400)', async () => {
    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'Boateng' });

    expect(res.status).toBe(400);
  });

  it('flags duplicateOf when the same surname+otherName+dob is registered again', async () => {
    const first = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'Asante', otherName: 'Efua', dob: '1975-11-02', gender: 'female' });
    createdPatientIds.push(first.body.patient.id);

    const second = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'Asante', otherName: 'Efua', dob: '1975-11-02', gender: 'female' });
    createdPatientIds.push(second.body.patient.id);

    expect(second.status).toBe(201);
    expect(second.body.duplicateOf).toBe(first.body.patient.id);
  });

  it('reads, updates, and deletes a patient (full CRUD loop)', async () => {
    const created = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ surname: 'Darko', otherName: 'Kofi', dob: '2000-01-01', gender: 'male' });
    const id = created.body.patient.id;

    const read = await request(app)
      .get(`/patients/${id}`)
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(read.status).toBe(200);
    expect(read.body.surname).toBe('Darko');

    const updated = await request(app)
      .patch(`/patients/${id}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ memberNumber: 'NHIA-12345' });
    expect(updated.status).toBe(200);
    expect(updated.body.member_number).toBe('NHIA-12345');

    const deniedDelete = await request(app)
      .delete(`/patients/${id}`)
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(deniedDelete.status).toBe(403); // deletion is admin-only per RBAC

    const deleted = await request(app)
      .delete(`/patients/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/patients/${id}`)
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(afterDelete.status).toBe(404);
  });
});
