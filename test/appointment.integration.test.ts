import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Appointment booking & availability (integration, requires DB) - Step 2.4 gate', () => {
  let receptionistToken: string;
  let patientId: number;
  let doctorId: number;
  let appointmentId: number;

  beforeAll(async () => {
    await db('users').whereIn('username', ['phase2_appt_receptionist', 'phase2_appt_doctor']).del();

    const hash = await authService.hashPassword('Pass123!');
    const [rid] = await db('users').insert({
      username: 'phase2_appt_receptionist',
      password_hash: hash,
      role: 'receptionist',
      is_active: true,
    });
    const [did] = await db('users').insert({
      username: 'phase2_appt_doctor',
      password_hash: hash,
      role: 'clinician',
      is_active: true,
    });
    doctorId = did;
    receptionistToken = authService.issueTokenPair({
      id: rid,
      username: 'phase2_appt_receptionist',
      role: 'receptionist',
    }).accessToken;

    const [pid] = await db('patients').insert({
      surname: 'Appt',
      other_name: 'Test',
      gender: 'male',
      dob: '1990-01-01',
    });
    patientId = pid;
  });

  afterAll(async () => {
    if (appointmentId) await db('appointments').where({ id: appointmentId }).del();
    await db('patients').where({ id: patientId }).del();
    await db('users').whereIn('username', ['phase2_appt_receptionist', 'phase2_appt_doctor']).del();
    await db.destroy();
  });

  it('books an appointment successfully', async () => {
    const res = await request(app)
      .post('/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patientId, doctorId, appointmentTime: '2026-09-01T09:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('scheduled');
    appointmentId = res.body.id;
  });

  it('rejects a double-booking for the same doctor + exact time (409)', async () => {
    const res = await request(app)
      .post('/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patientId, doctorId, appointmentTime: '2026-09-01T09:00:00.000Z' });

    expect(res.status).toBe(409);
  });

  it('returns availability excluding the booked slot', async () => {
    const res = await request(app)
      .get('/appointments/availability')
      .query({ doctorId, date: '2026-09-01' })
      .set('Authorization', `Bearer ${receptionistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.availableSlots).not.toContain('2026-09-01T09:00:00.000Z');
    expect(res.body.availableSlots.length).toBe(17); // 18 total slots - 1 booked
  });
});
