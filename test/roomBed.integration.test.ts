import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Room/bed admit & discharge (integration, requires DB) - Step 4.1 gate', () => {
  let receptionistToken: string;
  let patientAId: number;
  let patientBId: number;
  let bedId: number;

  beforeAll(async () => {
    await db('users').where({ username: 'phase4_bed_receptionist' }).del();

    const hash = await authService.hashPassword('Pass123!');
    const [rid] = await db('users').insert({
      username: 'phase4_bed_receptionist',
      password_hash: hash,
      role: 'receptionist',
      is_active: true,
    });
    receptionistToken = authService.issueTokenPair({
      id: rid,
      username: 'phase4_bed_receptionist',
      role: 'receptionist',
    }).accessToken;

    const [aId] = await db('patients').insert({ surname: 'BedA', other_name: 'Test', gender: 'male' });
    patientAId = aId;
    const [bId] = await db('patients').insert({ surname: 'BedB', other_name: 'Test', gender: 'female' });
    patientBId = bId;

    const [bedRowId] = await db('rooms_beds').insert({
      room_number: 'P4-101',
      bed_number: 'A',
      status: 'available',
      room_type: 'ward',
    });
    bedId = bedRowId;
  });

  afterAll(async () => {
    await db('rooms_beds').where({ id: bedId }).del();
    await db('patients').whereIn('id', [patientAId, patientBId]).del();
    await db('users').where({ username: 'phase4_bed_receptionist' }).del();
    await db.destroy();
  });

  it('admits a patient into an available bed', async () => {
    const res = await request(app)
      .post(`/rooms-beds/${bedId}/admit`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patientId: patientAId });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('occupied');
    expect(res.body.current_patient_id).toBe(patientAId);
  });

  it('prevents double-assignment to an already-occupied bed (409)', async () => {
    const res = await request(app)
      .post(`/rooms-beds/${bedId}/admit`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patientId: patientBId });
    expect(res.status).toBe(409);
  });

  it('discharges the patient, freeing the bed', async () => {
    const res = await request(app)
      .post(`/rooms-beds/${bedId}/discharge`)
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('available');
    expect(res.body.current_patient_id).toBeNull();
  });

  it('allows a new admission after discharge', async () => {
    const res = await request(app)
      .post(`/rooms-beds/${bedId}/admit`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patientId: patientBId });
    expect(res.status).toBe(200);
    expect(res.body.current_patient_id).toBe(patientBId);
  });
});
