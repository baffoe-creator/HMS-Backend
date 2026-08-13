import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Lab orders (integration, requires DB) - Step 3.3 gate', () => {
  let clinicianToken: string;
  let labTechToken: string;
  let clinicianId: number;
  let patientId: number;
  let orderId: number;

  beforeAll(async () => {
    await db('users').whereIn('username', ['phase3_lab_clinician', 'phase3_lab_tech']).del();

    const hash = await authService.hashPassword('Pass123!');
    const [cid] = await db('users').insert({
      username: 'phase3_lab_clinician',
      password_hash: hash,
      role: 'clinician',
      is_active: true,
    });
    clinicianId = cid;
    const [lid] = await db('users').insert({
      username: 'phase3_lab_tech',
      password_hash: hash,
      role: 'lab_tech',
      is_active: true,
    });
    clinicianToken = authService.issueTokenPair({
      id: cid,
      username: 'phase3_lab_clinician',
      role: 'clinician',
    }).accessToken;
    labTechToken = authService.issueTokenPair({
      id: lid,
      username: 'phase3_lab_tech',
      role: 'lab_tech',
    }).accessToken;

    const [pid] = await db('patients').insert({
      surname: 'Lab',
      other_name: 'Test',
      gender: 'male',
      dob: '1985-05-05',
    });
    patientId = pid;
  });

  afterAll(async () => {
    if (orderId) await db('lab_orders').where({ id: orderId }).del();
    await db('patients').where({ id: patientId }).del();
    await db('users').whereIn('username', ['phase3_lab_clinician', 'phase3_lab_tech']).del();
    await db.destroy();
  });

  it('creates a lab order in "ordered" status', async () => {
    const res = await request(app)
      .post('/lab-orders')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({ patientId, testType: 'Full Blood Count', orderedBy: clinicianId, orderedDate: '2026-08-13' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ordered');
    orderId = res.body.id;
  });

  it('rejects skipping straight to completed (400)', async () => {
    const res = await request(app)
      .patch(`/lab-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({ status: 'completed', result: 'Normal' });
    expect(res.status).toBe(400);
  });

  it('walks ordered -> in_progress -> completed', async () => {
    const step1 = await request(app)
      .patch(`/lab-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({ status: 'in_progress' });
    expect(step1.status).toBe(200);
    expect(step1.body.status).toBe('in_progress');

    const step2 = await request(app)
      .patch(`/lab-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({ status: 'completed', result: 'WBC 7.2, normal range' });
    expect(step2.status).toBe(200);
    expect(step2.body.status).toBe('completed');
    expect(step2.body.result).toBe('WBC 7.2, normal range');
  });

  it('rejects any further transition once completed (terminal state)', async () => {
    const res = await request(app)
      .patch(`/lab-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(400);
  });
});
